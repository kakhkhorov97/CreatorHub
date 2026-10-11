import { createHash } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import { scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AuthIdentity } from '../../libs/dto/auth/auth-identity';
import { AuthSession } from '../../libs/dto/auth/auth-session';
import { AuthToken } from '../../libs/dto/auth/auth-token';
import {
	GoogleLoginInput,
	TelegramLoginInput,
	KakaoLoginInput,
	CompleteSocialSignupInput,
	CompleteGoogleSignupInput,
	LoginInput,
	RegisterInput,
	PhoneRegisterInput,
	PhoneLoginInput,
	SocialLoginInput,
	ResetPasswordInput,
	ChangePasswordInput,
	ChangeEmailInput,
	LinkEmailInput,
	LinkPhoneInput,
} from '../../libs/dto/auth/auth.input';
import { User } from '../../libs/dto/user/user';
import { AuthProvider } from '../../libs/enums/auth-provider.enum';
import { AuthTokenPurpose } from '../../libs/enums/auth-token-purpose.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';
import { duplicateKey, shapeIntoMongooseObjectId } from '../../libs/helpers/policy';
import { MailService } from './mail.service';
import { SocialAuthService } from './social-auth.service';
import { newToken, tokenHash } from './password';

const scrypt = promisify(scryptCallback);

const BCRYPT_ROUNDS = 12;

const DUMMY_PASSWORD_HASH = '$2b$12$UFNLtHm2rDGn/8075k1JMOed2dDj61nJnQgnDVHKQ2FuYv5GDuWSi';

@Injectable()
export class AuthService {
	constructor(
		@InjectModel(User.name) private readonly users: Model<User>,
		@InjectModel('AuthIdentity') private readonly identities: Model<AuthIdentity>,
		@InjectModel(AuthSession.name) private readonly sessions: Model<AuthSession>,
		@InjectModel(AuthToken.name) private readonly tokens: Model<AuthToken>,
		@InjectConnection() private readonly connection: Connection,
		private readonly jwt: JwtService,
		private readonly mail: MailService,
		private readonly social: SocialAuthService,
	) {}

	public async hashPassword(password: string): Promise<string> {
		if (Buffer.byteLength(password, 'utf8') > 72) {
			return (
				'bcrypt-sha256:' +
				(await bcrypt.hash(createHash('sha256').update(password, 'utf8').digest('hex'), BCRYPT_ROUNDS))
			);
		}

		return bcrypt.hash(password, BCRYPT_ROUNDS);
	}

