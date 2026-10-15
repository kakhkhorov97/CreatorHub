const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const script = process.env.SCRIPT_PATH || path.join(__dirname, "creatorhub.sh");
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "creatorhub-shortcuts-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const trace = path.join(dir, "trace");
  const mock = `#!${process.execPath}
const fs=require('fs'),cp=require('child_process'),path=require('path');
const tool=path.basename(process.env.MOCK_TOOL),a=process.env.MOCK_ARGS ? process.env.MOCK_ARGS.split('\\n') : [],s=a.join(' '),mode=process.env.MODE||'';
fs.appendFileSync(process.env.TRACE,JSON.stringify({tool,args:a})+'\\n');
if(tool==='sudo'){if(a[0]==='-v')process.exit(0);let args=a,env={...process.env};if(args[0]==='env'){args=args.slice(1);while(args[0]?.includes('=')){const item=args.shift(),i=item.indexOf('=');env[item.slice(0,i)]=item.slice(i+1);}}const r=cp.spawnSync(args[0],args.slice(1),{stdio:'inherit',env});process.exit(r.status??1);}
if(tool==='id')console.log('sean');
if(tool==='flock'&&mode==='locked')process.exit(1);
if(tool==='sha256sum')console.log((mode==='changed-env'?'e':'f').repeat(64));
if(tool==='git'){
 if(s.includes('branch --show-current'))console.log('develop');
 if(s.includes('status --porcelain')&&mode==='dirty')console.log(' M modified.ts');
 if(s.includes('remote get-url'))console.log(a[1].endsWith('backend')?'https://github.com/kakhkhorov97/CreatorHub.git':'https://github.com/kakhkhorov97/CreatorHub-next.git');
 if(s.includes('rev-parse HEAD'))console.log((mode==='changed-code'?'c':a[1].endsWith('backend')?'a':'b').repeat(40));
 if(s.includes('merge-base')&&a[1].endsWith('frontend')&&mode==='diverged')process.exit(1);
}
if(tool==='docker'){
 if(a[0]==='image'&&!fs.existsSync(path.join(process.env.HOME,'built')))process.exit(1);
 if(a.includes('build')&&a.at(-1)==='frontend'){if(mode==='build-fail')process.exit(1);fs.writeFileSync(path.join(process.env.HOME,'built'),'yes');}
 if(a[0]==='ps')console.log('a'.repeat(64));
 if(a[0]==='inspect')console.log('running\\thealthy');
 if(a.includes('up')&&mode==='unhealthy')process.exit(1);
}
if(tool==='curl')process.stdout.write(mode==='public-fail'?'502':'200');
`;
  fs.writeFileSync(path.join(dir, "mock.cjs"), mock);
  // Pass arguments through the environment: Node 20 scans --env-file even in script arguments.
  for (const name of [
    "git",
    "sudo",
    "docker",
    "flock",
    "id",
    "sha256sum",
    "curl",
  ])
    fs.writeFileSync(
      path.join(dir, name),
      `#!/bin/sh
export MOCK_TOOL="$0"
export MOCK_ARGS="$(printf '%s\\n' "$@")"
exec "${process.execPath}" "${path.join(dir, "mock.cjs")}"
`,
      { mode: 0o755 },
    );
  return {
    run: (command, mode = "") =>
      spawnSync("/bin/bash", [script, command], {
        encoding: "utf8",
        timeout: 15000,
        env: {
          ...process.env,
          HOME: dir,
          PATH: `${dir}:${process.env.PATH}`,
          TRACE: trace,
          MODE: mode,
        },
      }),
    calls: () =>
      fs.existsSync(trace)
        ? fs.readFileSync(trace, "utf8").trim().split("\n").map(JSON.parse)
        : [],
    pending: path.join(dir, ".local/state/creatorhub-cli/pending-release"),
    dir,
  };
}
test("pull refuses dirty work and checks both fast-forwards before merging", (t) => {
  for (const mode of ["dirty", "diverged"]) {
    const h = setup(t),
      r = h.run("pull", mode);
    assert.notEqual(r.status, 0);
    assert.ok(!h.calls().some((c) => c.args.includes("merge")));
  }
  const h = setup(t),
    r = h.run("pull");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(h.calls().filter((c) => c.args.includes("merge")).length, 2);
  assert.ok(!h.calls().some((c) => c.tool === "docker"));
});
test("build persists a release for deployment in another process", (t) => {
  const h = setup(t),
    r = h.run("build");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(h.pending));
  assert.deepEqual(
    h
      .calls()
      .filter((c) => c.tool === "docker" && c.args.includes("build"))
      .map((c) => c.args.at(-1)),
    ["api", "frontend"],
  );
  assert.ok(!h.calls().some((c) => c.args.includes("up")));
  const d = h.run("deploy");
  assert.equal(d.status, 0, d.stderr);
  const up = h
    .calls()
    .find((c) => c.tool === "docker" && c.args.includes("up"));
  assert.ok(up.args.includes("--wait"));
  assert.deepEqual(up.args.slice(-3), ["api", "worker", "frontend"]);
});
test("failed build clears previously saved candidate", (t) => {
  const h = setup(t);
  fs.mkdirSync(path.dirname(h.pending), { recursive: true });
  fs.writeFileSync(h.pending, "old");
  assert.notEqual(h.run("build", "build-fail").status, 0);
  assert.ok(!fs.existsSync(h.pending));
  assert.ok(!h.calls().some((c) => c.args.includes("up")));
});
test("deploy rejects missing build and changed source or configuration", (t) => {
  const h = setup(t);
  assert.notEqual(h.run("deploy").status, 0);
  assert.equal(h.run("build").status, 0);
  for (const mode of ["changed-code", "changed-env", "dirty"])
    assert.notEqual(h.run("deploy", mode).status, 0);
  assert.ok(!h.calls().some((c) => c.args.includes("up")));
});
test("deployment health failure is reported without claiming success", (t) => {
  for (const mode of ["unhealthy", "public-fail"]) {
    const h = setup(t);
    assert.equal(h.run("build").status, 0);
    const r = h.run("deploy", mode);
    assert.notEqual(r.status, 0);
    if (mode === "unhealthy") assert.match(r.stderr, /no automatic rollback/);
    assert.ok(
      !fs.existsSync(path.join(path.dirname(h.pending), "last-deployed")),
    );
  }
});
test("concurrent release operation is refused before git mutations", (t) => {
  const h = setup(t);
  assert.notEqual(h.run("pull", "locked").status, 0);
  assert.ok(!h.calls().some((c) => c.tool === "git"));
});
