const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function fixture() {
	const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'creatorhub-rollback-')));
	fs.mkdirSync(path.join(root, 'shared'));
	const bin = path.join(root, 'bin');
	fs.mkdirSync(bin);
	const scripts = {
		systemctl: '#!/bin/sh\necho "$*" >> "$CREATORHUB_ROOT/commands"\n',
		curl: '#!/bin/sh\ncase "$(readlink "$CREATORHUB_ROOT/current")" in */bad) exit 22;; *) exit 0;; esac\n',
		sleep: '#!/bin/sh\nexit 0\n',
		// The VPS runs GNU mv. Emulate its atomic symlink replacement on macOS for this test.
		mv: '#!/usr/bin/env node\nconst fs=require("node:fs"); const args=process.argv.slice(2).filter(x=>x!=="-Tf"); fs.renameSync(args[0],args[1]);\n',
	};
	for (const [name, source] of Object.entries(scripts)) fs.writeFileSync(path.join(bin, name), source, { mode: 0o700 });
	for (const name of ['old', 'good', 'bad']) {
		const release = path.join(root, 'releases', name);
		for (const file of [
			'backend/dist/apps/Creator-api/main.js',
			'backend/dist/apps/Creator-batch/main.js',
			'frontend/.next/BUILD_ID',
		]) {
			const target = path.join(release, file);
			fs.mkdirSync(path.dirname(target), { recursive: true });
			fs.writeFileSync(target, 'fixture');
		}
	}
	fs.symlinkSync(path.join(root, 'releases/old'), path.join(root, 'current'));
	const run = (id) =>
		spawnSync('/bin/bash', [path.join(__dirname, 'switch-release.sh'), id], {
			env: { ...process.env, CREATORHUB_ROOT: root, PATH: bin + ':' + process.env.PATH },
			encoding: 'utf8',
			timeout: 10000,
		});
	return { root, run, close: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test('a ready release switches the paired build and touches only CreatorHub services', () => {
	const f = fixture();
	try {
		const result = f.run('good');
		assert.equal(result.status, 0, result.stderr);
		assert.equal(fs.readlinkSync(path.join(f.root, 'current')), path.join(f.root, 'releases/good'));
		const commands = fs.readFileSync(path.join(f.root, 'commands'), 'utf8');
		assert.match(commands, /stop creatorhub-api.service creatorhub-worker.service creatorhub-frontend.service/);
		assert.doesNotMatch(commands, /nginx|hadijam|reboot|daemon-reload/);
		assert.equal(
			fs.readFileSync(path.join(f.root, 'shared/previous-release'), 'utf8').trim(),
			path.join(f.root, 'releases/old'),
		);
	} finally {
		f.close();
	}
});

test('failed readiness restores the previous paired release', () => {
	const f = fixture();
	try {
		const result = f.run('bad');
		assert.equal(result.status, 1, result.stderr);
		assert.equal(fs.readlinkSync(path.join(f.root, 'current')), path.join(f.root, 'releases/old'));
		assert.match(result.stderr, /Previous CreatorHub release restored/);
	} finally {
		f.close();
	}
});

test('an incomplete release or escaping ID cannot stop running applications', () => {
	const f = fixture();
	try {
		fs.rmSync(path.join(f.root, 'releases/good/frontend/.next/BUILD_ID'));
		for (const id of ['good', '../bad']) assert.equal(f.run(id).status, 2);
		assert.equal(fs.existsSync(path.join(f.root, 'commands')), false);
		assert.equal(fs.readlinkSync(path.join(f.root, 'current')), path.join(f.root, 'releases/old'));
	} finally {
		f.close();
	}
});
