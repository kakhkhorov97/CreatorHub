import express from 'express';
import request from 'supertest';
import { protectGraphqlGet } from '../src/libs/helpers/graphql-http';
import { Connection } from 'mongoose';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { validateEnvironment } from '../src/libs/config';

const production = {
	NODE_ENV: 'production',
	JWT_SECRET: 'x'.repeat(32),
	MONGO_PROD: 'mongodb://localhost/disposable',
	FRONTEND_URL: 'https://creatorhub.site',
	UPLOAD_BASE_URL: 'https://api.creatorhub.site/uploads',
	RESEND_API_KEY: 're_test_only',
	RESEND_FROM_EMAIL: 'noreply@creatorhub.site',
};

describe('deployment configuration', () => {
	it('binds production to loopback and preserves development access', () => {
		expect(validateEnvironment(production).LISTEN_HOST).toBe('127.0.0.1');
		expect(validateEnvironment({ JWT_SECRET: 'x'.repeat(32), MONGO_DEV: 'mongodb://localhost/test' }).LISTEN_HOST).toBe(
			'0.0.0.0',
		);
	});
	it.each(['bad', '0', '65536'])('rejects invalid ports: %s', (port) => {
		expect(() => validateEnvironment({ ...production, PORT_API: port })).toThrow('PORT_API');
	});
	it('accepts assigned ports', () => {
		expect(validateEnvironment({ ...production, PORT_API: '7001', PORT_BATCH: '7002' }).PORT_BATCH).toBe('7002');
	});
});

describe('readiness endpoint', () => {
	it('checks MongoDB and returns no private details', async () => {
		const command = jest.fn().mockResolvedValue({ ok: 1 });
		const controller = new AppController(new AppService(), { readyState: 1, db: { command } } as unknown as Connection);
		await expect(controller.health()).resolves.toEqual({ status: 'ok' });
		expect(command).toHaveBeenCalledWith({ ping: 1 }, { timeoutMS: 2000 });
	});
	it.each(['disconnected', 'failure'])('returns a generic error on %s', async (failure) => {
		const command = jest.fn().mockRejectedValue(new Error('private connection details'));
		const controller = new AppController(new AppService(), {
			readyState: failure === 'failure' ? 1 : 0,
			db: { command },
		} as unknown as Connection);
		await expect(controller.health()).rejects.toThrow('Service unavailable');
	});
});

describe('GraphQL GET content types', () => {
	const app = express();
	app.use(protectGraphqlGet);
	app.use((_request, response) => response.sendStatus(200));
	it.each(['message/rfc822', 'multipart/form-data', 'text/plain'])('rejects %s on GraphQL GET', async (type) => {
		await request(app).get('/graphql').set('Content-Type', type).expect(415);
	});
	it('preserves JSON GET and multipart POST uploads', async () => {
		await request(app).get('/graphql').set('Content-Type', 'application/json; charset=utf-8').expect(200);
		await request(app).post('/graphql').set('Content-Type', 'multipart/form-data').expect(200);
		await request(app).get('/uploads/example.png').set('Content-Type', 'image/png').expect(200);
	});
});
