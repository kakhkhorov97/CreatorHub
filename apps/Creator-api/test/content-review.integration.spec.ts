import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import request from 'supertest';
import { MailService } from '../src/components/auth/mail.service';

// Real GraphQL permissions and transactional publication against a disposable replica set.
describe('Manual content approval', () => {
	let mongo: MongoMemoryReplSet;
	let app: INestApplication;
	let db: Connection;
	let creator: any, admin: any, outsider: any;
	let profileId: string, categoryId: string, projectId: string, serviceId: string;
	const mail = new Map<string, string>();
	async function gql(query: string, variables: Record<string, unknown> = {}, token?: string) {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', token ? `Bearer ${token}` : '')
			.send({ query, variables });
		return response.body;
	}
	async function ok(query: string, variables: Record<string, unknown> = {}, token?: string) {
		const result = await gql(query, variables, token);
		expect(result.errors).toBeUndefined();
		return result.data;
	}
	async function account(email: string) {
		const data = await ok('mutation($input:RegisterInput!){register(input:$input){accessToken user{_id}}}', {
			input: { email, password: 'Review-test-password-123', displayName: 'Review test', phoneNumber: '+821023456789' },
		});
		await ok('mutation($token:String!){verifyEmail(token:$token)}', { token: mail.get(email) });
		return data.register;
	}
	async function reviews() {
		return (await ok('query{myContentReviews{_id kind status updatedAt preview reason}}', {}, creator.accessToken))
			.myContentReviews;
	}
	async function decide(review: any, approve: boolean, reason?: string) {
		return ok(
			'mutation($id:ID!,$approve:Boolean!,$revision:DateTime!,$reason:String){adminDecideContentReview(id:$id,approve:$approve,revision:$revision,reason:$reason){status reason}}',
			{ id: review._id, approve, revision: review.updatedAt, reason },
			admin.accessToken,
		);
	}
	beforeAll(async () => {
		mongo = await MongoMemoryReplSet.create({
			replSet: { count: 1, storageEngine: 'wiredTiger' },
			binary: { version: '7.0.24', systemBinary: process.env.MONGOMS_SYSTEM_BINARY },
		});
		process.env.NODE_ENV = 'test';
		process.env.MONGO_DEV = mongo.getUri('review_test');
		process.env.JWT_SECRET = 'test-review-secret-over-thirty-two-characters';
		process.env.MEDIA_BASE_URL = 'https://media.example.com/creatorhub';
		delete process.env.MAIL_WEBHOOK_URL;
		delete process.env.DISCOVERY_PARSER_URL;
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
		creator = await account('review-creator@example.com');
		admin = await account('review-admin@example.com');
		outsider = await account('review-outsider@example.com');
		await db.model('User').updateOne({ _id: admin.user._id }, { $set: { role: 'ADMIN' } });
		const category = await db.model('Category').create({ name: 'Design', slug: 'design', isActive: true });
		categoryId = String(category._id);
	}, 180000);
	afterAll(async () => {
		if (app) await app.close();
		if (mongo) await mongo.stop();
	});

	it('keeps new profiles private until an admin approves, and protects review data', async () => {
		const data = await ok(
			'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id}}',
			{
				input: { slug: 'review-studio', headline: 'Korean design studio', city: 'gwangju', categoryIds: [categoryId] },
			},
			creator.accessToken,
		);
		profileId = data.createCreatorProfile._id;
		const submitted = await ok('mutation{setCreatorProfileStatus(status:PUBLISHED){status}}', {}, creator.accessToken);
		expect(submitted.setCreatorProfileStatus.status).toBe('DRAFT');
		expect((await gql('query{creator(slug:"review-studio"){_id}}')).errors).toBeDefined();
		const [review] = await reviews();
		expect(review.status).toBe('PENDING');
		expect((await gql('query{adminPendingContentReviewCount}')).errors).toBeDefined();
		expect((await gql('query{adminPendingContentReviewCount}', {}, outsider.accessToken)).errors).toBeDefined();
		expect(
			(await ok('query{adminPendingContentReviewCount}', {}, admin.accessToken)).adminPendingContentReviewCount,
		).toBe(1);
		await ok('mutation{setCreatorProfileStatus(status:PUBLISHED){status}}', {}, creator.accessToken);
		expect(
			(await ok('query{adminPendingContentReviewCount}', {}, admin.accessToken)).adminPendingContentReviewCount,
		).toBe(1);
		const [resubmitted] = await reviews();
		Object.assign(review, resubmitted);
		expect((await gql('query{adminContentReviews{_id}}', {}, outsider.accessToken)).errors).toBeDefined();
		expect((await ok('query{myContentReviews{_id}}', {}, outsider.accessToken)).myContentReviews).toEqual([]);
		expect(
			(
				await gql(
					'mutation($id:ID!,$revision:DateTime!){adminDecideContentReview(id:$id,approve:true,revision:$revision){status}}',
					{ id: review._id, revision: review.updatedAt },
					creator.accessToken,
				)
			).errors,
		).toBeDefined();
		await decide(review, true);
		expect(
			(await ok('query{adminPendingContentReviewCount}', {}, admin.accessToken)).adminPendingContentReviewCount,
		).toBe(0);
		expect((await ok('query{creator(slug:"review-studio"){city}}')).creator.city).toBe('gwangju');
		expect((await ok('query{me{role}}', {}, creator.accessToken)).me.role).toBe('CREATOR');
	});

	it('retains the approved profile while edits wait and exposes a rejection reason to its owner', async () => {
		await ok(
			'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){headline}}',
			{ input: { headline: 'Pending replacement' } },
			creator.accessToken,
		);
		expect((await ok('query{creator(slug:"review-studio"){headline}}')).creator.headline).toBe('Korean design studio');
		const [review] = await reviews();
		expect(JSON.parse(review.preview).headline).toBe('Pending replacement');
		expect(
			(
				await gql(
					'mutation($id:ID!,$revision:DateTime!){adminDecideContentReview(id:$id,approve:false,revision:$revision){status}}',
					{ id: review._id, revision: review.updatedAt },
					admin.accessToken,
				)
			).errors,
		).toBeDefined();
		await decide(review, false, 'Please revise the submitted content.');
		expect(
			(await ok('query{adminPendingContentReviewCount}', {}, admin.accessToken)).adminPendingContentReviewCount,
		).toBe(0);
		expect((await reviews())[0].reason).toContain('Please revise');
		expect((await ok('query{creator(slug:"review-studio"){headline}}')).creator.headline).toBe('Korean design studio');
	});

	it('requires approval for projects and services, and keeps published edits private', async () => {
		const url = `https://media.example.com/creatorhub/${creator.user._id}/sample.png`;
		const project = await ok(
			'mutation($input:CreateProjectInput!){createProject(input:$input){_id}}',
			{
				input: {
					title: 'Original project',
					slug: 'review-project',
					categoryId,
					description: 'A reviewed creative project.',
					coverImageUrl: url,
					media: [{ type: 'IMAGE', url, altText: 'Sample work', sortOrder: 0 }],
				},
			},
			creator.accessToken,
		);
		projectId = project.createProject._id;
		await ok(
			'mutation($id:ID!){setProjectStatus(projectId:$id,status:PUBLISHED){status}}',
			{ id: projectId },
			creator.accessToken,
		);
		expect((await gql('query($id:ID!){getProject(projectId:$id){_id}}', { id: projectId })).errors).toBeDefined();
		await decide(
			(await reviews()).find((review: any) => review.kind === 'PROJECT'),
			true,
		);
		await ok(
			'mutation($id:ID!,$input:UpdateProjectInput!){updateProject(projectId:$id,input:$input){title}}',
			{ id: projectId, input: { title: 'Pending project title' } },
			creator.accessToken,
		);
		expect((await ok('query($id:ID!){getProject(projectId:$id){title}}', { id: projectId })).getProject.title).toBe(
			'Original project',
		);
		await decide(
			(await reviews()).find((review: any) => review.kind === 'PROJECT'),
			true,
		);
		expect((await ok('query($id:ID!){getProject(projectId:$id){title}}', { id: projectId })).getProject.title).toBe(
			'Pending project title',
		);
		const service = await ok(
			'mutation($input:CreateServiceInput!){createService(input:$input){_id}}',
			{
				input: {
					title: 'Design service',
					categoryId,
					description: 'Design work',
					pricingType: 'CUSTOM_QUOTE',
					deliverables: ['Design files'],
				},
			},
			creator.accessToken,
		);
		serviceId = service.createService._id;
		await ok(
			'mutation($id:ID!){setServiceStatus(serviceId:$id,status:ACTIVE){status}}',
			{ id: serviceId },
			creator.accessToken,
		);
		expect((await gql('query($id:ID!){getService(serviceId:$id){_id}}', { id: serviceId })).errors).toBeDefined();
		await decide(
			(await reviews()).find((review: any) => review.kind === 'SERVICE'),
			true,
		);
		expect((await ok('query($id:ID!){getService(serviceId:$id){title}}', { id: serviceId })).getService.title).toBe(
			'Design service',
		);
	});

	it('keeps a new service image private until approval and refuses images outside the owner prefix', async () => {
		const own = `https://media.example.com/creatorhub/${creator.user._id}/service-cover.webp`;
		await ok(
			'mutation($id:ID!,$input:UpdateServiceInput!){updateService(serviceId:$id,input:$input){imageUrl}}',
			{ id: serviceId, input: { imageUrl: own } },
			creator.accessToken,
		);
		expect(
			(await ok('query($id:ID!){getService(serviceId:$id){imageUrl}}', { id: serviceId })).getService.imageUrl,
		).toBe(null);
		const pending = (await reviews()).find((review: any) => review.kind === 'SERVICE');
		expect(JSON.parse(pending.preview).imageUrl).toBe(own);
		await decide(pending, true);
		expect(
			(await ok('query($id:ID!){getService(serviceId:$id){imageUrl}}', { id: serviceId })).getService.imageUrl,
		).toBe(own);
		// Approval re-checks ownership, so a borrowed storage prefix cannot be published.
		await ok(
			'mutation($id:ID!,$input:UpdateServiceInput!){updateService(serviceId:$id,input:$input){imageUrl}}',
			{ id: serviceId, input: { imageUrl: `https://media.example.com/creatorhub/${outsider.user._id}/stolen.webp` } },
			creator.accessToken,
		);
		const borrowed = (await reviews()).find((review: any) => review.kind === 'SERVICE');
		expect(
			(
				await gql(
					'mutation($id:ID!,$revision:DateTime!){adminDecideContentReview(id:$id,approve:true,revision:$revision){status}}',
					{ id: borrowed._id, revision: borrowed.updatedAt },
					admin.accessToken,
				)
			).errors,
		).toBeDefined();
		expect(
			(await ok('query($id:ID!){getService(serviceId:$id){imageUrl}}', { id: serviceId })).getService.imageUrl,
		).toBe(own);
	});

	it('rejects stale approval after a draft was edited or removed', async () => {
		await ok(
			'mutation($id:ID!){setServiceStatus(serviceId:$id,status:PAUSED){status}}',
			{ id: serviceId },
			creator.accessToken,
		);
		await ok(
			'mutation($id:ID!){setServiceStatus(serviceId:$id,status:ACTIVE){status}}',
			{ id: serviceId },
			creator.accessToken,
		);
		const review = (await reviews()).find((review: any) => review.kind === 'SERVICE');
		await ok(
			'mutation($id:ID!,$input:UpdateServiceInput!){updateService(serviceId:$id,input:$input){title}}',
			{ id: serviceId, input: { title: 'Changed paused draft' } },
			creator.accessToken,
		);
		expect(
			(
				await gql(
					'mutation($id:ID!,$revision:DateTime!){adminDecideContentReview(id:$id,approve:true,revision:$revision){status}}',
					{ id: review._id, revision: review.updatedAt },
					admin.accessToken,
				)
			).errors,
		).toBeDefined();
		await ok('mutation($id:ID!){deleteService(serviceId:$id)}', { id: serviceId }, creator.accessToken);
		expect(
			(
				await gql(
					'mutation($id:ID!,$revision:DateTime!){adminDecideContentReview(id:$id,approve:true,revision:$revision){status}}',
					{ id: review._id, revision: review.updatedAt },
					admin.accessToken,
				)
			).errors,
		).toBeDefined();
	});

	it('limits public discovery and creator inputs to Korean cities', async () => {
		const cities = (await ok('query{getCities{key}}')).getCities;
		expect(cities.some((city: any) => city.key === 'gwangju')).toBe(true);
		expect(cities.some((city: any) => city.key === 'london')).toBe(false);
		expect(
			(
				await gql(
					'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){city}}',
					{ input: { city: 'london' } },
					creator.accessToken,
				)
			).errors,
		).toBeDefined();
		await db.model('CreatorProfile').updateOne({ _id: profileId }, { $set: { city: 'london' } });
		expect((await gql('query{creator(slug:"review-studio"){_id}}')).errors).toBeDefined();
		expect((await ok('query{getProjects(input:{}){list{_id}}}')).getProjects.list).toEqual([]);
	});
	it('counts all pending submissions beyond the queue limit and excludes reviewed submissions', async () => {
		const baseline = (await ok('query{adminPendingContentReviewCount}', {}, admin.accessToken))
			.adminPendingContentReviewCount;
		const ids = Array.from({ length: 105 }, () => new Types.ObjectId());
		try {
			await db.model('ContentReview').insertMany(
				ids.map((_id, index) => ({
					_id,
					kind: 'PROFILE',
					targetId: new Types.ObjectId(),
					ownerId: creator.user._id,
					title: 'Disposable count fixture',
					snapshot: { headline: 'Count fixture' },
					baseUpdatedAt: new Date(),
					status: index < 103 ? 'PENDING' : index === 103 ? 'APPROVED' : 'REJECTED',
				})),
			);
			expect(
				(await ok('query{adminPendingContentReviewCount}', {}, admin.accessToken)).adminPendingContentReviewCount,
			).toBe(baseline + 103);
			expect((await ok('query{adminContentReviews{_id}}', {}, admin.accessToken)).adminContentReviews).toHaveLength(
				100,
			);
		} finally {
			await db.model('ContentReview').deleteMany({ _id: { $in: ids } });
		}
	});
});
