import { LoggingInterceptor } from '../src/libs/interceptors/logging.interceptor';
import { configureUploads } from '../src/components/upload/upload.middleware';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Connection, Types } from 'mongoose';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { SocialAuthService } from '../src/components/auth/social-auth.service';
import { ActivityService } from '../src/components/activity/activity.service';
import { AuthService } from '../src/components/auth/auth.service';
import { MailService } from '../src/components/auth/mail.service';

// Full HTTP/GraphQL tests against a disposable replica set, including real indexes and transactions.
describe('CreatorHub workflow', () => {
	let mongo: MongoMemoryReplSet;
	let app: INestApplication;
	let db: Connection;
	let uploadDirectory: string;
	const mail = new Map<string, string>();
	let creator: any, client: any, outsider: any, admin: any;
	let categoryId: string, creatorId: string, projectId: string, serviceId: string;

	async function gql(query: string, variables: Record<string, unknown> = {}, token?: string) {
		const response = await request(app.getHttpServer())
			.post('/graphql')
			.set('Authorization', token ? `Bearer ${token}` : '')
			.send({ query, variables });
		return response.body;
	}
	async function ok(query: string, variables: Record<string, unknown> = {}, token?: string) {
		const body = await gql(query, variables, token);
		expect(body.errors).toBeUndefined();
		return body.data;
	}
	// Existing workflow fixtures explicitly pass through the new admin publication gate.
	// Moderation behavior itself is exercised in content-review.integration.spec.ts.
	async function approvedFixture(query: string, variables: Record<string, unknown> = {}, token?: string) {
		const data = await ok(query, variables, token);
		const { myContentReviews } = await ok('query{myContentReviews{_id status updatedAt}}', {}, token);
		for (const review of myContentReviews.filter((item: any) => item.status === 'PENDING')) {
			await ok(
				'mutation($id:ID!,$revision:DateTime!){adminDecideContentReview(id:$id,approve:true,revision:$revision){status}}',
				{ id: review._id, revision: review.updatedAt },
				admin.accessToken,
			);
		}
		return data;
	}

	async function account(email: string) {
		const data = await ok(
			'mutation($input:RegisterInput!){register(input:$input){accessToken refreshToken user{_id role}}}',
			{
				input: {
					email,
					password: 'Portfolio-test-password-123',
					displayName: 'Test Account',
					phoneNumber: '+821023456789',
				},
			},
		);
		await ok('mutation($token:String!){verifyEmail(token:$token)}', { token: mail.get(`${email}:EMAIL_VERIFY`) });
		return data.register;
	}
	// Seed historical phone credentials only in this disposable database to exercise migration paths.
	async function legacyPhoneAccount(phoneNumber: string, password: string) {
		const user = await db.model('User').create({ displayName: 'Legacy phone fixture' });
		const auth = app.get(AuthService);
		const identity = await db.model('AuthIdentity').create({
			userId: user._id,
			provider: 'PHONE',
			providerSubject: phoneNumber,
			passwordHash: await auth.hashPassword(password),
		});
		return (auth as any).createSession(user, identity);
	}

	async function draft(extra: Record<string, unknown> = {}) {
		const data = await ok(
			'mutation($input:CreateInquiryInput!){createInquiry(input:$input){_id version status}}',
			{
				input: {
					creatorId,
					subject: 'Brand identity project',
					brief: 'We need a visual identity for a new independent bookstore.',
					...extra,
				},
			},
			client.accessToken,
		);
		return data.createInquiry;
	}
	async function submit(item: any) {
		const data = await ok(
			'mutation($input:InquiryVersionInput!){submitInquiry(input:$input){_id version status serviceSnapshot{title startingPrice} submittedAt}}',
			{ input: { inquiryId: item._id, expectedVersion: item.version } },
			client.accessToken,
		);
		return data.submitInquiry;
	}
	async function message(
		item: any,
		token: string,
		key = randomUUID(),
		body = 'Thank you. Let us discuss the project requirements.',
	) {
		return gql(
			'mutation($input:SendMessageInput!){sendInquiryMessage(input:$input){_id body senderId readAt}}',
			{ input: { inquiryId: item._id, expectedVersion: item.version, clientMessageKey: key, body } },
			token,
		);
	}

	beforeAll(async () => {
		mongo = await MongoMemoryReplSet.create({
			replSet: { count: 1, storageEngine: 'wiredTiger' },
			binary: { version: '7.0.24', downloadDir: '.local/mongodb' },
		});
		process.env.NODE_ENV = 'test';
		process.env.GOOGLE_CLIENT_ID = 'disposable-google-client';
		process.env.TELEGRAM_CLIENT_ID = 'disposable-telegram-client';
		process.env.KAKAO_CLIENT_ID = 'disposable-kakao-client';
		uploadDirectory = await mkdtemp(join(tmpdir(), 'creatorhub-uploads-'));
		process.env.UPLOAD_DIR = uploadDirectory;
		process.env.UPLOAD_BASE_URL = 'http://localhost:7001/uploads';
		process.env.MONGO_DEV = mongo.getUri('creatorhub_test');
		process.env.JWT_SECRET = 'test-only-creatorhub-secret-with-more-than-32-characters';
		process.env.MEDIA_BASE_URL = 'https://media.example.com/creatorhub';
		delete process.env.MAIL_WEBHOOK_URL;
		delete process.env.DISCOVERY_PARSER_URL;
		const { AppModule } = jest.requireActual('../src/app.module');
		const module = await Test.createTestingModule({ imports: [AppModule] })
			.overrideProvider(MailService)
			.useValue({
				sendToken: async (email: string, purpose: string, token: string) => {
					mail.set(`${email}:${purpose}`, token);
				},
			})
			.compile();
		app = module.createNestApplication();
		configureUploads(app);
		app.useGlobalInterceptors(new LoggingInterceptor());
		app.useGlobalPipes(
			new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }),
		);
		await app.init();
		db = app.get(getConnectionToken());
		for (const model of Object.values(db.models)) await model.createIndexes();
		creator = await account('creator@example.com');
		client = await account('client@example.com');
		outsider = await account('outsider@example.com');
		admin = await account('admin@example.com');
		await db.model('User').updateOne({ _id: admin.user._id }, { $set: { role: 'ADMIN' } });
	}, 180000);

	afterAll(async () => {
		if (app) await app.close();
		if (mongo) await mongo.stop();
		if (uploadDirectory) await rm(uploadDirectory, { recursive: true, force: true });
	});

	it('normalizes email, reserves it, and rejects role injection and null input fields', async () => {
		const duplicate = await gql('mutation($input:RegisterInput!){register(input:$input){accessToken}}', {
			input: {
				email: '  CLIENT@EXAMPLE.COM ',
				password: 'Portfolio-test-password-123',
				displayName: 'Duplicate',
				phoneNumber: '+821023456789',
			},
		});
		expect(duplicate.errors).toBeDefined();
		const elevated = await gql('mutation($input:RegisterInput!){register(input:$input){accessToken}}', {
			input: {
				email: 'attack@example.com',
				password: 'Portfolio-test-password-123',
				displayName: 'Attack',
				phoneNumber: '+821023456789',
				role: 'ADMIN',
			},
		});
		expect(elevated.errors).toBeDefined();
		const nullInput = await gql(
			'mutation($input:UpdateUserInput!){updateMe(input:$input){displayName}}',
			{ input: { displayName: null } },
			client.accessToken,
		);
		expect(nullInput.errors).toBeDefined();
	});

	it('requires a valid private contact phone at email signup and blocks phone authentication', async () => {
		const operation = 'mutation($input:RegisterInput!){register(input:$input){accessToken user{_id}}}';
		const input = { email: 'contact@example.com', password: 'Contact-password-123', displayName: 'Contact member' };
		for (const phoneNumber of [undefined, '', '01023456789', '+8210invalid']) {
			expect((await gql(operation, { input: { ...input, phoneNumber } })).errors).toBeDefined();
		}
		const member = (await ok(operation, { input: { ...input, phoneNumber: '+82 (10) 2345-6789' } })).register;
		const user = await db.model('User').findById(member.user._id).select('+phoneNumber');
		expect(user.phoneNumber).toBe('+821023456789');
		expect((await db.model('User').findById(user._id)).phoneNumber).toBeUndefined();
		expect(await db.model('AuthIdentity').countDocuments({ userId: user._id, provider: 'PHONE' })).toBe(0);
		expect((await gql('query{me{phoneNumber}}', {}, member.accessToken)).errors).toBeDefined();
		expect(
			(
				await gql('mutation($input:PhoneRegisterInput!){registerPhone(input:$input){accessToken}}', {
					input: { phoneNumber: '+821023456789', password: input.password, displayName: input.displayName },
				})
			).errors[0].message,
		).toContain('Phone signup is unavailable');
		await ok('mutation($token:String!){verifyEmail(token:$token)}', {
			token: mail.get('contact@example.com:EMAIL_VERIFY'),
		});
		await ok('mutation($input:LoginInput!){login(input:$input){user{_id}}}', {
			input: { email: input.email, password: input.password },
		});
		const legacy = await legacyPhoneAccount('+821011112222', input.password);
		expect(
			(
				await gql('mutation($input:PhoneLoginInput!){loginPhone(input:$input){accessToken}}', {
					input: { phoneNumber: '+821011112222', password: input.password },
				})
			).errors[0].message,
		).toContain('Phone login is unavailable');
		// A legacy phone identity must not allow removal of the last verified email.
		await db
			.model('AuthIdentity')
			.create({ userId: member.user._id, provider: 'PHONE', providerSubject: '+821022223333', passwordHash: 'unused' });
		const email = await db.model('AuthIdentity').findOne({ userId: member.user._id, provider: 'EMAIL' });
		expect(
			(
				await gql(
					'mutation($id:ID!){unlinkAuthIdentity(authIdentityId:$id)}',
					{ id: String(email._id) },
					member.accessToken,
				)
			).errors,
		).toBeDefined();
		expect(legacy.user._id).toBeDefined();
	});

	it('links methods to one account, rejects collisions, and preserves a usable method during unlinking', async () => {
		const linked = await account('linked@example.com');
		const query = 'query{getMyAuthIdentities{_id provider providerSubject verifiedAt}}';
		const identities = (await ok(query, {}, linked.accessToken)).getMyAuthIdentities;
		const emailId = identities[0]._id;
		expect(
			(await gql('mutation($id:ID!){unlinkAuthIdentity(authIdentityId:$id)}', { id: emailId }, linked.accessToken))
				.errors,
		).toBeDefined();
		const phone = await gql(
			'mutation($input:LinkPhoneInput!){linkPhone(input:$input){_id}}',
			{ input: { phoneNumber: '+821055556666', password: 'Linked-phone-password-123' } },
			linked.accessToken,
		);
		expect(phone.errors[0].message).toContain('cannot be linked for login');
		const social = await db.model('AuthIdentity').create({
			userId: linked.user._id,
			provider: 'GOOGLE',
			providerSubject: 'unlink-fixture',
			verifiedAt: new Date(),
		});

		const removals = await Promise.all([
			gql('mutation($id:ID!){unlinkAuthIdentity(authIdentityId:$id)}', { id: emailId }, linked.accessToken),
			gql('mutation($id:ID!){unlinkAuthIdentity(authIdentityId:$id)}', { id: social._id }, linked.accessToken),
		]);
		expect(removals.filter((result) => !result.errors)).toHaveLength(1);
		expect(
			await db.model('AuthIdentity').countDocuments({ userId: linked.user._id, revokedAt: { $exists: false } }),
		).toBe(1);
		const removed = await db.model('AuthIdentity').findOne({ userId: linked.user._id, revokedAt: { $exists: true } });
		expect(
			await db.model('AuthSession').countDocuments({ authIdentityId: removed._id, revokedAt: { $exists: false } }),
		).toBe(0);
	});

	it('keeps one email and rejects adding or removing an email even with a social login', async () => {
		const member = await account('single-email@example.com');
		await db.model('AuthIdentity').create({
			userId: member.user._id,
			provider: 'GOOGLE',
			providerSubject: 'single-email-social',
			verifiedAt: new Date(),
		});
		const identity = await db.model('AuthIdentity').findOne({ userId: member.user._id, provider: 'EMAIL' });
		for (const email of ['single-email@example.com', 'second-email@example.com']) {
			expect(
				(
					await gql(
						'mutation($input:LinkEmailInput!){linkEmail(input:$input){_id}}',
						{ input: { email, password: 'Second-password-123' } },
						member.accessToken,
					)
				).errors[0].message,
			).toContain('Use Change email');
		}
		expect(
			(
				await gql(
					'mutation($id:ID!){unlinkAuthIdentity(authIdentityId:$id)}',
					{ id: String(identity._id) },
					member.accessToken,
				)
			).errors[0].message,
		).toContain('Use Change email');
		expect(await db.model('AuthIdentity').countDocuments({ userId: member.user._id, provider: 'EMAIL' })).toBe(1);
	});

	it('requires authentication, a recent session and the correct current password to request an email change', async () => {
		const member = await account('email-change-guards@example.com');
		const mutation = 'mutation($input:ChangeEmailInput!){requestEmailChange(input:$input)}';
		const input = { email: 'replacement-guards@example.com', currentPassword: 'Portfolio-test-password-123' };
		expect((await gql(mutation, { input })).errors).toBeDefined();
		expect(
			(await gql(mutation, { input: { ...input, currentPassword: 'wrong' } }, member.accessToken)).errors[0].message,
		).toBe('Current password is incorrect');
		expect(
			(await gql(mutation, { input: { ...input, email: 'client@example.com' } }, member.accessToken)).errors[0].message,
		).toContain('already belongs');
		expect(
			(await gql(mutation, { input: { ...input, email: 'email-change-guards@example.com' } }, member.accessToken))
				.errors[0].message,
		).toContain('different email');
		await db
			.model('AuthSession')
			.collection.updateMany(
				{ userId: new Types.ObjectId(member.user._id) },
				{ $set: { createdAt: new Date(Date.now() - 11 * 60000) } },
			);
		expect((await gql(mutation, { input }, member.accessToken)).errors[0].message).toContain('Sign in again');
		expect(mail.has('replacement-guards@example.com:EMAIL_CHANGE')).toBe(false);
	});

	it('changes the same email identity only on confirmation and revokes sessions and old reset tokens', async () => {
		const email = 'email-change-original@example.com';
		const replacement = 'email-change-new@example.com';
		const member = await account(email);
		const identity = await db.model('AuthIdentity').findOne({ userId: member.user._id, provider: 'EMAIL' });
		await ok('mutation($input:EmailInput!){requestPasswordReset(input:$input)}', { input: { email } });
		const reset = mail.get(`${email}:PASSWORD_RESET`);
		await ok(
			'mutation($input:ChangeEmailInput!){requestEmailChange(input:$input)}',
			{ input: { email: '  EMAIL-CHANGE-NEW@EXAMPLE.COM ', currentPassword: 'Portfolio-test-password-123' } },
			member.accessToken,
		);
		expect((await db.model('AuthIdentity').findById(identity._id)).providerSubject).toBe(email);
		const otherSession = (
			await ok('mutation($input:LoginInput!){login(input:$input){accessToken refreshToken}}', {
				input: { email, password: 'Portfolio-test-password-123' },
			})
		).login;
		const token = mail.get(`${replacement}:EMAIL_CHANGE`);
		expect(
			(
				await gql('mutation($input:ResetPasswordInput!){resetPassword(input:$input)}', {
					input: { token, password: 'Invalid-reset-password-123' },
				})
			).errors,
		).toBeDefined();
		await ok('mutation($token:String!){verifyEmail(token:$token)}', { token });
		// A login started before confirmation cannot create a fresh session using the stale email.
		const user = await db.model('User').findById(member.user._id);
		await expect((app.get(AuthService) as any).createSession(user, identity)).rejects.toThrow('Login method changed');
		const changed = await db.model('AuthIdentity').findById(identity._id);
		expect(changed.providerSubject).toBe(replacement);
		expect(String(changed.userId)).toBe(member.user._id);
		expect(await db.model('AuthIdentity').countDocuments({ userId: member.user._id, provider: 'EMAIL' })).toBe(1);
		for (const session of [member, otherSession]) {
			expect((await gql('query{getMyAuthIdentities{_id}}', {}, session.accessToken)).errors).toBeDefined();
			expect(
				(
					await gql('mutation($token:String!){refreshSession(refreshToken:$token){accessToken}}', {
						token: session.refreshToken,
					})
				).errors,
			).toBeDefined();
		}
		expect(
			(
				await gql('mutation($input:ResetPasswordInput!){resetPassword(input:$input)}', {
					input: { token: reset, password: 'Invalid-reset-password-123' },
				})
			).errors,
		).toBeDefined();
		expect((await gql('mutation($token:String!){verifyEmail(token:$token)}', { token })).errors).toBeDefined();
		expect(
			(
				await gql('mutation($input:LoginInput!){login(input:$input){accessToken}}', {
					input: { email, password: 'Portfolio-test-password-123' },
				})
			).errors,
		).toBeDefined();
		await ok('mutation($input:LoginInput!){login(input:$input){user{_id}}}', {
			input: { email: replacement, password: 'Portfolio-test-password-123' },
		});
	});

	it('rejects superseded, expired and newly occupied replacement links without changing the original email', async () => {
		const email = 'email-change-recovery@example.com';
		const member = await account(email);
		const mutation = 'mutation($input:ChangeEmailInput!){requestEmailChange(input:$input)}';
		const requestChange = (replacement: string) =>
			ok(
				mutation,
				{ input: { email: replacement, currentPassword: 'Portfolio-test-password-123' } },
				member.accessToken,
			);
		const verify = (token: string) => gql('mutation($token:String!){verifyEmail(token:$token)}', { token });
		await requestChange('email-change-first@example.com');
		const first = mail.get('email-change-first@example.com:EMAIL_CHANGE')!;
		await requestChange('email-change-expired@example.com');
		expect((await verify(first)).errors).toBeDefined();
		await db
			.model('AuthToken')
			.updateMany(
				{ purpose: 'EMAIL_CHANGE', revokedAt: { $exists: false } },
				{ $set: { expiresAt: new Date(Date.now() - 1000) } },
			);
		expect((await verify(mail.get('email-change-expired@example.com:EMAIL_CHANGE')!)).errors).toBeDefined();
		await requestChange('email-change-occupied@example.com');
		await account('email-change-occupied@example.com');
		expect((await verify(mail.get('email-change-occupied@example.com:EMAIL_CHANGE')!)).errors[0].message).toContain(
			'already belongs',
		);
		expect(
			(await db.model('AuthIdentity').findOne({ userId: member.user._id, provider: 'EMAIL' })).providerSubject,
		).toBe(email);
		await ok('query{getMyAuthIdentities{_id}}', {}, member.accessToken);
	});

	it('changes an email password only after owner and current-password checks, revoking all sessions and tokens', async () => {
		const email = 'password-change@example.com';
		const oldPassword = 'Portfolio-test-password-123';
		const newPassword = 'Changed-email-password-456';
		const member = await account(email);
		const second = (
			await ok('mutation($input:LoginInput!){login(input:$input){accessToken refreshToken}}', {
				input: { email, password: oldPassword },
			})
		).login;
		const identity = await db.model('AuthIdentity').findOne({ userId: member.user._id });
		const mutation = 'mutation($input:ChangePasswordInput!){changePassword(input:$input)}';
		const input = { authIdentityId: String(identity._id), currentPassword: oldPassword, password: newPassword };
		expect((await gql(mutation, { input })).errors).toBeDefined();
		expect((await gql(mutation, { input }, outsider.accessToken)).errors).toBeDefined();
		expect(
			(await gql(mutation, { input: { ...input, currentPassword: 'wrong-password' } }, member.accessToken)).errors[0]
				.message,
		).toBe('Current password is incorrect');
		expect((await gql(mutation, { input: { ...input, password: 'short' } }, member.accessToken)).errors).toBeDefined();
		expect(
			(await gql(mutation, { input: { ...input, password: oldPassword } }, member.accessToken)).errors,
		).toBeDefined();
		expect((await ok('query{me{_id}}', {}, second.accessToken)).me._id).toBe(member.user._id);
		await ok('mutation($input:EmailInput!){requestPasswordReset(input:$input)}', { input: { email } });
		const resetToken = mail.get(`${email}:PASSWORD_RESET`);
		expect((await ok(mutation, { input }, member.accessToken)).changePassword).toBe(true);
		for (const login of [member, second]) {
			expect((await gql('query{me{_id}}', {}, login.accessToken)).errors).toBeDefined();
			expect(
				(
					await gql('mutation($token:String!){refreshSession(refreshToken:$token){accessToken}}', {
						token: login.refreshToken,
					})
				).errors,
			).toBeDefined();
		}
		expect(
			(
				await gql('mutation($input:ResetPasswordInput!){resetPassword(input:$input)}', {
					input: { token: resetToken, password: 'Reset-after-change-password-1' },
				})
			).errors,
		).toBeDefined();
		expect(
			(
				await gql('mutation($input:LoginInput!){login(input:$input){accessToken}}', {
					input: { email, password: oldPassword },
				})
			).errors,
		).toBeDefined();
		expect(
			(
				await ok('mutation($input:LoginInput!){login(input:$input){user{_id}}}', {
					input: { email, password: newPassword },
				})
			).login.user._id,
		).toBe(member.user._id);
	});

	it('lets a phone-only account change its own password without another linked method', async () => {
		const phoneNumber = '+821099998877';
		const oldPassword = 'Phone-current-password-123';
		const newPassword = 'Phone-new-password-456';
		const member = await legacyPhoneAccount(phoneNumber, oldPassword);
		const identity = await db.model('AuthIdentity').findOne({ userId: member.user._id });
		await ok(
			'mutation($input:ChangePasswordInput!){changePassword(input:$input)}',
			{
				input: { authIdentityId: String(identity._id), currentPassword: oldPassword, password: newPassword },
			},
			member.accessToken,
		);
		expect((await gql('query{me{_id}}', {}, member.accessToken)).errors).toBeDefined();
		expect(
			(
				await gql('mutation($input:PhoneLoginInput!){loginPhone(input:$input){accessToken}}', {
					input: { phoneNumber, password: oldPassword },
				})
			).errors,
		).toBeDefined();
		expect(
			(
				await gql('mutation($input:PhoneLoginInput!){loginPhone(input:$input){user{_id}}}', {
					input: { phoneNumber, password: newPassword },
				})
			).errors,
		).toBeDefined();
	});

	it('does not change social, pending or revoked identities through the password-change API', async () => {
		const member = await account('password-protected-identities@example.com');
		const social = await db.model('AuthIdentity').create({
			userId: member.user._id,
			provider: 'GOOGLE',
			providerSubject: 'password-test-google-subject',
			verifiedAt: new Date(),
		});
		const pendingOwner = await legacyPhoneAccount('+821099996655', 'Phone-pending-owner-123');
		const pending = (
			await ok(
				'mutation($input:LinkEmailInput!){linkEmail(input:$input){_id}}',
				{ input: { email: 'pending-password@example.com', password: 'Pending-password-123' } },
				pendingOwner.accessToken,
			)
		).linkEmail;
		const revoked = await db.model('AuthIdentity').create({
			userId: member.user._id,
			provider: 'PHONE',
			providerSubject: '+821099997766',
			passwordHash: 'unused-hash',
			revokedAt: new Date(),
		});
		for (const identity of [social, pending, revoked]) {
			expect(
				(
					await gql(
						'mutation($input:ChangePasswordInput!){changePassword(input:$input)}',
						{
							input: {
								authIdentityId: String(identity._id),
								currentPassword: 'Pending-password-123',
								password: 'Replacement-password-456',
							},
						},
						identity === pending ? pendingOwner.accessToken : member.accessToken,
					)
				).errors,
			).toBeDefined();
		}
		expect((await ok('query{me{_id}}', {}, member.accessToken)).me._id).toBe(member.user._id);
		expect((await db.model('AuthIdentity').findById(social._id).select('+passwordHash')).passwordHash).toBeUndefined();
	});

	it('accepts only one concurrent password change with the same old credential and session', async () => {
		const member = await account('concurrent-password@example.com');
		const identity = await db.model('AuthIdentity').findOne({ userId: member.user._id });
		const mutation = 'mutation($input:ChangePasswordInput!){changePassword(input:$input)}';
		const results = await Promise.all(
			['Concurrent-new-password-1', 'Concurrent-new-password-2'].map((password) =>
				gql(
					mutation,
					{
						input: { authIdentityId: String(identity._id), currentPassword: 'Portfolio-test-password-123', password },
					},
					member.accessToken,
				),
			),
		);
		expect(results.filter((result) => result.data?.changePassword === true)).toHaveLength(1);
		expect(results.filter((result) => result.errors)).toHaveLength(1);
	});

	it('requires confirmation of linked email and does not count pending email as a usable method', async () => {
		const phone = await legacyPhoneAccount('+821066667777', 'Phone-only-password-123');
		const linked = await ok(
			'mutation($input:LinkEmailInput!){linkEmail(input:$input){_id verifiedAt}}',
			{ input: { email: 'phone-linked@example.com', password: 'Email-link-password-123' } },
			phone.accessToken,
		);
		expect(linked.linkEmail.verifiedAt).toBeNull();
		const identity = await db.model('AuthIdentity').findOne({ userId: phone.user._id, provider: 'PHONE' });
		expect(
			(
				await gql(
					'mutation($id:ID!){unlinkAuthIdentity(authIdentityId:$id)}',
					{ id: String(identity._id) },
					phone.accessToken,
				)
			).errors,
		).toBeDefined();
		expect(
			(
				await gql('mutation($input:LoginInput!){login(input:$input){accessToken}}', {
					input: { email: 'phone-linked@example.com', password: 'Email-link-password-123' },
				})
			).errors,
		).toBeDefined();
		await ok('mutation($token:String!){verifyEmail(token:$token)}', {
			token: mail.get('phone-linked@example.com:EMAIL_VERIFY'),
		});
		const email = (
			await ok('mutation($input:LoginInput!){login(input:$input){accessToken user{_id}}}', {
				input: { email: 'phone-linked@example.com', password: 'Email-link-password-123' },
			})
		).login;
		expect(email.user._id).toBe(String(phone.user._id));
		await ok(
			'mutation($input:ChangePhonePasswordInput!){changePhonePassword(input:$input)}',
			{ input: { password: 'Changed-phone-password-123' } },
			email.accessToken,
		);
		expect((await gql('query{me{_id}}', {}, phone.accessToken)).errors).toBeDefined();
		expect(
			(
				await gql('mutation($input:PhoneLoginInput!){loginPhone(input:$input){accessToken}}', {
					input: { phoneNumber: '+821066667777', password: 'Changed-phone-password-123' },
				})
			).errors,
		).toBeDefined();
	});

	it('routes verified social subjects to one account without creating local credentials', async () => {
		const verifier = jest.spyOn(app.get(SocialAuthService), 'verify').mockResolvedValue('verified-social-subject');
		try {
			const operation = 'mutation($input:SocialLoginInput!){loginSocial(input:$input){accessToken user{_id role}}}';
			const input = {
				provider: 'GOOGLE',
				nonce: 'a'.repeat(64),
				idToken: 'fixture-proof-verified-by-unit-tests',
				displayName: 'Social Member',
				phoneNumber: '+821023456789',
			};
			const { phoneNumber: _missing, ...missingContact } = input;
			expect((await gql(operation, { input: missingContact })).errors).toBeDefined();
			const first = (await ok(operation, { input })).loginSocial;
			const { phoneNumber: _contact, ...loginInput } = input;
			const second = (await ok(operation, { input: loginInput })).loginSocial;
			expect(first.user._id).toBe(second.user._id);
			expect(first.user.role).toBe('USER');
			const identity = await db.model('AuthIdentity').findOne({ userId: first.user._id }).select('+passwordHash');
			expect(identity.providerSubject).toBe('verified-social-subject');
			expect(identity.passwordHash).toBeUndefined();
			expect(identity.verifiedAt).toBeDefined();
			await ok('query{me{_id}}', {}, first.accessToken);
		} finally {
			verifier.mockRestore();
		}
	});

	it('completes Google signup with a private contact number, then logs into the same account without onboarding', async () => {
		const social = app.get(SocialAuthService);
		const verifier = jest
			.spyOn(social, 'verifyProfile')
			.mockResolvedValue({ subject: 'google-onboarding-fixture', displayName: 'Google Member' });
		const login =
			'mutation($input:GoogleLoginInput!){loginGoogle(input:$input){signupToken displayName session{accessToken user{_id role}}}}';
		const input = { nonce: 'a'.repeat(64), idToken: 'signed-fixture' };
		const complete =
			'mutation($input:CompleteGoogleSignupInput!){completeGoogleSignup(input:$input){accessToken refreshToken user{_id displayName role}}}';
		try {
			const first = (await ok(login, { input })).loginGoogle;
			const parallel = (await ok(login, { input })).loginGoogle;
			expect(first.session).toBeNull();
			expect(first.displayName).toBe('Google Member');
			const signup = { signupToken: first.signupToken, displayName: 'Google Member', phoneNumber: '+821023456789' };
			expect(
				(await gql(complete, { input: { signupToken: first.signupToken, displayName: 'Google Member' } })).errors,
			).toBeDefined();
			expect((await gql(complete, { input: { ...signup, phoneNumber: 'invalid' } })).errors).toBeDefined();
			const session = (await ok(complete, { input: signup })).completeGoogleSignup;
			expect(session.user.role).toBe('USER');
			await ok('query{me{_id}}', {}, session.accessToken);
			expect((await db.model('User').findById(session.user._id).select('+phoneNumber')).phoneNumber).toBe(
				signup.phoneNumber,
			);
			expect((await gql(complete, { input: signup })).errors).toBeDefined();
			const duplicate = (await ok(complete, { input: { ...signup, signupToken: parallel.signupToken } }))
				.completeGoogleSignup;
			expect(duplicate.user._id).toBe(session.user._id);
			const returning = (await ok(login, { input })).loginGoogle;
			expect(returning.signupToken).toBeNull();
			expect(returning.session.user._id).toBe(session.user._id);
			const identity = await db.model('AuthIdentity').findOne({ userId: session.user._id }).select('+passwordHash');
			expect(identity.provider).toBe('GOOGLE');
			expect(identity.passwordHash).toBeUndefined();
			await db.model('User').updateOne({ _id: session.user._id }, { $set: { status: 'SUSPENDED' } });
			expect((await gql(login, { input })).errors).toBeDefined();
		} finally {
			verifier.mockRestore();
		}
	});
	it.each(['TELEGRAM', 'KAKAO'])(
		'creates one %s account with private contact details and rejects replay and suspension',
		async (provider) => {
			const social = app.get(SocialAuthService);
			const profile = { subject: `${provider}-fixture`, displayName: `${provider} Member` };
			const verifier = jest
				.spyOn(social, provider === 'TELEGRAM' ? 'verifyProfile' : 'verifyKakaoCode')
				.mockResolvedValue(profile);
			const operation = provider === 'TELEGRAM' ? 'loginTelegram' : 'loginKakao';
			const inputType = provider === 'TELEGRAM' ? 'TelegramLoginInput' : 'KakaoLoginInput';
			const login = `mutation($input:${inputType}!){${operation}(input:$input){signupToken displayName session{accessToken user{_id}}}}`;
			const input =
				provider === 'TELEGRAM'
					? { nonce: 'a'.repeat(64), idToken: 'fixture' }
					: { state: 'a'.repeat(64), code: 'fixture' };
			const complete =
				'mutation($input:CompleteSocialSignupInput!){completeSocialSignup(input:$input){accessToken user{_id role}}}';
			try {
				const first = (await ok(login, { input }))[operation];
				const parallel = (await ok(login, { input }))[operation];
				expect(first.session).toBeNull();
				const signup = {
					provider,
					signupToken: first.signupToken,
					displayName: profile.displayName,
					phoneNumber: '+821023456789',
				};
				expect((await gql(complete, { input: { ...signup, phoneNumber: 'bad' } })).errors).toBeDefined();
				const session = (await ok(complete, { input: signup })).completeSocialSignup;
				await ok('query{me{_id}}', {}, session.accessToken);
				expect(session.user.role).toBe('USER');
				const user = await db.model('User').findById(session.user._id).select('+phoneNumber');
				expect(user.phoneNumber).toBe(signup.phoneNumber);
				const identity = await db.model('AuthIdentity').findOne({ userId: user._id }).select('+passwordHash');
				expect(identity.provider).toBe(provider);
				expect(identity.passwordHash).toBeUndefined();
				expect((await gql(complete, { input: signup })).errors).toBeDefined();
				const duplicate = (await ok(complete, { input: { ...signup, signupToken: parallel.signupToken } }))
					.completeSocialSignup;
				expect(duplicate.user._id).toBe(session.user._id);
				const returning = (await ok(login, { input }))[operation];
				expect(returning.signupToken).toBeNull();
				expect(returning.session.user._id).toBe(session.user._id);
				await db.model('User').updateOne({ _id: user._id }, { $set: { status: 'SUSPENDED' } });
				expect((await gql(login, { input })).errors).toBeDefined();
			} finally {
				verifier.mockRestore();
			}
		},
	);
	it('creates a category and a creator draft, validates publication, and enforces ownership', async () => {
		const category = await ok(
			'mutation($input:CategoryInput!){createCategory(input:$input){_id}}',
			{ input: { slug: 'graphic-design', name: 'Graphic design' } },
			admin.accessToken,
		);
		categoryId = category.createCategory._id;
		const created = await ok(
			'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id status}}',
			{ input: { slug: 'studio-seoul' } },
			creator.accessToken,
		);
		creatorId = created.createCreatorProfile._id;
		for (const operation of [
			'mutation{createProject(input:{title:"Premature",slug:"premature"}){_id}}',
			'mutation{createService(input:{title:"Premature"}){_id}}',
			'query{getMyProjects{list{_id}}}',
			'query{getMyServices{list{_id}}}',
		])
			expect((await gql(operation, {}, creator.accessToken)).errors?.[0].extensions.code).toBe('FORBIDDEN');

		expect(created.createCreatorProfile.status).toBe('DRAFT');
		expect(
			(await gql('mutation{setCreatorProfileStatus(status:PUBLISHED){_id}}', {}, creator.accessToken)).errors,
		).toBeDefined();
		await approvedFixture(
			'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){_id}}',
			{
				input: {
					headline: 'Independent brand designer',
					city: 'seoul',
					remoteAvailable: true,
					categoryIds: [categoryId],
					skills: ['Brand identity'],
				},
			},
			creator.accessToken,
		);
		await approvedFixture(
			'mutation{setCreatorProfileStatus(status:PUBLISHED){status publishedAt}}',
			{},
			creator.accessToken,
		);
		expect((await ok('query{me{role}}', {}, creator.accessToken)).me.role).toBe('CREATOR');
		const repeated = await ok(
			'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id slug}}',
			{ input: { slug: 'second-profile' } },
			creator.accessToken,
		);
		expect(repeated.createCreatorProfile._id).toBe(creatorId);
		expect(repeated.createCreatorProfile.slug).toBe('studio-seoul');
		expect(await db.model('CreatorProfile').countDocuments({ userId: creator.user._id })).toBe(1);

		expect(
			(
				await gql(
					'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){_id}}',
					{ input: { bio: 'I do not own a creator profile' } },
					outsider.accessToken,
				)
			).errors,
		).toBeDefined();
	});

	it('handles concurrent onboarding and refuses to recreate a deleted profile', async () => {
		const person = await account('onboarding-retry@example.com');
		const operation = 'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id}}';
		const results = await Promise.all([
			ok(operation, { input: { slug: 'retry-onboarding' } }, person.accessToken),
			ok(operation, { input: { slug: 'retry-onboarding' } }, person.accessToken),
		]);
		expect(results[0].createCreatorProfile._id).toBe(results[1].createCreatorProfile._id);
		await ok('mutation{deleteCreatorProfile}', {}, person.accessToken);
		expect((await gql(operation, { input: { slug: 'retry-deleted' } }, person.accessToken)).errors?.[0].message).toBe(
			'This creator profile was deleted and cannot be recreated',
		);
	});

	it('uploads local media with ownership, type and path checks', async () => {
		const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
		const upload = async (token: string | undefined, target = 'avatar', bytes = png, mime = 'image/png') =>
			request(app.getHttpServer())
				.post('/graphql')
				.set('Authorization', token ? `Bearer ${token}` : '')
				.set('Apollo-Require-Preflight', 'true')
				.field(
					'operations',
					JSON.stringify({
						query: 'mutation($file:Upload!,$target:String!){imageUploader(file:$file,target:$target)}',
						variables: { file: null, target },
					}),
				)
				.field('map', JSON.stringify({ '0': ['variables.file'] }))
				.attach('0', bytes, { filename: 'example.png', contentType: mime });
		const accepted = await upload(client.accessToken);
		expect(accepted.body.errors).toBeUndefined();
		const url = accepted.body.data.imageUploader;
		expect(url).toContain(`/uploads/${client.user._id}/avatar/`);
		await request(app.getHttpServer()).get(new URL(url).pathname).expect(200);
		await ok(
			'mutation($input:UpdateUserInput!){updateMe(input:$input){avatarUrl}}',
			{ input: { avatarUrl: url } },
			client.accessToken,
		);
		expect(
			(
				await gql(
					'mutation($input:UpdateUserInput!){updateMe(input:$input){avatarUrl}}',
					{ input: { avatarUrl: url } },
					outsider.accessToken,
				)
			).errors,
		).toBeDefined();
		expect((await upload(undefined)).body.errors).toBeDefined();
		expect((await upload(client.accessToken, '../../escape')).body.errors).toBeDefined();
		expect(
			(await upload(client.accessToken, 'avatar', Buffer.from('<script>alert(1)</script>'))).body.errors,
		).toBeDefined();
		expect((await upload(client.accessToken, 'avatar', png, 'text/html')).body.errors).toBeDefined();
		const oversized = await upload(client.accessToken, 'avatar', Buffer.alloc(10_000_001));
		expect(oversized.body.errors).toBeDefined();
		expect(await readdir(join(uploadDirectory, '.pending'))).toEqual([]);
	});

	it('publishes work and services with validated fields and media ownership', async () => {
		const created = await ok(
			'mutation($input:CreateProjectInput!){createProject(input:$input){_id}}',
			{ input: { title: 'Bookstore identity', slug: 'bookstore-identity' } },
			creator.accessToken,
		);
		projectId = created.createProject._id;
		expect(
			(
				await gql(
					'mutation($id:ID!){setProjectStatus(projectId:$id,status:PUBLISHED){_id}}',
					{ id: projectId },
					creator.accessToken,
				)
			).errors,
		).toBeDefined();
		const image = `https://media.example.com/creatorhub/${creator.user._id}/bookstore.webp`;
		await approvedFixture(
			'mutation($id:ID!,$input:UpdateProjectInput!){updateProject(projectId:$id,input:$input){_id}}',
			{
				id: projectId,
				input: {
					categoryId,
					description: 'A complete visual identity for an independent bookstore.',
					coverImageUrl: image,
					media: [{ type: 'IMAGE', url: image, altText: 'Bookstore identity on stationery', sortOrder: 0 }],
					tags: ['Branding'],
				},
			},
			creator.accessToken,
		);
		await approvedFixture(
			'mutation($id:ID!){setProjectStatus(projectId:$id,status:PUBLISHED){status}}',
			{ id: projectId },
			creator.accessToken,
		);
		expect(
			(
				await gql(
					'mutation($id:ID!,$input:UpdateProjectInput!){updateProject(projectId:$id,input:$input){_id}}',
					{ id: projectId, input: { title: 'Stolen edit' } },
					outsider.accessToken,
				)
			).errors,
		).toBeDefined();
		const service = await ok(
			'mutation($input:CreateServiceInput!){createService(input:$input){_id}}',
			{
				input: {
					title: 'Brand identity package',
					categoryId,
					description: 'Research, logo design and brand guidelines.',
					deliverables: ['Logo', 'Brand guidelines'],
					pricingType: 'STARTING_AT',
					startingPrice: 500000,
				},
			},
			creator.accessToken,
		);
		serviceId = service.createService._id;
		await approvedFixture(
			'mutation($id:ID!){setServiceStatus(serviceId:$id,status:ACTIVE){status}}',
			{ id: serviceId },
			creator.accessToken,
		);
	});

	it('returns page totals and empty later pages without exposing draft projects', async () => {
		await ok(
			'mutation{createProject(input:{title:"Private draft",slug:"private-page-draft"}){_id}}',
			{},
			creator.accessToken,
		);
		const operation = 'query($input:DiscoveryInput!){getProjects(input:$input){list{_id} metaCounter{total}}}';
		const first = await ok(operation, { input: { creatorId, page: 1, limit: 1 } });
		expect(first.getProjects.list.map((p: any) => p._id)).toEqual([projectId]);
		expect(first.getProjects.metaCounter).toEqual([{ total: 1 }]);
		const next = await ok(operation, { input: { creatorId, page: 2, limit: 1 } });
		expect(next.getProjects.list).toEqual([]);
		expect(next.getProjects.metaCounter).toEqual([{ total: 1 }]);
		expect((await gql(operation, { input: { page: 0 } })).errors).toBeDefined();
		const own = await ok(
			'query{getMyProjects(input:{page:1,limit:1}){list{_id} metaCounter{total}}}',
			{},
			creator.accessToken,
		);
		expect(own.getMyProjects.list).toHaveLength(1);
		expect(own.getMyProjects.metaCounter).toEqual([{ total: 2 }]);
	});

	it('filters public discovery and provides an explicitly labeled assistant fallback', async () => {
		const result = await ok(
			'query ($input: DiscoveryInput!) {\n  getCreators(input: $input) {\n    list {\n      _id\n      identity {\n        displayName\n      }\n    }\n  }\n  getProjects(input: $input) {\n    list {\n      _id\n    }\n  }\n  getServices(input: $input) {\n    list {\n      _id\n    }\n  }\n}',
			{ input: { city: 'seoul', remoteAvailable: true, categoryId } },
		);
		expect(result.getCreators.list.map((item: any) => item._id)).toContain(creatorId);
		expect(result.getProjects.list.map((item: any) => item._id)).toContain(projectId);
		const assistant = await ok('query($input:AssistantInput!){discoverCreators(input:$input){mode creators{_id}}}', {
			input: { request: '서울 그래픽 디자인 remote' },
		});
		expect(assistant.discoverCreators.mode).toBe('KEYWORD');
		expect(assistant.discoverCreators.creators).toHaveLength(1);
	});

	it('deduplicates concurrent likes and saves, and forbids self-likes', async () => {
		const operation =
			'mutation($id:ID!){setProjectLike(projectId:$id,liked:true) setProjectSaved(projectId:$id,saved:true)}';
		const results = await Promise.all([
			gql(operation, { id: projectId }, client.accessToken),
			gql(operation, { id: projectId }, client.accessToken),
		]);
		results.forEach((result) => expect(result.errors).toBeUndefined());
		expect(await db.model('ProjectLike').countDocuments()).toBe(1);
		expect(await db.model('SavedProject').countDocuments()).toBe(1);
		expect((await gql(operation, { id: projectId }, creator.accessToken)).errors).toBeDefined();
	});

	it('keeps hidden comments hidden after author edits', async () => {
		const result = await ok(
			'mutation($input:CommentInput!){createProjectComment(input:$input){_id}}',
			{ input: { projectId, content: 'A thoughtful identity system.', clientCommentKey: randomUUID() } },
			client.accessToken,
		);
		const id = result.createProjectComment._id;
		await ok('mutation($id:ID!){moderateProjectComment(commentId:$id,hidden:true){status}}', { id }, admin.accessToken);
		const edit = await ok(
			'mutation($id:ID!,$input:EditCommentInput!){editProjectComment(commentId:$id,input:$input){status}}',
			{ id, input: { content: 'Edited comment remains moderated.' } },
			client.accessToken,
		);
		expect(edit.editProjectComment.status).toBe('HIDDEN');
		expect(
			(
				await ok('query ($id: ID!) {\n  getProjectComments(projectId: $id) {\n    list {\n      _id\n    }\n  }\n}', {
					id: projectId,
				})
			).getProjectComments.list,
		).toHaveLength(0);
	});

	it('keeps drafts private, captures a service snapshot, and deduplicates submissions', async () => {
		const item = await draft({ serviceId });
		for (const currentUser of [creator, outsider, admin])
			expect(
				(await gql('query($id:ID!){getInquiry(inquiryId:$id){_id}}', { id: item._id }, currentUser.accessToken)).errors,
			).toBeDefined();
		const sent = await submit(item);
		expect(sent.serviceSnapshot.startingPrice).toBe(500000);
		await submit(item);
		expect(await db.model('InquiryEvent').countDocuments({ inquiryId: item._id })).toBe(1);
		expect(await db.model('Notification').countDocuments()).toBe(1);
		await approvedFixture(
			'mutation($id:ID!,$input:UpdateServiceInput!){updateService(serviceId:$id,input:$input){title}}',
			{ id: serviceId, input: { title: 'Revised package', startingPrice: 700000 } },
			creator.accessToken,
		);
		const stored = await ok(
			'query($id:ID!){getInquiry(inquiryId:$id){serviceSnapshot{title startingPrice}}}',
			{ id: item._id },
			client.accessToken,
		);
		expect(stored.getInquiry.serviceSnapshot.title).toBe('Brand identity package');
		expect(stored.getInquiry.serviceSnapshot.startingPrice).toBe(500000);
	});

	it('records first replies once, rejects conflicting retries, and protects message read receipts', async () => {
		const sent = await submit(await draft());
		const key = randomUUID();
		const responses = await Promise.all([
			message(sent, creator.accessToken, key),
			message(sent, creator.accessToken, key),
		]);
		responses.forEach((result) => expect(result.errors).toBeUndefined());
		expect(responses[0].data.sendInquiryMessage._id).toBe(responses[1].data.sendInquiryMessage._id);
		expect(
			(await message(sent, creator.accessToken, key, 'Different content for the same retry key.')).errors,
		).toBeDefined();
		const stored = await db.model('Inquiry').findById(sent._id);
		expect(stored.status).toBe('IN_DISCUSSION');
		expect(await db.model('InquiryMessage').countDocuments({ inquiryId: sent._id })).toBe(1);
		expect(await db.model('InquiryEvent').countDocuments({ inquiryId: sent._id })).toBe(2);
		const id = responses[0].data.sendInquiryMessage._id;
		expect(
			(await gql('mutation($id:ID!){markInquiryMessageRead(messageId:$id)}', { id }, creator.accessToken)).errors,
		).toBeDefined();
		await ok('mutation($id:ID!){markInquiryMessageRead(messageId:$id)}', { id }, client.accessToken);
		expect((await db.model('InquiryMessage').findById(id)).readAt).toBeInstanceOf(Date);
	});

	it('resolves a message-versus-closure race without partial events', async () => {
		const sent = await submit(await draft());
		const close = gql(
			'mutation($input:CloseInquiryInput!){closeInquiry(input:$input){status}}',
			{ input: { inquiryId: sent._id, expectedVersion: sent.version, outcome: 'NOT_PROCEEDING' } },
			client.accessToken,
		);
		const results = await Promise.all([close, message(sent, creator.accessToken)]);
		expect(results.filter((result) => !result.errors)).toHaveLength(1);
		const item = await db.model('Inquiry').findById(sent._id);
		expect(item.version).toBe(2);
		const events = await db.model('InquiryEvent').find({ inquiryId: sent._id });
		expect(events).toHaveLength(2);
		expect(
			await db.model('Notification').countDocuments({ inquiryEventId: { $in: events.map((event) => event._id) } }),
		).toBe(2);
		if (item.status === 'CLOSED')
			expect(await db.model('InquiryMessage').countDocuments({ inquiryId: sent._id })).toBe(0);
	});

	it('enforces terminal states and seven-day no-response closure', async () => {
		const sent = await submit(await draft());
		const close = 'mutation($input:CloseInquiryInput!){closeInquiry(input:$input){status outcome closedAt closedById}}';
		const input = { inquiryId: sent._id, expectedVersion: sent.version, outcome: 'NO_RESPONSE' };
		expect((await gql(close, { input }, client.accessToken)).errors).toBeDefined();
		await db
			.model('Inquiry')
			.updateOne({ _id: sent._id }, { $set: { submittedAt: new Date(Date.now() - 8 * 86400000) } });
		const result = await ok(close, { input }, client.accessToken);
		expect(result.closeInquiry.status).toBe('CLOSED');
		expect(result.closeInquiry.closedById).toBe(client.user._id);
		expect((await message({ ...sent, version: sent.version + 1 }, creator.accessToken)).errors).toBeDefined();
	});

	it('requires the selected service to belong to the creator at submission', async () => {
		const other = await account('anothercreator@example.com');
		const profile = await ok(
			'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id}}',
			{ input: { slug: 'another-studio', headline: 'Another designer', city: 'busan', categoryIds: [categoryId] } },
			other.accessToken,
		);
		await approvedFixture('mutation{setCreatorProfileStatus(status:PUBLISHED){_id}}', {}, other.accessToken);
		const item = await draft({ creatorId: profile.createCreatorProfile._id, serviceId });
		expect(
			(
				await gql(
					'mutation($input:InquiryVersionInput!){submitInquiry(input:$input){_id}}',
					{ input: { inquiryId: item._id, expectedVersion: 0 } },
					client.accessToken,
				)
			).errors,
		).toBeDefined();
		expect(await db.model('InquiryEvent').countDocuments({ inquiryId: item._id })).toBe(0);
	});

	it('hides saved and direct content while retaining existing conversations', async () => {
		const sent = await submit(await draft());
		await approvedFixture('mutation{setCreatorProfileStatus(status:HIDDEN){status}}', {}, creator.accessToken);
		expect((await gql('query($id:ID!){getProject(projectId:$id){title}}', { id: projectId })).errors).toBeDefined();
		const saved = await ok(
			'{\n  getSavedProjects {\n    list {\n      available\n      project {\n        title\n      }\n    }\n  }\n}',
			{},
			client.accessToken,
		);
		expect(saved.getSavedProjects.list[0].available).toBe(false);
		expect(saved.getSavedProjects.list[0].project).toBeNull();
		expect((await message(sent, creator.accessToken)).errors).toBeUndefined();
		await approvedFixture('mutation{setCreatorProfileStatus(status:PUBLISHED){status}}', {}, creator.accessToken);
	});

	it('rotates refresh tokens, rejects expired reset tokens, and revokes access on logout', async () => {
		const refreshed = await ok(
			'mutation($token:String!){refreshSession(refreshToken:$token){accessToken refreshToken}}',
			{ token: outsider.refreshToken },
		);
		expect(
			(
				await gql('mutation($token:String!){refreshSession(refreshToken:$token){accessToken}}', {
					token: outsider.refreshToken,
				})
			).errors,
		).toBeDefined();
		await ok('mutation($input:EmailInput!){requestPasswordReset(input:$input)}', {
			input: { email: 'outsider@example.com' },
		});
		await db.model('AuthToken').updateMany(
			{
				authIdentityId: (
					await db
						.model('AuthIdentity')
						.findOne({ userId: outsider.user._id, provider: 'EMAIL', revokedAt: { $exists: false } })
				)._id,
				purpose: 'PASSWORD_RESET',
			},
			{ $set: { expiresAt: new Date(Date.now() - 1000) } },
		);
		expect(
			(
				await gql('mutation($input:ResetPasswordInput!){resetPassword(input:$input)}', {
					input: { token: mail.get('outsider@example.com:PASSWORD_RESET'), password: 'A-new-password-for-tests-1' },
				})
			).errors,
		).toBeDefined();
		await ok('mutation{logout}', {}, refreshed.refreshSession.accessToken);
		expect((await gql('query{me{_id}}', {}, refreshed.refreshSession.accessToken)).errors).toBeDefined();
	});

	it('rejects duplicate categories, invalid media ownership, and fractional prices', async () => {
		const duplicateCategories = await gql(
			'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){_id}}',
			{ input: { categoryIds: [categoryId, categoryId] } },
			creator.accessToken,
		);
		expect(duplicateCategories.errors).toBeDefined();
		const media = await gql(
			'mutation($id:ID!,$input:UpdateProjectInput!){updateProject(projectId:$id,input:$input){_id}}',
			{
				id: projectId,
				input: { coverImageUrl: `https://media.example.com/creatorhub/${client.user._id}/stolen.webp` },
			},
			creator.accessToken,
		);
		expect(media.errors).toBeDefined();
		const price = await gql(
			'mutation($id:ID!,$input:UpdateServiceInput!){updateService(serviceId:$id,input:$input){_id}}',
			{ id: serviceId, input: { startingPrice: 1.5 } },
			creator.accessToken,
		);
		expect(price.errors).toBeDefined();
	});

	it('requires verified email for engagement and creator ownership', async () => {
		const registration = await ok('mutation($input:RegisterInput!){register(input:$input){accessToken}}', {
			input: {
				email: 'unverified@example.com',
				password: 'Portfolio-test-password-123',
				displayName: 'Unverified account',
				phoneNumber: '+821023456789',
			},
		});
		const token = registration.register.accessToken;
		expect(
			(await gql('mutation($id:ID!){setProjectLike(projectId:$id,liked:true)}', { id: projectId }, token)).errors,
		).toBeDefined();
		expect(
			(
				await gql(
					'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id}}',
					{ input: { slug: 'unverified-studio' } },
					token,
				)
			).errors,
		).toBeDefined();
	});

	it('versions draft edits without events and freezes the request after submission', async () => {
		const item = await draft();
		const update = await ok(
			'mutation($input:UpdateInquiryInput!){updateInquiry(input:$input){_id version subject}}',
			{ input: { inquiryId: item._id, expectedVersion: 0, subject: 'Revised project brief' } },
			client.accessToken,
		);
		expect(update.updateInquiry.version).toBe(1);
		expect(await db.model('InquiryEvent').countDocuments({ inquiryId: item._id })).toBe(0);
		const sent = await submit(update.updateInquiry);
		expect(sent.version).toBe(2);
		expect(
			(
				await gql(
					'mutation($input:UpdateInquiryInput!){updateInquiry(input:$input){_id}}',
					{ input: { inquiryId: sent._id, expectedVersion: 2, subject: 'Attempt to change original request' } },
					client.accessToken,
				)
			).errors,
		).toBeDefined();
		expect(
			(await gql('query($id:ID!){getInquiry(inquiryId:$id){brief}}', { id: sent._id }, admin.accessToken)).errors,
		).toBeDefined();
	});

	it('rechecks creator availability and paused services at submission', async () => {
		const item = await draft({ serviceId });
		await approvedFixture(
			'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){availability}}',
			{ input: { availability: 'UNAVAILABLE' } },
			creator.accessToken,
		);
		const operation = 'mutation($input:InquiryVersionInput!){submitInquiry(input:$input){_id}}';
		expect(
			(await gql(operation, { input: { inquiryId: item._id, expectedVersion: 0 } }, client.accessToken)).errors,
		).toBeDefined();
		await approvedFixture(
			'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){availability}}',
			{ input: { availability: 'AVAILABLE' } },
			creator.accessToken,
		);
		await approvedFixture(
			'mutation($id:ID!){setServiceStatus(serviceId:$id,status:PAUSED){status}}',
			{ id: serviceId },
			creator.accessToken,
		);
		expect(
			(await gql(operation, { input: { inquiryId: item._id, expectedVersion: 0 } }, client.accessToken)).errors,
		).toBeDefined();
		expect(await db.model('InquiryEvent').countDocuments({ inquiryId: item._id })).toBe(0);
		await approvedFixture(
			'mutation($id:ID!){setServiceStatus(serviceId:$id,status:ACTIVE){status}}',
			{ id: serviceId },
			creator.accessToken,
		);
	});

	it('keeps client follow-ups in SENT and supports cancel and decline without outcomes', async () => {
		const sent = await submit(await draft());
		expect((await message(sent, client.accessToken)).errors).toBeUndefined();
		expect((await db.model('Inquiry').findById(sent._id)).status).toBe('SENT');
		const cancelled = await ok(
			'mutation($input:InquiryVersionInput!){cancelInquiry(input:$input){status outcome closedAt closedById}}',
			{ input: { inquiryId: sent._id, expectedVersion: 2 } },
			client.accessToken,
		);
		expect(cancelled.cancelInquiry.status).toBe('CANCELLED');
		expect(cancelled.cancelInquiry.outcome).toBeNull();
		expect(cancelled.cancelInquiry.closedById).toBe(client.user._id);
		const second = await submit(await draft());
		const declined = await ok(
			'mutation($input:InquiryVersionInput!){declineInquiry(input:$input){status outcome closedAt}}',
			{ input: { inquiryId: second._id, expectedVersion: 1 } },
			creator.accessToken,
		);
		expect(declined.declineInquiry.status).toBe('DECLINED');
		expect(declined.declineInquiry.outcome).toBeNull();
		expect((await message({ ...second, version: 2 }, client.accessToken)).errors).toBeDefined();
	});

	it('rolls back the message, status, and event if its notification cannot be written', async () => {
		const sent = await submit(await draft());
		const notifications = db.model('Notification');
		const failure = jest.spyOn(notifications, 'create').mockRejectedValueOnce(new Error('Simulated storage failure'));
		try {
			expect((await message(sent, creator.accessToken)).errors).toBeDefined();
		} finally {
			failure.mockRestore();
		}
		const stored = await db.model('Inquiry').findById(sent._id);
		expect(stored.status).toBe('SENT');
		expect(stored.version).toBe(1);
		expect(await db.model('InquiryMessage').countDocuments({ inquiryId: sent._id })).toBe(0);
		expect(await db.model('InquiryEvent').countDocuments({ inquiryId: sent._id })).toBe(1);
	});

	it('keeps notification reads private and separate from conversation read receipts', async () => {
		const sent = await submit(await draft());
		const alerts = await ok(
			'{ getNotifications { list { event { inquiryId } } metaCounter { total } } getUnreadNotificationCount getUnreadInquiryCount }',
			{},
			creator.accessToken,
		);
		expect(alerts.getNotifications.list.every((item: any) => item.event === null)).toBe(true);
		expect(alerts.getUnreadInquiryCount).toBeGreaterThan(0);
		const activityFilter = { recipientId: new Types.ObjectId(creator.user._id), inquiryEventId: { $exists: false } };
		expect(alerts.getUnreadNotificationCount).toBe(
			await db.model('Notification').countDocuments({ ...activityFilter, readAt: { $exists: false } }),
		);
		expect(alerts.getNotifications.metaCounter[0]?.total || 0).toBe(
			await db.model('Notification').countDocuments(activityFilter),
		);

		const response = await message(sent, creator.accessToken);
		expect(response.errors).toBeUndefined();
		const event = await db.model('InquiryEvent').findOne({ inquiryId: sent._id, type: 'MESSAGE_SENT' });
		const notification = await db.model('Notification').findOne({ inquiryEventId: event._id });
		const id = String(notification._id);
		const mark = 'mutation($id:ID!){markNotificationRead(notificationId:$id)}';
		expect((await gql(mark, { id }, creator.accessToken)).errors).toBeDefined();
		await ok(mark, { id }, client.accessToken);
		const first = (await db.model('Notification').findById(id)).readAt;
		await ok(mark, { id }, client.accessToken);
		expect((await db.model('Notification').findById(id)).readAt).toEqual(first);
		expect((await db.model('InquiryMessage').findById(response.data.sendInquiryMessage._id)).readAt).toBeUndefined();
		const inbox = await ok(
			'{\n  getNotifications {\n    list {\n      recipientId\n      event {\n        inquiryId\n      }\n    }\n  }\n}',
			{},
			client.accessToken,
		);
		expect(inbox.getNotifications.list.every((item: any) => item.recipientId === client.user._id)).toBe(true);
	});

	it('invalidates replaced reset tokens and revokes all sessions on successful reset', async () => {
		const user = await account('reset@example.com');
		const requestReset = 'mutation($input:EmailInput!){requestPasswordReset(input:$input)}';
		await ok(requestReset, { input: { email: 'reset@example.com' } });
		const old = mail.get('reset@example.com:PASSWORD_RESET');
		await ok(requestReset, { input: { email: 'reset@example.com' } });
		const token = mail.get('reset@example.com:PASSWORD_RESET');
		const operation = 'mutation($input:ResetPasswordInput!){resetPassword(input:$input)}';
		expect(
			(
				await gql(operation, {
					input: { token: old, password: 'Replacement-password-123' },
				})
			).errors,
		).toBeDefined();
		await ok(operation, { input: { token, password: 'Replacement-password-123' } });
		expect(
			(
				await gql(operation, {
					input: { token, password: 'Replacement-password-123' },
				})
			).errors,
		).toBeDefined();
		expect((await gql('query{me{_id}}', {}, user.accessToken)).errors).toBeDefined();
		await ok('mutation($input:LoginInput!){login(input:$input){accessToken}}', {
			input: { email: 'reset@example.com', password: 'Replacement-password-123' },
		});
	});

	it('rejects expired sessions before TTL cleanup and retains deleted-account email reservations', async () => {
		const startedAt = Date.now();
		const expired = await account('expired@example.com');
		const session = await db.model('AuthSession').findOne({ userId: expired.user._id });
		const lifetime = 15 * 86400000;
		expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(startedAt + lifetime);
		expect(session.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + lifetime);
		const refreshed = await ok(
			'mutation($token:String!){refreshSession(refreshToken:$token){accessToken refreshToken}}',
			{ token: expired.refreshToken },
		);
		expect((await db.model('AuthSession').findById(session._id)).expiresAt.getTime()).toBe(session.expiresAt.getTime());
		await db
			.model('AuthSession')
			.updateMany({ userId: expired.user._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
		expect((await gql('query{me{_id}}', {}, expired.accessToken)).errors).toBeDefined();
		expect(
			(
				await gql('mutation($token:String!){refreshSession(refreshToken:$token){accessToken}}', {
					token: refreshed.refreshSession.refreshToken,
				})
			).errors,
		).toBeDefined();
		const deleted = await account('deleted@example.com');
		await ok('mutation{deleteMyAccount}', {}, deleted.accessToken);
		expect((await gql('query{me{_id}}', {}, deleted.accessToken)).errors).toBeDefined();
		expect(
			(
				await gql('mutation($input:RegisterInput!){register(input:$input){accessToken}}', {
					input: {
						email: 'DELETED@EXAMPLE.COM',
						password: 'Portfolio-test-password-123',
						displayName: 'Duplicate deleted account',
						phoneNumber: '+821023456789',
					},
				})
			).errors,
		).toBeDefined();
	});

	it('deduplicates follows and comment retries and notifies followers only on first publication', async () => {
		const activity = app.get(ActivityService);
		await activity.deliverPending();
		const follow = 'mutation($id:ID!,$following:Boolean!){setCreatorFollow(creatorId:$id,following:$following)}';
		const concurrent = await Promise.all([
			gql(follow, { id: creatorId, following: true }, client.accessToken),
			gql(follow, { id: creatorId, following: true }, client.accessToken),
		]);
		concurrent.forEach((result) => expect(result.errors).toBeUndefined());
		expect(await db.model('CreatorFollow').countDocuments({ followerId: client.user._id, creatorId })).toBe(1);
		const followersQuery = 'query{getMyFollowers{list{_id displayName avatarUrl} metaCounter{total}}}';
		expect((await gql(followersQuery)).errors).toBeDefined();
		const ownFollowers = (await ok(followersQuery, {}, creator.accessToken)).getMyFollowers;
		expect(ownFollowers.list.map((member: any) => member._id)).toContain(client.user._id);
		expect(Object.keys(ownFollowers.list[0]).sort()).toEqual(['_id', 'avatarUrl', 'displayName']);
		const unrelated = await account('followers-unrelated@example.com');
		expect((await ok(followersQuery, {}, unrelated.accessToken)).getMyFollowers.list).toEqual([]);
		expect((await ok(followersQuery, {}, admin.accessToken)).getMyFollowers.list).toEqual([]);
		await db.model('User').updateOne({ _id: client.user._id }, { status: 'SUSPENDED' });
		expect((await ok(followersQuery, {}, creator.accessToken)).getMyFollowers.list).toEqual([]);
		await db.model('User').updateOne({ _id: client.user._id }, { status: 'ACTIVE' });

		expect(
			await db
				.model('ActivityEvent')
				.countDocuments({ performedById: client.user._id, creatorId, type: 'CREATOR_FOLLOWED' }),
		).toBe(1);
		expect((await gql(follow, { id: creatorId, following: true }, creator.accessToken)).errors).toBeDefined();
		await activity.deliverPending();
		const followerBefore = await db
			.model('Notification')
			.countDocuments({ recipientId: client.user._id, activityEventId: { $exists: true } });
		await approvedFixture(
			'mutation($input:UpdateCreatorInput!){updateCreatorProfile(input:$input){_id}}',
			{ input: { bio: 'Updated studio description' } },
			creator.accessToken,
		);
		const image = `https://media.example.com/creatorhub/${creator.user._id}/new-work.webp`;
		const created = await ok(
			'mutation($input:CreateProjectInput!){createProject(input:$input){_id}}',
			{
				input: {
					title: 'New portfolio publication',
					slug: 'new-portfolio-publication',
					categoryId,
					description: 'A newly completed brand identity project.',
					coverImageUrl: image,
					media: [{ type: 'IMAGE', url: image, altText: 'New work', sortOrder: 0 }],
				},
			},
			creator.accessToken,
		);
		const id = created.createProject._id;
		const publish = 'mutation($id:ID!,$status:ProjectStatus!){setProjectStatus(projectId:$id,status:$status){_id}}';
		await activity.deliverPending();
		expect(
			await db
				.model('Notification')
				.countDocuments({ recipientId: client.user._id, activityEventId: { $exists: true } }),
		).toBe(followerBefore);
		await approvedFixture(publish, { id, status: 'PUBLISHED' }, creator.accessToken);
		await activity.deliverPending();
		const publication = await db.model('ActivityEvent').findOne({ projectId: id, type: 'PROJECT_PUBLISHED' });
		expect(
			await db.model('Notification').countDocuments({ recipientId: client.user._id, activityEventId: publication._id }),
		).toBe(1);
		await approvedFixture(publish, { id, status: 'ARCHIVED' }, creator.accessToken);
		const hidden = await ok(
			'{\n  getNotifications {\n    list {\n      activityEvent {\n        projectId\n      }\n      unavailable\n    }\n  }\n}',
			{},
			client.accessToken,
		);
		expect(hidden.getNotifications.list.some((item) => item.unavailable)).toBe(true);
		await approvedFixture(publish, { id, status: 'PUBLISHED' }, creator.accessToken);
		await activity.deliverPending();
		expect(await db.model('ActivityEvent').countDocuments({ projectId: id, type: 'PROJECT_PUBLISHED' })).toBe(1);
		expect(
			await db.model('Notification').countDocuments({ recipientId: client.user._id, activityEventId: publication._id }),
		).toBe(1);
		const input = { projectId: id, content: 'Excellent new project', clientCommentKey: randomUUID() };
		const comment = 'mutation($input:CommentInput!){createProjectComment(input:$input){_id}}';
		const attempts = await Promise.all([
			ok(comment, { input }, client.accessToken),
			ok(comment, { input }, client.accessToken),
		]);
		expect(attempts[0].createProjectComment._id).toBe(attempts[1].createProjectComment._id);
		expect(await db.model('ActivityEvent').countDocuments({ commentId: attempts[0].createProjectComment._id })).toBe(1);
		expect(
			(await gql(comment, { input: { ...input, content: 'Different retry content' } }, client.accessToken)).errors,
		).toBeDefined();
		await activity.deliverPending();
		expect(
			await db
				.model('Notification')
				.countDocuments({ recipientId: client.user._id, activityEventId: { $exists: true } }),
		).toBe(followerBefore + 1);
		const commented = await db.model('ActivityEvent').findOne({ commentId: attempts[0].createProjectComment._id });
		expect(
			await db.model('Notification').countDocuments({ recipientId: creator.user._id, activityEventId: commented._id }),
		).toBe(1);
		await ok(follow, { id: creatorId, following: false }, client.accessToken);
		const firstFollow = await db.model('CreatorFollow').findOne({ followerId: client.user._id, creatorId });
		await ok(follow, { id: creatorId, following: true }, client.accessToken);
		const renewed = await db.model('CreatorFollow').findOne({ followerId: client.user._id, creatorId });
		expect(String(renewed._id)).toBe(String(firstFollow._id));
		expect(renewed.followedAt.getTime()).toBeGreaterThan(firstFollow.followedAt.getTime());
	});

	it('rolls back a failed activity delivery and retries without duplicate notifications', async () => {
		const activity = app.get(ActivityService);
		await activity.deliverPending();
		const author = await db.model('User').findById(client.user._id);
		const events = db.model('ActivityEvent');
		const notifications = db.model('Notification');
		const pending = await events.create({
			performedById: author._id,
			creatorId,
			type: 'CREATOR_FOLLOWED',
			actionKey: randomUUID(),
		});
		const write = jest.spyOn(notifications, 'updateOne').mockImplementationOnce(() => {
			throw new Error('Simulated delivery outage');
		});
		try {
			await activity.deliverPending();
		} finally {
			write.mockRestore();
		}
		const delayed = await events.findById(pending._id);
		expect(delayed.deliveryStatus).toBe('PENDING');
		expect(delayed.completedAt).toBeUndefined();
		expect(delayed.leaseUntil).toBeUndefined();
		expect(await notifications.countDocuments({ activityEventId: pending._id })).toBe(0);
		await events.updateOne({ _id: pending._id }, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
		await activity.deliverPending();
		await activity.deliverPending();
		expect((await events.findById(pending._id)).deliveryStatus).toBe('COMPLETE');
		expect(await notifications.countDocuments({ activityEventId: pending._id })).toBe(1);
		const undone = await events.create({
			performedById: author._id,
			creatorId,
			projectId,
			type: 'PROJECT_LIKED',
			actionKey: randomUUID(),
		});
		await db.model('ProjectLike').deleteOne({ userId: author._id, projectId });
		await activity.deliverPending();
		expect((await events.findById(undone._id)).deliveryStatus).toBe('COMPLETE');
		expect(await notifications.countDocuments({ activityEventId: undone._id })).toBe(0);
	});

	it('keeps an administrator role when publishing a creator profile', async () => {
		await ok(
			'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id}}',
			{ input: { slug: 'admin-creator', headline: 'Administrator creator', city: 'seoul', categoryIds: [categoryId] } },
			admin.accessToken,
		);
		await approvedFixture('mutation{setCreatorProfileStatus(status:PUBLISHED){_id}}', {}, admin.accessToken);
		expect((await ok('query{me{role}}', {}, admin.accessToken)).me.role).toBe('ADMIN');
		await ok('mutation{deleteCreatorProfile}', {}, admin.accessToken);
	});

	it('retains conversations after a creator profile is soft-deleted', async () => {
		const owner = await account('retiredcreator@example.com');
		const profile = await ok(
			'mutation($input:CreateCreatorInput!){createCreatorProfile(input:$input){_id}}',
			{ input: { slug: 'retired-studio', headline: 'Brand designer', city: 'seoul', categoryIds: [categoryId] } },
			owner.accessToken,
		);
		await approvedFixture('mutation{setCreatorProfileStatus(status:PUBLISHED){status}}', {}, owner.accessToken);
		const sent = await submit(await draft({ creatorId: profile.createCreatorProfile._id }));
		await ok('mutation{deleteCreatorProfile}', {}, owner.accessToken);
		await ok('query($id:ID!){getInquiry(inquiryId:$id){_id}}', { id: sent._id }, owner.accessToken);
		expect((await message(sent, owner.accessToken)).errors).toBeUndefined();
		expect((await gql('query{creator(slug:"retired-studio"){_id}}')).errors).toBeDefined();
		expect(
			(await gql('mutation{setCreatorProfileStatus(status:PUBLISHED){status}}', {}, owner.accessToken)).errors,
		).toBeDefined();
	});

	it('suspends accounts immediately and removes their content from public results', async () => {
		await ok(
			'mutation($id:ID!){setAccountSuspended(userId:$id,suspended:true){status}}',
			{ id: creator.user._id },
			admin.accessToken,
		);
		expect((await gql('query{me{_id}}', {}, creator.accessToken)).errors).toBeDefined();
		const publicData = await ok(
			'{\n  getProjects {\n    list {\n      _id\n    }\n  }\n  getServices {\n    list {\n      _id\n    }\n  }\n}',
		);
		expect(publicData.getProjects.list).toHaveLength(0);
		expect(publicData.getServices.list).toHaveLength(0);
	});
	it('runs the index/seed and administrator CLI commands against the isolated database', async () => {
		const run = promisify(execFile);
		const categoryModel = db.model('Category');
		await categoryModel.updateOne({ _id: categoryId }, { $set: { name: 'Custom category label' } });
		const original = await categoryModel.findById(categoryId);
		for (let attempt = 0; attempt < 2; attempt++) {
			const result = await run(process.execPath, ['-r', 'ts-node/register', 'apps/Creator-api/src/database/setup.ts'], {
				env: process.env,
			});
			expect(result.stdout).toContain('indexes and six category seeds are ready');
		}
		expect(await categoryModel.countDocuments()).toBe(6);
		const preserved = await categoryModel.findById(categoryId);
		expect(preserved.name).toBe('Custom category label');
		expect(preserved.createdAt).toEqual(original.createdAt);
		expect(preserved.updatedAt).toEqual(original.updatedAt);
		const seeded = await categoryModel.findOne({ slug: 'photography' });
		expect(seeded.createdAt).toBeInstanceOf(Date);
		const promoted = await run(
			process.execPath,
			['-r', 'ts-node/register', 'apps/Creator-api/src/database/admin.ts', 'client@example.com'],
			{ env: process.env },
		);
		expect(promoted.stdout).toContain('Administrator access granted');
		expect((await db.model('User').findById(client.user._id)).role).toBe('ADMIN');
	});
	it('schedules notification delivery in the batch app', async () => {
		const { BatchModule } = jest.requireActual('../../Creator-batch/src/batch.module');
		const delivery = jest.fn().mockResolvedValue(undefined);
		const worker = await Test.createTestingModule({ imports: [BatchModule] })
			.overrideProvider(ActivityService)
			.useValue({ deliverPending: delivery })
			.compile();
		try {
			await worker.init();
			await new Promise((resolve) => setTimeout(resolve, 5200));
			expect(delivery).toHaveBeenCalledTimes(1);
			expect((app.get(ActivityService) as any).timer).toBeUndefined();
		} finally {
			await worker.close();
		}
	});
});
