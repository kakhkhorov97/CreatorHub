import { ConfigService } from '@nestjs/config';
import { MailService } from '../src/components/auth/mail.service';
import { AuthTokenPurpose } from '../src/libs/enums/auth-token-purpose.enum';

describe('Email action links', () => {
	afterEach(() => jest.restoreAllMocks());

	it.each([
		[AuthTokenPurpose.EMAIL_CHANGE, '/verify-email', 'email-change'],
		[AuthTokenPurpose.EMAIL_VERIFY, '/verify-email', null],
		[AuthTokenPurpose.PASSWORD_RESET, '/reset-password', null],
	])('sends the correct confirmation route for %s', async (purpose, path, kind) => {
		const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
		const service = new MailService(
			new ConfigService({
				FRONTEND_URL: 'https://creatorhub.example',
				MAIL_WEBHOOK_URL: 'https://mail.example/send',
				MAIL_WEBHOOK_TOKEN: 'disposable-test-value',
			}),
		);
		await service.sendToken('replacement@example.com', purpose, 'a'.repeat(64));
		const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
		const url = new URL(body.actionUrl);
		expect(body.to).toBe('replacement@example.com');
		expect(url.pathname).toBe(path);
		expect(url.searchParams.get('purpose')).toBe(kind);
		expect(url.searchParams.get('token')).toBe('a'.repeat(64));
	});
});
