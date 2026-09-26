import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync, sign } from 'node:crypto';
import { SocialAuthService } from '../src/components/auth/social-auth.service';
import { AuthProvider } from '../src/libs/enums/creatorhub.enum';

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
});
