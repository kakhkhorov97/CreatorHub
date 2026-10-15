import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RateLimitGuard } from '../src/components/auth/guards/rate-limit.guard';

const jwt = new JwtService({
	secret: 'disposable-rate-limit-test-secret',
	signOptions: { issuer: 'creatorhub', audience: 'creatorhub-web', expiresIn: '15m' },
	verifyOptions: { issuer: 'creatorhub', audience: 'creatorhub-web', algorithms: ['HS256'] },
});
const userA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const userB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
function context(field: string, token?: string, ip = '127.0.0.1') {
	const req = { ip, headers: { authorization: token ? `Bearer ${token}` : undefined } };
	return {
		getType: () => 'graphql',
		getArgs: () => [
			null,
			{},
			{ req },
			{ fieldName: field, operation: { operation: field.startsWith('get') ? 'query' : 'mutation' } },
		],
		getClass: () => Object,
		getHandler: () => () => undefined,
	} as unknown as ExecutionContext;
}
describe('GraphQL rate limits', () => {
	let guard: RateLimitGuard;
	beforeEach(() => {
		jest.useFakeTimers().setSystemTime(new Date('2026-10-07T00:00:00Z'));
		guard = new RateLimitGuard({ get: () => 'development' } as unknown as ConfigService, jwt);
	});
	afterEach(() => jest.useRealTimers());

	it('allows normal browsing and activity without consuming login or refresh quotas', async () => {
		const token = jwt.sign({ sub: userA });
		for (let n = 0; n < 160; n++) await expect(guard.canActivate(context('getInquiry', token))).resolves.toBe(true);
		for (let n = 0; n < 30; n++) await expect(guard.canActivate(context('setProjectLike', token))).resolves.toBe(true);
		for (let n = 0; n < 10; n++) await guard.canActivate(context(n % 2 ? 'loginPhone' : 'login'));
		await expect(guard.canActivate(context('login'))).rejects.toMatchObject({ status: 429 });
		for (let n = 0; n < 30; n++) await expect(guard.canActivate(context('refreshSession'))).resolves.toBe(true);
		await expect(guard.canActivate(context('refreshSession'))).rejects.toMatchObject({ status: 429 });
	});

	it('limits social preparation separately from email and social login attempts', async () => {
		for (let n = 0; n < 30; n++)
			await expect(guard.canActivate(context(n % 2 ? 'beginSocialLogin' : 'beginKakaoLogin'))).resolves.toBe(true);
		await expect(guard.canActivate(context('beginSocialLogin'))).rejects.toMatchObject({ status: 429 });
		await expect(guard.canActivate(context('beginKakaoLogin'))).rejects.toMatchObject({ status: 429 });
		const loginFields = ['login', 'loginGoogle', 'loginTelegram', 'loginKakao'];
		for (let n = 0; n < 10; n++)
			await expect(guard.canActivate(context(loginFields[n % loginFields.length]))).resolves.toBe(true);
		await expect(guard.canActivate(context('loginGoogle'))).rejects.toMatchObject({ status: 429 });
		await expect(guard.canActivate(context('beginSocialLogin', undefined, '127.0.0.2'))).resolves.toBe(true);
		jest.advanceTimersByTime(60000);
		await expect(guard.canActivate(context('beginSocialLogin'))).resolves.toBe(true);
		await expect(guard.canActivate(context('loginTelegram'))).resolves.toBe(true);
	});

	it('allows social preparation after actual login attempts reach their limit', async () => {
		for (let n = 0; n < 10; n++) await guard.canActivate(context('loginGoogle'));
		await expect(guard.canActivate(context('login'))).rejects.toMatchObject({ status: 429 });
		await expect(guard.canActivate(context('beginSocialLogin'))).resolves.toBe(true);
	});

	it('separates signed accounts sharing an IP, while keeping each account limited across sessions', async () => {
		const a = jwt.sign({ sub: userA, sid: 'first' });
		const a2 = jwt.sign({ sub: userA, sid: 'second' });
		const b = jwt.sign({ sub: userB });
		for (let n = 0; n < 600; n++) await guard.canActivate(context('getInquiry', a));
		await expect(guard.canActivate(context('getInquiry', a2))).rejects.toMatchObject({ status: 429 });
		await expect(guard.canActivate(context('getInquiry', b))).resolves.toBe(true);
	});

	it('keeps forged tokens in the anonymous IP quota', async () => {
		const impostor = new JwtService({ secret: 'wrong-secret' }).sign({ sub: userA });
		for (let n = 0; n < 300; n++) await guard.canActivate(context('getProjects', n % 2 ? impostor : undefined));
		await expect(guard.canActivate(context('getProjects', impostor))).rejects.toMatchObject({ status: 429 });
	});

	it('limits email replacement requests with other account-security actions', async () => {
		const token = jwt.sign({ sub: userA });
		for (let n = 0; n < 20; n++) await guard.canActivate(context('requestEmailChange', token));
		await expect(guard.canActivate(context('requestEmailChange', token))).rejects.toMatchObject({ status: 429 });
		await expect(guard.canActivate(context('getMyAuthIdentities', token))).resolves.toBe(true);
	});

	it('resets expired windows and returns the remaining wait', async () => {
		for (let n = 0; n < 10; n++) await guard.canActivate(context('login'));
		jest.advanceTimersByTime(15000);
		try {
			await guard.canActivate(context('login'));
			throw new Error('Expected a rejection');
		} catch (error) {
			expect(error).toBeInstanceOf(HttpException);
			expect((error as HttpException).getResponse()).toMatchObject({ retryAfterSeconds: 45 });
		}
		jest.advanceTimersByTime(45000);
		await expect(guard.canActivate(context('login'))).resolves.toBe(true);
	});

	it('isolates recovery and account-security actions from discovery and reactions', async () => {
		const token = jwt.sign({ sub: userA });
		for (let n = 0; n < 120; n++) await guard.canActivate(context('setCreatorFollow', token));
		await expect(guard.canActivate(context('setCreatorFollow', token))).rejects.toMatchObject({ status: 429 });
		await expect(guard.canActivate(context('requestPasswordReset'))).resolves.toBe(true);
		await expect(guard.canActivate(context('linkEmail', token))).resolves.toBe(true);
		// Discovery is a normal query, not part of the ten-attempt security budget.
		const discovery = context('discoverCreators', token);
		jest
			.spyOn(discovery, 'getArgs')
			.mockReturnValue([
				null,
				{},
				{ req: { ip: '127.0.0.1', headers: { authorization: `Bearer ${token}` } } },
				{ fieldName: 'discoverCreators', operation: { operation: 'query' } },
			]);
		for (let n = 0; n < 40; n++) await expect(guard.canActivate(discovery)).resolves.toBe(true);
	});
});
