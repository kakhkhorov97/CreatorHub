import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { MailService } from '../src/components/auth/mail.service';
import { AuthTokenPurpose } from '../src/libs/enums/auth-token-purpose.enum';
import { validateEnvironment } from '../src/libs/config';

const resendConfig = {
	FRONTEND_URL: 'https://creatorhub.example',
	RESEND_API_KEY: 're_disposable_test_value',
	RESEND_FROM_EMAIL: 'CreatorHub <noreply@creatorhub.example>',
};

describe('Resend email delivery', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each([
		[AuthTokenPurpose.EMAIL_VERIFY, '/verify-email', null, 'Verify your CreatorHub email', '24 hours'],
		[AuthTokenPurpose.EMAIL_CHANGE, '/verify-email', 'email-change', 'Confirm your new CreatorHub email', '30 minutes'],
		[AuthTokenPurpose.PASSWORD_RESET, '/reset-password', null, 'Reset your CreatorHub password', '30 minutes'],
	])('sends a usable plain-text and HTML action link for %s', async (purpose, path, kind, subject, expiry) => {
		const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
		await new MailService(new ConfigService(resendConfig)).sendToken('member@example.com', purpose, 'a'.repeat(64));
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [endpoint, request] = fetchMock.mock.calls[0];
		expect(endpoint).toBe('https://api.resend.com/emails');
		expect(request?.headers).toMatchObject({ Authorization: `Bearer ${resendConfig.RESEND_API_KEY}` });
		expect(request?.redirect).toBe('error');
		const body = JSON.parse(String(request?.body));
		expect(body).toMatchObject({ from: resendConfig.RESEND_FROM_EMAIL, to: ['member@example.com'], subject });
		const url = new URL(body.text.split('\n\n')[1]);
		expect(url.pathname).toBe(path);
		expect(url.searchParams.get('purpose')).toBe(kind);
		expect(url.searchParams.get('token')).toBe('a'.repeat(64));
		expect(body.text).toContain(expiry);
		expect(body.html).toContain(url.href.replace(/&/g, '&amp;'));
		expect(body.html).not.toContain(resendConfig.RESEND_API_KEY);
	});

	it.each(['rejection', 'timeout'])('returns a generic delivery error on %s without falling back', async (failure) => {
		const fetchMock = jest.spyOn(global, 'fetch');
		if (failure === 'timeout') fetchMock.mockRejectedValue(new Error('private provider details'));
		else fetchMock.mockResolvedValue({ ok: false } as Response);
		const service = new MailService(
			new ConfigService({ ...resendConfig, MAIL_WEBHOOK_URL: 'https://mail.example/send' }),
		);
		await expect(
			service.sendToken('member@example.com', AuthTokenPurpose.EMAIL_VERIFY, 'private-action-token'),
		).rejects.toThrow(ServiceUnavailableException);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe('Resend production configuration', () => {
	const environment = {
		...resendConfig,
		NODE_ENV: 'production',
		JWT_SECRET: 'x'.repeat(32),
		MONGO_PROD: 'mongodb://localhost:27017/disposable',
		UPLOAD_BASE_URL: 'https://api.creatorhub.example/uploads',
	};

	it('accepts Resend as production email delivery without a custom webhook', () => {
		expect(() => validateEnvironment(environment)).not.toThrow();
	});

	it.each(['RESEND_API_KEY', 'RESEND_FROM_EMAIL'])('rejects a missing %s', (key) => {
		expect(() => validateEnvironment({ ...environment, [key]: '' })).toThrow('Set both');
	});

	it('rejects a sender containing header injection', () => {
		expect(() =>
			validateEnvironment({ ...environment, RESEND_FROM_EMAIL: 'noreply@example.com\r\nBcc: other@example.com' }),
		).toThrow('Set a valid RESEND_FROM_EMAIL');
	});

	it('still requires email delivery and HTTPS uploads in production', () => {
		expect(() => validateEnvironment({ ...environment, RESEND_API_KEY: '', RESEND_FROM_EMAIL: '' })).toThrow(
			'Production requires email delivery',
		);
		expect(() => validateEnvironment({ ...environment, UPLOAD_BASE_URL: 'http://localhost/uploads' })).toThrow(
			'HTTPS URL',
		);
	});
});