	public async comparePasswords(password: string, stored: string): Promise<boolean> {
		if (stored.startsWith('bcrypt-sha256:'))
			return bcrypt.compare(
				createHash('sha256').update(password, 'utf8').digest('hex'),
				stored.slice('bcrypt-sha256:'.length),
			);

		if (/^\$2[ab]\$/.test(stored)) {
			if (Buffer.byteLength(password, 'utf8') > 72) return false;
			return bcrypt.compare(password, stored);
		}

		// Keep existing scrypt accounts usable until their password is changed or reset.
		if (!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored)) return false;
		const [, salt, encoded] = stored.split(':');
		const key = (await scrypt(password, salt, 64)) as Buffer;
		return timingSafeEqual(Buffer.from(encoded, 'hex'), key);
	}

	public async register(input: RegisterInput) {
		const { user, identity } = await this.createAccount(
			input,
			AuthProvider.EMAIL,
			input.email,
			await this.hashPassword(input.password),
		);
		await this.issueToken(identity, AuthTokenPurpose.EMAIL_VERIFY);
		return this.createSession(user, identity);
	}

	public registerPhone(_input: PhoneRegisterInput) {
		throw new BadRequestException('Phone signup is unavailable. Register with an email and a contact phone number.');
	}

	private async createAccount(
		input: { displayName: string; preferredLocale?: User['preferredLocale']; phoneNumber?: string },
		provider: AuthProvider,
		providerSubject: string,
		passwordHash?: string,
	) {
		try {
			return await this.connection.transaction(async (session) => {
				const [user] = await this.users.create(
					[{ displayName: input.displayName, preferredLocale: input.preferredLocale, phoneNumber: input.phoneNumber }],
					{ session },
				);
				const [identity] = await this.identities.create(
					[
						{
							userId: user._id,
							provider,
							providerSubject,
							...(passwordHash ? { passwordHash } : {}),
							...([AuthProvider.GOOGLE, AuthProvider.TELEGRAM, AuthProvider.KAKAO].includes(provider)
								? { verifiedAt: new Date() }
								: {}),
						},
					],
					{ session },
				);
				return { user, identity };
			});
		} catch (error) {
			if (duplicateKey(error)) throw new ConflictException('That login method already belongs to an account');
			throw error;
		}
	}

	public login(input: LoginInput) {
		return this.loginPassword(AuthProvider.EMAIL, input.email, input.password);
	}

	public loginPhone(_input: PhoneLoginInput) {
		throw new BadRequestException('Phone login is unavailable. Sign in with your verified email.');
	}

	private async loginPassword(provider: AuthProvider, providerSubject: string, password: string) {
		const identity = await this.identities
			.findOne({ provider, providerSubject, revokedAt: { $exists: false } })
			.select('+passwordHash');
		const valid = await this.comparePasswords(password, identity?.passwordHash ?? DUMMY_PASSWORD_HASH);
		if (!identity || !valid) throw new UnauthorizedException('Invalid login or password');
		await this.requireUsable(identity);
		const user = await this.activeUser(identity.userId);
		await this.recordLogin(user, identity);
		return this.createSession(user, identity);
	}

	public beginSocialLogin(provider: AuthProvider) {
		return this.social.begin(provider);
	}

	public async loginGoogle(input: GoogleLoginInput) {
		return this.signInVerifiedProfile(
			AuthProvider.GOOGLE,
			await this.social.verifyProfile({ ...input, provider: AuthProvider.GOOGLE }),
		);
	}

	public beginKakaoLogin() {
		return this.social.beginKakao();
	}

	public async loginKakao(input: KakaoLoginInput) {
		return this.signInVerifiedProfile(AuthProvider.KAKAO, await this.social.verifyKakaoCode(input));
	}

	public async loginTelegram(input: TelegramLoginInput) {
		return this.signInVerifiedProfile(
			AuthProvider.TELEGRAM,
			await this.social.verifyProfile({ ...input, provider: AuthProvider.TELEGRAM }),
		);
	}

	private async signInVerifiedProfile(provider: AuthProvider, profile: { subject: string; displayName?: string }) {
		const identity = await this.identities.findOne({ provider, providerSubject: profile.subject });
		if (identity) {
			await this.requireUsable(identity);
			const user = await this.activeUser(identity.userId);
			await this.recordLogin(user, identity);
			return { session: await this.createSession(user, identity) };
		}
		return { signupToken: this.social.prepareSignup(provider, profile), displayName: profile.displayName };
	}

	public completeGoogleSignup(input: CompleteGoogleSignupInput) {
		return this.completeProviderSignup(AuthProvider.GOOGLE, input);
	}

	public completeSocialSignup(input: CompleteSocialSignupInput) {
		return this.completeProviderSignup(input.provider, input);
	}

	private async completeProviderSignup(provider: AuthProvider, input: CompleteGoogleSignupInput) {
		const profile = this.social.consumeSignup(provider, input.signupToken);
		let account: { user: User; identity: AuthIdentity };
		try {
			account = await this.createAccount(input, provider, profile.subject);
		} catch (error) {
			if (!(error instanceof ConflictException)) throw error;
			const identity = await this.identities.findOne({ provider, providerSubject: profile.subject });
			if (!identity) throw error;
			await this.requireUsable(identity);
			account = { identity, user: await this.activeUser(identity.userId) };
		}
		await this.recordLogin(account.user, account.identity);
		return this.createSession(account.user, account.identity);
	}

	public async loginSocial(input: SocialLoginInput) {
		const subject = await this.social.verify(input);
		let identity = await this.identities.findOne({ provider: input.provider, providerSubject: subject });
		let user: User;
		if (identity) {
			await this.requireUsable(identity);
			user = await this.activeUser(identity.userId);
		} else {
			if (!input.displayName) throw new ConflictException('Provide a display name to register with this provider');
			if (!input.phoneNumber) throw new BadRequestException('Provide a contact phone number to register.');
			try {
				({ user, identity } = await this.createAccount(
					{ displayName: input.displayName, preferredLocale: input.preferredLocale, phoneNumber: input.phoneNumber },
					input.provider,
					subject,
				));
			} catch (error) {
				if (!(error instanceof ConflictException)) throw error;
				identity = await this.identities.findOne({ provider: input.provider, providerSubject: subject });
				if (!identity) throw error;
				await this.requireUsable(identity);
				user = await this.activeUser(identity.userId);
			}
		}
		await this.recordLogin(user, identity);
		return this.createSession(user, identity);
	}

	private async activeUser(id: Types.ObjectId, session: ClientSession | null = null) {
		const user = await this.users.findOne({ _id: id, status: UserStatus.ACTIVE }).session(session);
		if (!user) throw new UnauthorizedException('Account unavailable');
		return user;
	}

	private async requireUsable(identity: AuthIdentity | null) {
		if (!identity || identity.revokedAt || (identity.provider !== AuthProvider.PHONE && !identity.verifiedAt))
			throw new UnauthorizedException('Verify your email or sign in with an available method');
	}

	private async recordLogin(user: User, identity: AuthIdentity) {
		const lastLoginAt = new Date();
		await this.users.updateOne({ _id: user._id }, { $set: { lastLoginAt } });
		await this.identities.updateOne({ _id: identity._id }, { $set: { lastLoginAt } });
	}

	private async createSession(user: User, identity: AuthIdentity) {
		const refreshToken = newToken();
		return this.connection.transaction(async (transaction) => {
			await this.lockAccount(user, transaction);
			const current = await this.identities
				.exists({
					_id: identity._id,
					userId: user._id,
					providerSubject: identity.providerSubject,
					revokedAt: { $exists: false },
				})
				.session(transaction);
			if (!current) throw new UnauthorizedException('Login method changed. Sign in again.');
			const [session] = await this.sessions.create(
				[
					{
						userId: user._id,
						authIdentityId: identity._id,
						refreshTokenHash: tokenHash(refreshToken),
						expiresAt: new Date(Date.now() + 15 * 86400000),
					},
				],
				{ session: transaction },
			);
			return this.payload(user, session, refreshToken);
		});
	}

	private async payload(user: User, session: AuthSession, refreshToken: string) {
		return {
			user,
			refreshToken,
			accessToken: await this.jwt.signAsync({ sub: String(user._id), sid: String(session._id) }),
			expiresIn: 900,
		};
	}

	public async refresh(raw: string) {
		if (!/^[a-f0-9]{64}$/.test(raw)) throw new UnauthorizedException('Invalid session');
		const next = newToken();
		return this.connection.transaction(async (transaction) => {
			const session = await this.sessions.findOneAndUpdate(
				{ refreshTokenHash: tokenHash(raw), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } },
				{ $set: { refreshTokenHash: tokenHash(next), lastUsedAt: new Date() } },
				{ new: true, session: transaction },
			);
			if (!session) throw new UnauthorizedException('Invalid session');
			await this.requireUsable(
				await this.identities.findOne({ _id: session.authIdentityId, userId: session.userId }).session(transaction),
			);
			return this.payload(await this.activeUser(session.userId, transaction), session, next);
		});
	}

	public async authenticate(accessToken: string): Promise<{ user: User; sessionId: string; expiresAt: number }> {
		try {
			const payload = await this.jwt.verifyAsync<{ sub: string; sid: string; exp: number }>(accessToken);
			const session = await this.sessions.findOne({
				_id: shapeIntoMongooseObjectId(payload.sid),
				userId: shapeIntoMongooseObjectId(payload.sub),
				revokedAt: { $exists: false },
				expiresAt: { $gt: new Date() },
			});
			if (!session) throw new Error('Inactive session');
			await this.requireUsable(await this.identities.findOne({ _id: session.authIdentityId, userId: session.userId }));
			return {
				user: await this.activeUser(session.userId),
				sessionId: String(session._id),
				expiresAt: payload.exp * 1000,
			};
		} catch {
			throw new UnauthorizedException('Sign in with an available, verified method to continue');
		}
	}

	public async logout(user: User, sessionId: string): Promise<boolean> {
		await this.sessions.updateOne(
			{ _id: shapeIntoMongooseObjectId(sessionId), userId: user._id, revokedAt: { $exists: false } },
			{ $set: { revokedAt: new Date() } },
		);
		return true;
	}

	public async requestToken(email: string, purpose: AuthTokenPurpose): Promise<boolean> {
		const identity = await this.identities.findOne({
			provider: AuthProvider.EMAIL,
			providerSubject: email,
			revokedAt: { $exists: false },
		});
		if (
			identity &&
			!(purpose === AuthTokenPurpose.EMAIL_VERIFY && identity.verifiedAt) &&
			(purpose !== AuthTokenPurpose.PASSWORD_RESET || !!identity.verifiedAt) &&
			(await this.users.exists({ _id: identity.userId, status: UserStatus.ACTIVE }))
		)
			await this.issueToken(identity, purpose);
		return true;
	}

	private async issueToken(identity: AuthIdentity, purpose: AuthTokenPurpose) {
		const raw = newToken();
		await this.connection.transaction(async (session) => {
			await this.activeUser(identity.userId, session);
			const result = await this.identities.updateOne(
				{ _id: identity._id, revokedAt: { $exists: false } },
				{ $currentDate: { updatedAt: true } },
				{ session },
			);
			if (!result.matchedCount) throw new UnauthorizedException('Login method unavailable');
			await this.tokens.updateMany(
				{ authIdentityId: identity._id, purpose, consumedAt: { $exists: false }, revokedAt: { $exists: false } },
				{ $set: { revokedAt: new Date() } },
				{ session },
			);
			await this.tokens.create(
				[
					{
						authIdentityId: identity._id,
						purpose,
						tokenHash: tokenHash(raw),
						expiresAt: new Date(Date.now() + (purpose === AuthTokenPurpose.EMAIL_VERIFY ? 86400000 : 1800000)),
					},
				],
				{ session },
			);
		});
		await this.mail.sendToken(identity.providerSubject, purpose, raw);
	}

	private async consume(raw: string, purpose: AuthTokenPurpose, session: ClientSession) {
		if (!/^[a-f0-9]{64}$/.test(raw)) throw new UnauthorizedException('Invalid or expired token');
		const token = await this.tokens.findOneAndUpdate(
			{
				tokenHash: tokenHash(raw),
				purpose,
				consumedAt: { $exists: false },
				revokedAt: { $exists: false },
				expiresAt: { $gt: new Date() },
			},
			{ $set: { consumedAt: new Date() } },
			{ new: true, session },
		);
		if (!token) throw new UnauthorizedException('Invalid or expired token');
		const identity = await this.identities
			.findOne({ _id: token.authIdentityId, provider: AuthProvider.EMAIL, revokedAt: { $exists: false } })
			.session(session);
		if (!identity || (purpose === AuthTokenPurpose.PASSWORD_RESET && !identity.verifiedAt))
			throw new UnauthorizedException('Login method unavailable');
		await this.activeUser(identity.userId, session);
		return identity;
	}

	public async verifyEmail(raw: string): Promise<boolean> {
		if (!/^[a-f0-9]{64}$/.test(raw)) throw new UnauthorizedException('Invalid or expired token');
		try {
			await this.connection.transaction(async (session) => {
				const token = await this.tokens
					.findOne({
						tokenHash: tokenHash(raw),
						purpose: { $in: [AuthTokenPurpose.EMAIL_VERIFY, AuthTokenPurpose.EMAIL_CHANGE] },
					})
					.select('+previousEmail +replacementEmail')
					.session(session);
				if (!token) throw new UnauthorizedException('Invalid or expired token');
				const identity = await this.consume(raw, token.purpose, session);
				await this.lockAccount({ _id: identity.userId } as User, session);
				if (token.purpose === AuthTokenPurpose.EMAIL_CHANGE) {
					if (!identity.verifiedAt || !token.replacementEmail || identity.providerSubject !== token.previousEmail)
						throw new UnauthorizedException('Invalid or expired token');
					await this.identities.updateOne(
						{ _id: identity._id },
						{
							$set: { providerSubject: token.replacementEmail, verifiedAt: new Date() },
						},
						{ session },
					);
					await this.revokeAll(identity.userId, session);
				} else {
					await this.identities.updateOne(
						{ _id: identity._id },
						{
							$set: { verifiedAt: identity.verifiedAt ?? new Date() },
						},
						{ session },
					);
				}
			});
		} catch (error) {
			if (duplicateKey(error)) throw new ConflictException('That email already belongs to an account');
			throw error;
		}
		return true;
	}

	public async requestEmailChange(user: User, sessionId: string, input: ChangeEmailInput): Promise<boolean> {
		const raw = newToken();
		await this.connection.transaction(async (session) => {
			await this.lockAccount(user, session);
			await this.recentSession(user, sessionId, session);
			const identity = await this.identities
				.findOne({
					userId: user._id,
					provider: AuthProvider.EMAIL,
					revokedAt: { $exists: false },
				})
				.select('+passwordHash')
				.session(session);
			await this.requireUsable(identity);
			if (!identity?.passwordHash) throw new UnauthorizedException('Password login unavailable');
			if (!(await this.comparePasswords(input.currentPassword, identity.passwordHash)))
				throw new BadRequestException('Current password is incorrect');
			if (identity.providerSubject === input.email) throw new BadRequestException('Choose a different email address');
			if (await this.identities.exists({ provider: AuthProvider.EMAIL, providerSubject: input.email }).session(session))
				throw new ConflictException('That email already belongs to an account');
			await this.tokens.updateMany(
				{
					authIdentityId: identity._id,
					purpose: AuthTokenPurpose.EMAIL_CHANGE,
					consumedAt: { $exists: false },
					revokedAt: { $exists: false },
				},
				{ $set: { revokedAt: new Date() } },
				{ session },
			);
			await this.tokens.create(
				[
					{
						authIdentityId: identity._id,
						purpose: AuthTokenPurpose.EMAIL_CHANGE,
						tokenHash: tokenHash(raw),
						previousEmail: identity.providerSubject,
						replacementEmail: input.email,
						expiresAt: new Date(Date.now() + 1800000),
					},
				],
				{ session },
			);
		});
		await this.mail.sendToken(input.email, AuthTokenPurpose.EMAIL_CHANGE, raw);
		return true;
	}

	public async resetPassword(input: ResetPasswordInput): Promise<boolean> {
		const passwordHash = await this.hashPassword(input.password);
		await this.connection.transaction(async (session) => {
			const identity = await this.consume(input.token, AuthTokenPurpose.PASSWORD_RESET, session);
			await this.identities.updateOne({ _id: identity._id }, { $set: { passwordHash } }, { session });
			await this.revokeAll(identity.userId, session);
		});
		return true;
	}

	public getMyIdentities(user: User) {
		return this.identities.find({ userId: user._id, revokedAt: { $exists: false } }).sort({ createdAt: 1 });
	}

	private async recentSession(user: User, sessionId: string, session: ClientSession | null = null) {
		const recent = await this.sessions
			.exists({
				_id: shapeIntoMongooseObjectId(sessionId),
				userId: user._id,
				revokedAt: { $exists: false },
				expiresAt: { $gt: new Date() },
				createdAt: { $gt: new Date(Date.now() - 10 * 60000) },
			})
			.session(session);
		if (!recent) throw new UnauthorizedException('Sign in again before changing login methods');
	}

	private async lockAccount(user: User, session: ClientSession) {
		const result = await this.users.updateOne(
			{ _id: user._id, status: UserStatus.ACTIVE },
			{ $currentDate: { updatedAt: true } },
			{ session },
		);
		if (!result.matchedCount) throw new UnauthorizedException('Account unavailable');
	}

	public async linkEmail(user: User, sessionId: string, input: LinkEmailInput) {
		await this.recentSession(user, sessionId);
		const identity = await this.linkIdentity(
			user,
			AuthProvider.EMAIL,
			input.email,
			await this.hashPassword(input.password),
		);
		if (!identity.verifiedAt) await this.issueToken(identity, AuthTokenPurpose.EMAIL_VERIFY);
		return identity;
	}

	public linkPhone(_user: User, _sessionId: string, _input: LinkPhoneInput) {
		throw new BadRequestException('Phone numbers are contact information and cannot be linked for login.');
	}

	public async beginSocialLink(user: User, sessionId: string, provider: AuthProvider) {
		await this.recentSession(user, sessionId);
		return this.social.begin(provider, String(user._id));
	}

	public async linkSocial(user: User, sessionId: string, input: SocialLoginInput) {
		await this.recentSession(user, sessionId);
		const subject = await this.social.verify(input, String(user._id));
		return this.linkIdentity(user, input.provider, subject);
	}

	private async linkIdentity(user: User, provider: AuthProvider, providerSubject: string, passwordHash?: string) {
		try {
			return await this.connection.transaction(async (session) => {
				await this.lockAccount(user, session);
				const retained = await this.identities.findOne({ userId: user._id, provider }).session(session);
				if (retained) {
					if (provider === AuthProvider.EMAIL && !retained.revokedAt)
						throw new ConflictException('Use Change email to replace your current email');
					if (retained.providerSubject !== providerSubject)
						throw new ConflictException('This account already has a retained login for that provider');
					if (!retained.revokedAt) return retained;
					retained.revokedAt = undefined;
					if (passwordHash) retained.passwordHash = passwordHash;
					if (provider === AuthProvider.EMAIL) retained.verifiedAt = undefined;
					if (provider !== AuthProvider.EMAIL && provider !== AuthProvider.PHONE) retained.verifiedAt = new Date();
					return retained.save({ session });
				}
				const [identity] = await this.identities.create(
					[
						{
							userId: user._id,
							provider,
							providerSubject,
							...(passwordHash ? { passwordHash } : {}),
							...([AuthProvider.GOOGLE, AuthProvider.TELEGRAM, AuthProvider.KAKAO].includes(provider)
								? { verifiedAt: new Date() }
								: {}),
						},
					],
					{ session },
				);
				return identity;
			});
		} catch (error) {
			if (duplicateKey(error)) throw new ConflictException('That login method already belongs to an account');
			throw error;
		}
	}

	public async unlinkIdentity(user: User, sessionId: string, id: string) {
		await this.recentSession(user, sessionId);
		await this.connection.transaction(async (session) => {
			await this.lockAccount(user, session);
			const identity = await this.identities
				.findOne({ _id: shapeIntoMongooseObjectId(id), userId: user._id })
				.session(session);
			if (!identity) throw new UnauthorizedException('Login method unavailable');
			if (identity.revokedAt) return;
			if (identity.provider === AuthProvider.EMAIL)
				throw new ConflictException('Use Change email to replace your current email');
			const remaining = await this.identities
				.exists({
					userId: user._id,
					_id: { $ne: identity._id },
					revokedAt: { $exists: false },
					provider: { $ne: AuthProvider.PHONE },
					verifiedAt: { $exists: true },
				})
				.session(session);
			if (!remaining) throw new ConflictException('Keep at least one usable login method');
			await this.identities.updateOne({ _id: identity._id }, { $set: { revokedAt: new Date() } }, { session });
			await this.sessions.updateMany(
				{ authIdentityId: identity._id, revokedAt: { $exists: false } },
				{ $set: { revokedAt: new Date() } },
				{ session },
			);
			await this.tokens.updateMany(
				{ authIdentityId: identity._id, consumedAt: { $exists: false } },
				{ $set: { revokedAt: new Date() } },
				{ session },
			);
		});
		return true;
	}

	public async changePassword(user: User, sessionId: string, input: ChangePasswordInput) {
		const passwordHash = await this.hashPassword(input.password);
		await this.connection.transaction(async (session) => {
			await this.lockAccount(user, session);
			const currentSession = await this.sessions
				.findOne({
					_id: shapeIntoMongooseObjectId(sessionId),
					userId: user._id,
					revokedAt: { $exists: false },
					expiresAt: { $gt: new Date() },
				})
				.session(session);
			if (!currentSession) throw new UnauthorizedException('Sign in again before changing your password');
			await this.requireUsable(
				await this.identities
					.findOne({
						_id: currentSession.authIdentityId,
						userId: user._id,
					})
					.session(session),
			);
			const identity = await this.identities
				.findOne({
					_id: shapeIntoMongooseObjectId(input.authIdentityId),
					userId: user._id,
					provider: { $in: [AuthProvider.EMAIL, AuthProvider.PHONE] },
					revokedAt: { $exists: false },
				})
				.select('+passwordHash')
				.session(session);
			await this.requireUsable(identity);
			if (!identity?.passwordHash) throw new UnauthorizedException('Password login unavailable');
			if (!(await this.comparePasswords(input.currentPassword, identity.passwordHash)))
				throw new BadRequestException('Current password is incorrect');
			if (input.currentPassword === input.password) throw new BadRequestException('Choose a different new password');
			await this.identities.updateOne({ _id: identity._id }, { $set: { passwordHash } }, { session });
			await this.revokeAll(user._id, session);
		});
		return true;
	}

	public async changePhonePassword(user: User, sessionId: string, password: string) {
		await this.recentSession(user, sessionId);
		const passwordHash = await this.hashPassword(password);
		await this.connection.transaction(async (session) => {
			await this.lockAccount(user, session);
			const identity = await this.identities
				.findOne({ userId: user._id, provider: AuthProvider.PHONE, revokedAt: { $exists: false } })
				.session(session);
			if (!identity) throw new UnauthorizedException('Phone login unavailable');
			const current = await this.sessions.findById(shapeIntoMongooseObjectId(sessionId)).session(session);
			if (!current || String(current.authIdentityId) === String(identity._id))
				throw new UnauthorizedException('Sign in with another linked method to replace a phone password');
			await this.identities.updateOne({ _id: identity._id }, { $set: { passwordHash } }, { session });
			await this.revokeAll(user._id, session);
		});
		return true;
	}

	public async revokeAll(userId: Types.ObjectId, session: ClientSession) {
		await this.sessions.updateMany(
			{ userId, revokedAt: { $exists: false } },
			{ $set: { revokedAt: new Date() } },
			{ session },
		);
		const identities = await this.identities.find({ userId }).session(session).select('_id');
		await this.tokens.updateMany(
			{ authIdentityId: { $in: identities.map((identity) => identity._id) }, consumedAt: { $exists: false } },
			{ $set: { revokedAt: new Date() } },
			{ session },
		);
	}
}
