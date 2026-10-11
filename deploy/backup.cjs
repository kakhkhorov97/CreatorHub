#!/usr/bin/env node
// Run with the API and worker stopped. Credentials stay out of process arguments.
const { createRequire } = require('node:module');
const { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { execFileSync } = require('node:child_process');
function main() {
	const root = '/srv/Sean/creatorhub';
	const load = createRequire(join(root, 'current/backend/package.json'));
	const env = load('dotenv').parse(readFileSync(join(root, 'shared/backend.env')));
	const database = new URL(env.MONGO_PROD).pathname.slice(1);
	if (database !== 'creatorhub_prod') throw new Error('Backup is restricted to creatorhub_prod.');
	for (const service of ['creatorhub-api', 'creatorhub-worker']) {
		try {
			execFileSync('systemctl', ['is-active', '--quiet', service]);
		} catch {
			continue;
		}
		throw new Error('Stop the CreatorHub API and worker before creating a consistent backup.');
	}
	const temporary = mkdtempSync(join(tmpdir(), 'creatorhub-backup-'));
	const id = new Date().toISOString().replace(/[:.]/g, '-');
	const destination = join(root, 'shared/backups', id);
	mkdirSync(destination, { recursive: true, mode: 0o700 });
	try {
		const config = join(temporary, 'dump.yml');
		writeFileSync(config, `uri: ${JSON.stringify(env.MONGO_PROD)}\n`, { mode: 0o600 });
		execFileSync(
			'mongodump',
			['--config', config, '--db', database, '--archive=' + join(destination, 'database.archive.gz'), '--gzip'],
			{ stdio: ['ignore', 'ignore', 'ignore'] },
		);
		execFileSync('tar', ['-czf', join(destination, 'uploads.tar.gz'), '-C', join(root, 'shared'), 'uploads']);
		writeFileSync(
			join(destination, 'manifest.json'),
			JSON.stringify(
				{
					database,
					createdAt: new Date().toISOString(),
					release: require('node:fs').realpathSync(join(root, 'current')),
				},
				null,
				2,
			),
			{ mode: 0o600 },
		);
		console.log('CreatorHub backup created: ' + id);
	} catch {
		rmSync(destination, { recursive: true, force: true });
		console.error('CreatorHub backup failed. Check database tool availability and permissions.');
		process.exitCode = 1;
	} finally {
		rmSync(temporary, { recursive: true, force: true });
	}
}
try {
	main();
} catch {
	console.error('CreatorHub backup failed. Check private configuration and database tools.');
	process.exitCode = 1;
}
