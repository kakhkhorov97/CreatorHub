const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const script = process.env.SCRIPT_PATH || path.join(__dirname, 'creatorhub.sh');

function run(args, scenario = '') {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'creatorhub-control-'));
	const trace = path.join(dir, 'trace');
	const shim = `#!${process.execPath}
const fs = require('node:fs');
const tool = require('node:path').basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.TRACE, JSON.stringify({tool, args}) + '\\n');
if (tool === 'sudo') {
  const r = require('node:child_process').spawnSync(args[0], args.slice(1), {stdio:'inherit'});
  process.exit(r.status ?? 1);
}
if (tool === 'curl') {
  if (process.env.SCENARIO === 'http-failure' && args.at(-1).includes('api.')) process.stdout.write('503');
  else if (process.env.SCENARIO === 'tls-failure') process.exit(60);
  else process.stdout.write('200');
} else if (args[0] === 'ps') {
  if (process.env.SCENARIO === 'daemon-failure') process.exit(1);
  if (!args.includes('label=com.docker.compose.project=creatorhub') || !args.includes('label=com.docker.compose.oneoff=False')) process.exit(9);
  const service = args.find(a => a.startsWith('label=com.docker.compose.service=')).split('=').at(-1);
  const id = {api:'a',worker:'b',frontend:'c'}[service].repeat(64);
  if (process.env.SCENARIO === 'missing' && service === 'frontend') process.exit(0);
  console.log(id);
  if (process.env.SCENARIO === 'duplicate' && service === 'worker') console.log('d'.repeat(64));
} else if (args[0] === 'inspect') {
  console.log('exited\\tnot running\\tcreatorhub:release-001');
}
`;
	for (const name of ['docker', 'sudo', 'curl']) fs.writeFileSync(path.join(dir, name), shim, { mode: 0o755 });
	try {
		const result = spawnSync('/bin/bash', [script, ...args], {
			encoding: 'utf8',
			env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TRACE: trace, SCENARIO: scenario },
		});
		return {
			...result,
			calls: fs.existsSync(trace) ? fs.readFileSync(trace, 'utf8').trim().split('\n').map(JSON.parse) : [],
		};
	} finally {
		fs.rmSync(dir, { recursive: true, force: true });
	}
}
const dockerCalls = (r) => r.calls.filter((c) => c.tool === 'docker');
const mutations = (r) => dockerCalls(r).filter((c) => ['start', 'stop'].includes(c.args[0]));

test('status reports all services and existing image without environment inspection', () => {
	const r = run(['status']);
	assert.equal(r.status, 0, r.stderr);
	assert.match(r.stdout, /api\texited\tnot running/);
	assert.match(r.stdout, /frontend\texited/);
	assert.equal(mutations(r).length, 0);
	assert.ok(dockerCalls(r).every((c) => !c.args.join(' ').includes('.Config.Env')));
});
test('start targets exactly the three project service IDs', () => {
	const r = run(['start']);
	assert.equal(r.status, 0, r.stderr);
	assert.deepEqual(mutations(r)[0].args, ['start', ...['a', 'b', 'c'].map((c) => c.repeat(64))]);
	assert.match(r.stdout, /does not deploy pulled code/);
});
test('stop uses a 30-second timeout and only CreatorHub IDs', () => {
	const r = run(['stop']);
	assert.equal(r.status, 0, r.stderr);
	assert.deepEqual(mutations(r)[0].args, ['stop', '--timeout', '30', ...['a', 'b', 'c'].map((c) => c.repeat(64))]);
});
for (const scenario of ['missing', 'duplicate', 'daemon-failure']) {
	test(`start refuses ${scenario} before any container mutation`, () => {
		const r = run(['start'], scenario);
		assert.notEqual(r.status, 0);
		assert.equal(mutations(r).length, 0);
	});
}
test('logs are bounded and follow is opt-in', () => {
	const r = run(['logs', 'api', '--follow']);
	assert.equal(r.status, 0, r.stderr);
	assert.deepEqual(dockerCalls(r).at(-1).args, ['logs', '--tail', '100', '--timestamps', '--follow', 'a'.repeat(64)]);
	for (const args of [
		['logs', 'hadijam'],
		['logs', 'api', '--env'],
		['stop', 'all'],
	]) {
		const invalid = run(args);
		assert.notEqual(invalid.status, 0);
		assert.equal(dockerCalls(invalid).length, 0);
	}
});
test('health checks both HTTPS URLs and fails on HTTP or TLS errors', () => {
	assert.equal(run(['health']).status, 0);
	for (const scenario of ['http-failure', 'tls-failure']) {
		const r = run(['health'], scenario);
		assert.equal(r.status, 1);
		assert.equal(r.calls.filter((c) => c.tool === 'curl').length, 2);
		assert.match(r.stdout, /FAILED/);
		assert.equal(dockerCalls(r).length, 0);
	}
});
test('help and unknown commands do not touch Docker', () => {
	assert.equal(run(['help']).calls.length, 0);
	const r = run(['prune']);
	assert.equal(r.status, 2);
	assert.equal(r.calls.length, 0);
});
