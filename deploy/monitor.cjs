#!/usr/bin/env node
const endpoints = [
	['website', 'https://creatorhub.site/account/sign-in'],
	['api', 'https://api.creatorhub.site/health'],
	['worker', 'http://127.0.0.1:7002/'],
];

async function checkEndpoints(fetchRequest = fetch) {
	const failures = [];
	for (const [name, url] of endpoints) {
		try {
			const response = await fetchRequest(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
			if (!response.ok || (name === 'api' && (await response.json()).status !== 'ok')) failures.push(name);
		} catch {
			failures.push(name);
		}
	}
	return failures;
}

function transition(previous, failures) {
	const count = failures.length ? (previous.failureCount || 0) + 1 : 0;
	const signature = failures.slice().sort().join(',');
	const state = { failureCount: count, notified: previous.notified || '', checkedAt: new Date().toISOString() };
	let notification = null;
	if ((count >= 2 || failures.includes('application-errors')) && signature !== state.notified)
		notification = 'CreatorHub checks failed: ' + signature;
	if (!signature && state.notified) notification = 'CreatorHub checks recovered.';
	return { state, notification, signature };
}

function criticalLog(line) {
	try {
		const entry = JSON.parse(line.slice(line.indexOf('{'), line.lastIndexOf('}') + 1));
		return Number(entry.status) >= 500 || (entry.graphql?.errorCodes || []).includes('INTERNAL_SERVER_ERROR');
	} catch {
		return /\[ERROR\]|\bERROR\b/.test(line);
	}
}

async function main() {
	const fs = require('node:fs');
	const path = require('node:path');
	const root = '/srv/Sean/creatorhub';
	const load = require('node:module').createRequire(path.join(root, 'current/backend/package.json'));
	const env = load('dotenv').parse(fs.readFileSync(path.join(root, 'shared/backend.env')));
	const folder = path.join(root, 'shared/monitoring');
	fs.mkdirSync(folder, { recursive: true, mode: 0o700 });
	const file = path.join(folder, 'state.json');
	let previous = {};
	try {
		previous = JSON.parse(fs.readFileSync(file, 'utf8'));
	} catch {}
	const failures = await checkEndpoints();
	const { execFileSync } = require('node:child_process');
	for (const service of ['creatorhub-api', 'creatorhub-worker', 'creatorhub-frontend']) {
		try {
			execFileSync('systemctl', ['is-active', '--quiet', service], { stdio: 'ignore' });
		} catch {
			failures.push(service);
		}
	}
	try {
		const logs = execFileSync(
			'journalctl',
			[
				'-u',
				'creatorhub-api.service',
				'-u',
				'creatorhub-worker.service',
				'-u',
				'creatorhub-frontend.service',
				'--since',
				previous.checkedAt || '-5min',
				'--no-pager',
				'-o',
				'cat',
			],
			{ encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
		);
		if (logs.split('\n').some(criticalLog)) failures.push('application-errors');
	} catch {
		failures.push('log-access');
	}
	const result = transition(previous, failures);
	if (result.notification && env.MONITOR_EMAIL && env.RESEND_API_KEY && env.RESEND_FROM_EMAIL) {
		try {
			const response = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
				signal: AbortSignal.timeout(10000),
				redirect: 'error',
				body: JSON.stringify({
					from: env.RESEND_FROM_EMAIL,
					to: [env.MONITOR_EMAIL],
					subject: 'CreatorHub service status',
					text: result.notification,
				}),
			});
			if (response.ok) result.state.notified = result.signature;
			else console.error('CreatorHub monitor notification failed.');
		} catch {
			console.error('CreatorHub monitor notification failed.');
		}
	}
	const temporary = file + '.tmp';
	fs.writeFileSync(temporary, JSON.stringify(result.state), { mode: 0o600 });
	fs.renameSync(temporary, file);
	console.log(
		JSON.stringify({
			event: 'creatorhub-health',
			failedChecks: failures,
			alertsConfigured: Boolean(env.MONITOR_EMAIL),
		}),
	);
}

module.exports = { checkEndpoints, transition, criticalLog };
if (require.main === module)
	main().catch(() => {
		console.error('CreatorHub monitor failed. Check its private configuration.');
		process.exitCode = 1;
	});
