import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection } from 'mongoose';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { MailService } from '../src/components/auth/mail.service';

describe('Direct inquiries and verified customer feedback', () => {
	let mongo: MongoMemoryReplSet, app: INestApplication, db: Connection;
	let customer: { accessToken: string; user: { _id: string } }, creator: typeof customer, outsider: typeof customer;
	let profileId: string;
	const mail = new Map<string, string>();
	const send = 'mutation($input:SendInquiryInput!){sendInquiry(input:$input){_id status version outcome}}';
	const review =
		'mutation($input:CreateServiceFeedbackInput!){createServiceFeedback(input:$input){_id rating feedback authorName}}';
	async function gql(query: string, variables: Record<string, unknown> = {}, token?: string) {
		return (
			await request(app.getHttpServer())
				.post('/graphql')
				.set('Authorization', token ? `Bearer ${token}` : '')
				.send({ query, variables })
		).body;
	}
	async function ok(query: string, variables: Record<string, unknown> = {}, token?: string) {
		const result = await gql(query, variables, token);
		expect(result.errors).toBeUndefined();
		return result.data;
	}
	async function account(email: string, password = 'abcdef') {
		const data = await ok('mutation($input:RegisterInput!){register(input:$input){accessToken user{_id}}}', {
			input: { email, password, displayName: 'Test Customer' },
		});
		await ok('mutation($token:String!){verifyEmail(token:$token)}', { token: mail.get(email) });
		return data.register;
	}
	beforeAll(async () => {
		mongo = await MongoMemoryReplSet.create({
			replSet: { count: 1, storageEngine: 'wiredTiger' },
			binary: { version: '7.0.24', systemBinary: process.env.MONGOMS_SYSTEM_BINARY },
		});
		process.env.NODE_ENV = 'test';
		process.env.MONGO_DEV = mongo.getUri('service_feedback_test');
		process.env.JWT_SECRET = 'service-feedback-test-secret-with-at-least-32-characters';
		process.env.MEDIA_BASE_URL = 'https://media.example.com/creatorhub';
		delete process.env.MAIL_WEBHOOK_URL;
		const { AppModule } = jest.requireActual('../src/app.module');
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(MailService)
			.useValue({ sendToken: async (email: string, _purpose: string, token: string) => mail.set(email, token) })
			.compile();
		app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
		await app.init();
		db = app.get(getConnectionToken());
		for (const model of Object.values(db.models)) await model.createIndexes();
		customer = await account('feedback-customer@example.com');
		creator = await account('feedback-creator@example.com');
		outsider = await account('feedback-outsider@example.com');
		await db.model('User').updateOne({ _id: creator.user._id }, { $set: { role: 'CREATOR' } });
		const category = await db.model('Category').create({ name: 'Design', slug: 'design', isActive: true });
		const profile = await db.model('CreatorProfile').create({
			userId: creator.user._id,
			slug: 'feedback-studio',
			headline: 'Studio',
			city: 'gwangju',
			categoryIds: [category._id],
			status: 'PUBLISHED',
		});
		profileId = String(profile._id);
	}, 180000);
	afterAll(async () => {
		if (app) await app.close();
		if (mongo) await mongo.stop();
	});
	function input() {
		return {
			creatorId: profileId,
			subject: 'Design request',
			brief: 'Please design a visual identity for my new store.',
			clientRequestKey: randomUUID(),
		};
	}
	it('sends immediately, retries once, and rolls back invalid submissions', async () => {
		const fields = input();
		const first = (await ok(send, { input: fields }, customer.accessToken)).sendInquiry;
		const again = (await ok(send, { input: fields }, customer.accessToken)).sendInquiry;
		expect(first.status).toBe('SENT');
		expect(again._id).toBe(first._id);
		expect(await db.model('Inquiry').countDocuments({ clientRequestKey: fields.clientRequestKey })).toBe(1);
		const invalid = { ...input(), desiredDeadline: '2020-01-01T00:00:00.000Z' };
		expect((await gql(send, { input: invalid }, customer.accessToken)).errors).toBeDefined();
		expect(await db.model('Inquiry').countDocuments({ clientRequestKey: invalid.clientRequestKey })).toBe(0);
		expect((await gql(send, { input: input() }, creator.accessToken)).errors).toBeDefined();
	});
	it('requires completed agreed work and the actual customer, and prevents duplicate reviews', async () => {
		const inquiry = (await ok(send, { input: input() }, customer.accessToken)).sendInquiry;
		const fields = { inquiryId: inquiry._id, rating: 5, feedback: 'Excellent work and clear communication.' };
		expect((await gql(review, { input: fields }, customer.accessToken)).errors).toBeDefined();
		await db
			.model('Inquiry')
			.updateOne({ _id: inquiry._id }, { $set: { status: 'CLOSED', outcome: 'AGREED_TO_PROCEED' } });
		const complete = 'mutation($input:InquiryVersionInput!){completeInquiry(input:$input){version outcome}}';
		expect(
			(
				await gql(
					complete,
					{ input: { inquiryId: inquiry._id, expectedVersion: inquiry.version } },
					creator.accessToken,
				)
			).errors,
		).toBeDefined();
		const done = (
			await ok(complete, { input: { inquiryId: inquiry._id, expectedVersion: inquiry.version } }, customer.accessToken)
		).completeInquiry;
		expect(done.outcome).toBe('COMPLETED');
		expect((await gql(review, { input: fields }, outsider.accessToken)).errors).toBeDefined();
		expect((await gql(review, { input: { ...fields, rating: 6 } }, customer.accessToken)).errors).toBeDefined();
		await ok(review, { input: fields }, customer.accessToken);
		expect((await gql(review, { input: fields }, customer.accessToken)).errors).toBeDefined();
		const publicRows = (
			await ok(
				'query($id:ID!){getCreatorFeedback(creatorId:$id){list{rating feedback authorName} metaCounter{total}}}',
				{ id: profileId },
			)
		).getCreatorFeedback;
		expect(publicRows.list).toHaveLength(1);
		expect(publicRows.list[0].rating).toBe(5);
		expect(publicRows.metaCounter[0].total).toBe(1);
		expect(
			(await gql('query($id:ID!){getInquiryFeedback(inquiryId:$id){_id}}', { id: inquiry._id }, outsider.accessToken))
				.errors,
		).toBeDefined();
	});
	it('enforces password bounds on new credentials and retains the same account on creator onboarding', async () => {
		for (const password of ['12345', 'x'.repeat(31)])
			expect(
				(
					await gql('mutation($input:RegisterInput!){register(input:$input){accessToken}}', {
						input: { email: randomUUID() + '@example.com', password, displayName: 'Customer' },
					})
				).errors,
			).toBeDefined();
		const unicode = await account('unicode-feedback@example.com', '한'.repeat(30));
		await ok('mutation($input:LoginInput!){login(input:$input){accessToken}}', {
			input: { email: 'unicode-feedback@example.com', password: '한'.repeat(30) },
		});
		expect(unicode.user._id).toBeTruthy();
		const before = await db.model('User').countDocuments();
		const profile = (
			await ok(
				'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id userId}}',
				{ input: { slug: 'customer-upgrade', headline: 'Designer', city: 'gwangju' } },
				customer.accessToken,
			)
		).createCreatorProfile;
		expect(profile.userId).toBe(customer.user._id);
		expect(await db.model('User').countDocuments()).toBe(before);
		expect(await db.model('AuthIdentity').countDocuments({ userId: customer.user._id })).toBe(1);
	});
});
