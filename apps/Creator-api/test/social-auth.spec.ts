import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, sign } from 'node:crypto';
import { SocialAuthService } from '../src/components/auth/social-auth.service';
import { AuthProvider } from '../src/libs/enums/auth-provider.enum';

// Signed local fixtures verify token security without contacting provider accounts.
describe('Social provider token verification', () => {
	const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
	const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
	let service: SocialAuthService;
	let fetchMock: jest.SpyInstance;
	beforeEach(() => {
		service = new SocialAuthService(
			new ConfigService({
				GOOGLE_CLIENT_ID: 'google-client',
				TELEGRAM_CLIENT_ID: 'telegram-client',
				KAKAO_CLIENT_ID: 'kakao-client',
				KAKAO_CLIENT_SECRET: 'fixture-secret',
				FRONTEND_URL: 'http://localhost:7007',
			}),
		);
		fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
			ok: true,
			json: async () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'fixture' }] }),
		} as Response);
	});
	afterEach(() => fetchMock.mockRestore());
	function token(nonce: string, claims: Record<string, unknown> = {}, algorithm = 'RS256') {
		const now = Math.floor(Date.now() / 1000);
		const payload = [
			encode({ alg: algorithm, kid: 'fixture' }),
			encode({
				iss: 'https://accounts.google.com',
				aud: 'google-client',
				sub: 'provider-owned-subject',
				iat: now,
				exp: now + 300,
				nonce,
				...claims,
			}),
		].join('.');
		return payload + '.' + sign('RSA-SHA256', Buffer.from(payload), privateKey).toString('base64url');
	}
	it.each([
		[AuthProvider.GOOGLE, 'https://accounts.google.com', 'google-client'],
		[AuthProvider.TELEGRAM, 'https://oauth.telegram.org', 'telegram-client'],
		[AuthProvider.KAKAO, 'https://kauth.kakao.com', 'kakao-client'],
	])('accepts a signed %s subject and consumes its nonce once', async (provider, iss, aud) => {
		const nonce = service.begin(provider);
		const input = { provider, nonce, idToken: token(nonce, { iss, aud }) };
		await expect(service.verify(input)).resolves.toBe('provider-owned-subject');
		await expect(service.verify(input)).rejects.toThrow('Start a new social sign-in');
	});
	it.each([
		{ iss: 'https://attacker.example' },
		{ aud: 'wrong-client' },
		{ exp: 0 },
		{ nonce: 'wrong-nonce' },
		{ sub: '' },
	])('rejects invalid signed claims %j', async (claims) => {
		const nonce = service.begin(AuthProvider.GOOGLE);
		await expect(
			service.verify({ provider: AuthProvider.GOOGLE, nonce, idToken: token(nonce, claims) }),
		).rejects.toThrow();
	});
	it('rejects a forged signature and unsigned algorithm', async () => {
		let nonce = service.begin(AuthProvider.GOOGLE);
		const signed = token(nonce).split('.');
		signed[1] = encode({ sub: 'forged-account' });
		await expect(service.verify({ provider: AuthProvider.GOOGLE, nonce, idToken: signed.join('.') })).rejects.toThrow();
		nonce = service.begin(AuthProvider.GOOGLE);
		await expect(
			service.verify({ provider: AuthProvider.GOOGLE, nonce, idToken: token(nonce, {}, 'none') }),
		).rejects.toThrow();
	});
	it('fails clearly when the provider is not configured', () => {
		const unconfigured = new SocialAuthService(new ConfigService({}));
		expect(() => unconfigured.begin(AuthProvider.KAKAO)).toThrow('KAKAO login is not configured');
	});
	it('returns only verified profile data and keeps signup tickets single-use and separate from login nonces', async () => {
		const nonce = service.begin(AuthProvider.GOOGLE);
		const profile = await service.verifyProfile({
			provider: AuthProvider.GOOGLE,
			nonce,
			idToken: token(nonce, { name: 'Google Test Member' }),
		});
		expect(profile).toEqual({ subject: 'provider-owned-subject', displayName: 'Google Test Member' });
		const ticket = service.prepareGoogleSignup(profile);
		expect(service.consumeGoogleSignup(ticket)).toEqual(profile);
		expect(() => service.consumeGoogleSignup(ticket)).toThrow('Google signup expired');
		const other = service.prepareGoogleSignup(profile);
		await expect(
			service.verify({ provider: AuthProvider.GOOGLE, nonce: other, idToken: token(other) }),
		).rejects.toThrow('Start a new social sign-in');
	});

	it('rejects expired Google signup tickets and ordinary login nonces as signup tickets', () => {
		const nonce = service.begin(AuthProvider.GOOGLE);
		expect(() => service.consumeGoogleSignup(nonce)).toThrow('Google signup expired');
		const ticket = service.prepareGoogleSignup({ subject: 'verified-subject' });
		const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60000);
		try {
			expect(() => service.consumeGoogleSignup(ticket)).toThrow('Google signup expired');
		} finally {
			clock.mockRestore();
		}
	});
	it.each([AuthProvider.TELEGRAM, AuthProvider.KAKAO])(
		'binds %s signup tickets to their provider and expiry',
		(provider) => {
			const ticket = service.prepareSignup(provider, { subject: 'verified-subject' });
			expect(() => service.consumeSignup(AuthProvider.GOOGLE, ticket)).toThrow('Google signup expired');
			const valid = service.prepareSignup(provider, { subject: 'verified-subject' });
			expect(service.consumeSignup(provider, valid).subject).toBe('verified-subject');
			expect(() => service.consumeSignup(provider, valid)).toThrow('signup expired');
			const expired = service.prepareSignup(provider, { subject: 'verified-subject' });
			const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60000);
			try {
				expect(() => service.consumeSignup(provider, expired)).toThrow('signup expired');
			} finally {
				clock.mockRestore();
			}
		},
	);

	it('exchanges a Kakao code only for a live server-created state and validates the returned signed ID token', async () => {
		const challenge = service.beginKakao();
		const authorization = new URL(challenge.authorizationUrl);
		expect(authorization.searchParams.get('redirect_uri')).toBe('http://localhost:7007/account/kakao-callback');
		expect(authorization.searchParams.get('scope')).toBe('openid');
		const nonce = authorization.searchParams.get('nonce')!;
		const idToken = token(nonce, { iss: 'https://kauth.kakao.com', aud: 'kakao-client', nickname: 'Kakao Member' });
		fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id_token: idToken }) } as Response);
		await expect(service.verifyKakaoCode({ code: 'one-use-code', state: challenge.state })).resolves.toEqual({
			subject: 'provider-owned-subject',
			displayName: 'Kakao Member',
		});
		const request = fetchMock.mock.calls[0];
		expect(request[0]).toBe('https://kauth.kakao.com/oauth/token');
		expect(request[1].body.get('client_secret')).toBe('fixture-secret');
		expect(request[1].body.get('redirect_uri')).toBe('http://localhost:7007/account/kakao-callback');
		await expect(service.verifyKakaoCode({ code: 'one-use-code', state: challenge.state })).rejects.toThrow('expired');
	});

	it('rejects unknown or expired Kakao states before sending a token request', async () => {
		await expect(service.verifyKakaoCode({ code: 'code', state: 'a'.repeat(64) })).rejects.toThrow('expired');
		const challenge = service.beginKakao();
		const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 11 * 60000);
		try {
			await expect(service.verifyKakaoCode({ code: 'code', state: challenge.state })).rejects.toThrow('expired');
		} finally {
			clock.mockRestore();
		}
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('rejects Kakao exchange failures and wrong-audience ID tokens without leaking provider responses', async () => {
		let challenge = service.beginKakao();
		fetchMock.mockResolvedValueOnce({
			ok: false,
			json: async () => ({ client_secret: 'never-return-this' }),
		} as Response);
		await expect(service.verifyKakaoCode({ code: 'code', state: challenge.state })).rejects.toThrow(
			'Kakao sign-in could not be verified',
		);
		challenge = service.beginKakao();
		const nonce = new URL(challenge.authorizationUrl).searchParams.get('nonce')!;
		fetchMock.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ id_token: token(nonce, { iss: 'https://kauth.kakao.com', aud: 'wrong-client' }) }),
		} as Response);
		await expect(service.verifyKakaoCode({ code: 'code', state: challenge.state })).rejects.toThrow(
			'Kakao sign-in could not be verified',
		);
	});
});
