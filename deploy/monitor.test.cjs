const test = require('node:test');
const assert = require('node:assert/strict');
const { checkEndpoints, transition, criticalLog } = require('./monitor.cjs');

test('HTTP 200 with an unhealthy API body still fails readiness', async () => {
	const failures = await checkEndpoints(async () => ({ ok: true, json: async () => ({ status: 'unavailable' }) }));
	assert.deepEqual(failures, ['api']);
});
test('transport and HTTP errors are reported without response bodies', async () => {
	let call = 0;
	const failures = await checkEndpoints(async () => {
		call++;
		if (call === 1) throw Error('private internal details');
		return { ok: false };
	});
	assert.deepEqual(failures, ['website', 'api', 'worker']);
});
test('two failures alert once and recovery alerts once', () => {
	const first = transition({}, ['api']);
	assert.equal(first.notification, null);
	const second = transition(first.state, ['api']);
	assert.match(second.notification, /failed/);
	second.state.notified = second.signature;
	const repeated = transition(second.state, ['api']);
	assert.equal(repeated.notification, null);
	const recovered = transition(repeated.state, []);
	assert.match(recovered.notification, /recovered/);
	recovered.state.notified = recovered.signature;
	assert.equal(transition(recovered.state, []).notification, null);
});

test('critical application errors alert on the first check', () => {
	assert.match(transition({}, ['application-errors']).notification, /application-errors/);
});

test('alerts use structured errors rather than client operation names', () => {
	assert.equal(
		criticalLog(JSON.stringify({ status: 200, graphql: { operationName: 'INTERNAL_SERVER_ERROR', errorCodes: [] } })),
		false,
	);
	assert.equal(criticalLog(JSON.stringify({ status: 200, graphql: { errorCodes: ['INTERNAL_SERVER_ERROR'] } })), true);
	assert.equal(criticalLog(JSON.stringify({ status: 503 })), true);
	assert.equal(criticalLog('[ERROR] service failed'), true);
});
