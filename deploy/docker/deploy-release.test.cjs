const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);
function harness(t, mode = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creatorhub-deploy-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(path.join(dir, 'root/shared'), { recursive: true });
  for (const name of ['backend.env', 'frontend.env']) fs.writeFileSync(path.join(dir, 'root/shared', name), '');
  fs.writeFileSync(path.join(dir, 'compose.yaml'), '');
  const log = path.join(dir, 'calls');
  const mock = `#!${process.execPath}
const fs=require('fs'),path=require('path'),cp=require('child_process');
const cmd=path.basename(process.argv[1]),a=process.argv.slice(2),s=a.join(' '),mode=process.env.MODE;
fs.appendFileSync(process.env.LOG,JSON.stringify([cmd,...a])+'\\n');
if(cmd==='id') console.log('0');
if(cmd==='git' && s.includes('merge-base') && mode==='bad-commit') process.exit(1);
if(cmd==='git' && a.includes('archive')) { const r=cp.spawnSync('/usr/bin/tar',['-cf','-','-T','/dev/null']);process.stdout.write(r.stdout);process.exit(r.status); }
if(cmd==='docker') {
 if(a[0]==='image') process.exit(1);
 if(a[0]==='ps') console.log(s.includes('service=api')?'a1':s.includes('service=worker')?'b1':'c1');
 if(a[0]==='inspect') console.log(s.includes('State.Status')?(mode==='stopped'?'exited':'running'):(a.at(-1)==='c1'?'creatorhub-frontend:old':'creatorhub-backend:old'));
 if(a[0]==='build' && mode==='build-fail') process.exit(1);
 if(a[0]==='compose' && a.includes('up') && !s.includes('previous-images.yaml') && ['health-fail','stopped'].includes(mode)) process.exit(1);
}
if(cmd==='curl' && mode==='public-fail') process.exit(22);
`;
  for (const cmd of ['id', 'git', 'docker', 'curl', 'flock', 'sudo']) fs.writeFileSync(path.join(bin, cmd), mock, { mode: 0o755 });
  let script = fs.readFileSync(path.join(__dirname, 'deploy-release.sh'), 'utf8');
  script = script.replace('export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', `export PATH="${bin}:/usr/bin:/bin"`)
    .replace('root=/srv/Sean/creatorhub', `root="${dir}/root"`)
    .replace('state=/var/lib/creatorhub-deploy', `state="${dir}/state"`)
    .replace('compose_file=/etc/creatorhub-deploy/compose.yaml', `compose_file="${dir}/compose.yaml"`);
  const file = path.join(dir, 'deploy.sh');
  fs.writeFileSync(file, script);
  const env = { ...process.env, LOG: log, MODE: mode, PATH: `${bin}:/usr/bin:/bin` };
  return {
    run: (args = [sha, other]) => spawnSync('/bin/bash', [file, ...args], { env, encoding: 'utf8' }),
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [],
    dir, env,
  };
}
const isUp = c => c[0] === 'docker' && c.includes('up');
const isRollback = c => isUp(c) && c.some(x => x.endsWith('previous-images.yaml'));
test('invalid SHAs fail before git or Docker', t => {
  const h=harness(t),r=h.run(['$(touch /tmp/not-allowed)',other]);
  assert.notEqual(r.status,0); assert.ok(!h.calls().some(c=>['git','docker'].includes(c[0])));
});
test('commits outside develop stop before builds or container changes', t => {
  const h=harness(t,'bad-commit'); assert.notEqual(h.run().status,0);
  assert.ok(!h.calls().some(c=>c[0]==='docker'));
});
test('build failure leaves existing containers untouched', t => {
  const h=harness(t,'build-fail'); assert.notEqual(h.run().status,0); assert.ok(!h.calls().some(isUp));
});
test('healthy deployment builds sequentially and only starts CreatorHub services', t => {
  const h=harness(t),r=h.run(); assert.equal(r.status,0,r.stderr);
  const calls=h.calls(),up=calls.find(isUp); assert.ok(up.includes('creatorhub'));
  assert.deepEqual(up.slice(-3),['api','worker','frontend']);
  assert.ok(calls.findIndex(c=>c[0]==='docker'&&c[1]==='build')<calls.findIndex(c=>c[0]==='docker'&&c.includes('compose')&&c.includes('build')));
  assert.ok(fs.readFileSync(path.join(h.dir,'state/current-release'),'utf8').includes(sha));
  assert.ok(!calls.some(c=>c.some(x=>['down','prune','systemctl'].includes(x))));
});
for(const mode of ['health-fail','public-fail']) test(`${mode} attempts previous images and keeps failure status`,t=>{
  const h=harness(t,mode); assert.notEqual(h.run().status,0); assert.ok(h.calls().some(isRollback));
  assert.ok(!fs.existsSync(path.join(h.dir,'state/current-release')));
});
test('failed deployment does not start previously stopped services',t=>{
  const h=harness(t,'stopped'); assert.notEqual(h.run().status,0);
  assert.ok(!h.calls().some(isRollback)); assert.ok(h.calls().some(c=>c.includes('stop')));
});
test('SSH wrapper rejects arbitrary commands and forwards only two SHAs',t=>{
  const h=harness(t),file=path.join(__dirname,'deploy-ssh.sh');
  for(const cmd of ['', 'bash', `deploy ${sha} ${other}; whoami`, `deploy ${sha}`]) {
    const r=spawnSync('/bin/bash',[file],{env:{...h.env,SSH_ORIGINAL_COMMAND:cmd}}); assert.notEqual(r.status,0);
  }
  assert.equal(h.calls().length,0);
  const r=spawnSync('/bin/bash',[file],{env:{...h.env,SSH_ORIGINAL_COMMAND:`deploy ${sha} ${other}`}});
  assert.equal(r.status,0);
  assert.deepEqual(h.calls(),[['sudo','-n','/usr/local/sbin/creatorhub-deploy',sha,other]]);
});
