import express from 'express';
import request from 'supertest';
import { configureTrustedProxy } from '../src/libs/helpers/trusted-proxy';
import { validateEnvironment } from '../src/libs/config';

describe('trusted proxy client addresses', () => {
	it('ignores forwarded headers by default', async () => {
		const app = express();
		configureTrustedProxy(app);
		app.get('/', (req, res) => res.json({ ip: req.ip }));
		const response = await request(app).get('/').set('X-Forwarded-For', '203.0.113.10');
		expect(response.body.ip).not.toBe('203.0.113.10');
	});

	it('uses the nearest untrusted visitor behind the loopback proxy', async () => {
		const app = express();
		configureTrustedProxy(app, 'loopback');
		app.get('/', (req, res) => res.json({ ip: req.ip }));
		const first = await request(app).get('/').set('X-Forwarded-For', '203.0.113.10');
		const second = await request(app).get('/').set('X-Forwarded-For', '198.51.100.99, 203.0.113.20');
		expect(first.body.ip).toBe('203.0.113.10');
		expect(second.body.ip).toBe('203.0.113.20');
	});

	it('rejects unrestricted proxy trust configuration', () => {
		expect(() => validateEnvironment({ TRUST_PROXY: 'true' })).toThrow('TRUST_PROXY must be unset or loopback');
	});
});
