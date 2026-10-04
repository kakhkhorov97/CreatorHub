import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { Logger } from '@nestjs/common';
import express, { Express, Request } from 'express';
import request from 'supertest';
import { graphqlRequestLogger, requestLogger } from '../src/libs/interceptors/request-logger';

describe('Request logging', () => {
	let app: Express;
	let server: ApolloServer<{ req: Request }>;
	let logs: jest.SpyInstance;
	let warnings: jest.SpyInstance;
	let errors: jest.SpyInstance;

	beforeAll(async () => {
		logs = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
		warnings = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
		errors = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
		server = new ApolloServer<{ req: Request }>({
			typeDefs: 'type Query { apiName: String! } type Mutation { signIn(password: String!): String! }',
			resolvers: {
				Query: { apiName: () => 'CreatorHub API' },
				Mutation: {
					signIn: () => {
						throw new Error('private-error-details');
					},
				},
			},
			plugins: [graphqlRequestLogger],
		});
		await server.start();
		app = express();
		app.use(requestLogger);
		app.use('/graphql', express.json(), expressMiddleware(server, { context: async ({ req }) => ({ req }) }));
		app.get('/', (_req, res) => res.send('CreatorHub API'));
	});

	beforeEach(() => jest.clearAllMocks());

	afterAll(async () => {
		await server.stop();
		jest.restoreAllMocks();
	});

	it('correlates a successful GraphQL request without logging headers or variables', async () => {
		const response = await request(app)
			.post('/graphql?token=private-query-token')
			.set('Authorization', 'Bearer private-header-token')
			.send({ query: 'query ApiInfo { apiName }', variables: { password: 'private-variable-password' } });
		expect(response.body.data.apiName).toBe('CreatorHub API');
		expect(logs).toHaveBeenCalledTimes(1);
		const serialized = logs.mock.calls[0][0] as string;
		const entry = JSON.parse(serialized);
		expect(entry.requestId).toBe(response.headers['x-request-id']);
		expect(entry.status).toBe(200);
		expect(entry.route).toBe('/graphql');
		expect(entry.durationMs).toBeGreaterThanOrEqual(0);
		expect(entry.graphql).toEqual({ type: 'query', name: 'ApiInfo', fields: ['apiName'], errorCodes: [] });
		expect(serialized).not.toContain('private-');
	});

	it('logs GraphQL errors even when HTTP succeeds without exposing inline inputs or error messages', async () => {
		const response = await request(app)
			.post('/graphql')
			.send({ query: 'mutation SignIn { signIn(password: "private-inline-password") }' });
		expect(response.status).toBe(200);
		expect(response.body.errors).toHaveLength(1);
		expect(errors).toHaveBeenCalledTimes(1);
		const serialized = errors.mock.calls[0][0] as string;
		expect(JSON.parse(serialized).graphql.errorCodes).toEqual(['INTERNAL_SERVER_ERROR']);
		expect(serialized).not.toContain('private-');
	});

	it('logs validation failures and ordinary HTTP requests once each', async () => {
		await request(app).post('/graphql').send({ query: 'query { unknownField }' }).expect(400);
		expect(warnings).toHaveBeenCalledTimes(1);
		expect(JSON.parse(warnings.mock.calls[0][0]).graphql.errorCodes).toEqual(['GRAPHQL_VALIDATION_FAILED']);
		await request(app).get('/?token=private-query-token').expect(200);
		expect(logs).toHaveBeenCalledTimes(1);
		const entry = JSON.parse(logs.mock.calls[0][0]);
		expect(entry.route).toBe('/');
		expect(entry.graphql).toBeUndefined();
	});
});
