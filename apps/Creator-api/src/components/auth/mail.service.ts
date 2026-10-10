import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AuthTokenPurpose } from '../../libs/enums/auth-token-purpose.enum';

@Injectable()
export class MailService {
	private readonly logger = new Logger(MailService.name);

	constructor(private readonly config: ConfigService) {}

	async sendToken(email: string, purpose: AuthTokenPurpose, token: string): Promise<void> {
		const url = new URL(
			purpose === AuthTokenPurpose.PASSWORD_RESET ? '/reset-password' : '/verify-email',
			this.config.getOrThrow<string>('FRONTEND_URL'),
		);
		url.searchParams.set('token', token);
		if (purpose === AuthTokenPurpose.EMAIL_CHANGE) url.searchParams.set('purpose', 'email-change');
		const message = { to: email, template: purpose, actionUrl: url.href };
		const endpoint = this.config.get<string>('MAIL_WEBHOOK_URL');
		if (endpoint) {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.config.getOrThrow<string>('MAIL_WEBHOOK_TOKEN')}`,
				},
				body: JSON.stringify(message),
				signal: AbortSignal.timeout(10000),
				redirect: 'error',
			});
			if (!response.ok)
				throw new ServiceUnavailableException('Email delivery is unavailable. Request a new email later.');
			return;
		}
		if (this.config.get<string>('NODE_ENV') === 'production')
			throw new ServiceUnavailableException('Email delivery is not configured');
		const folder = resolve('.local/mail');
		await mkdir(folder, { recursive: true, mode: 0o700 });
		await writeFile(resolve(folder, `${randomUUID()}.json`), JSON.stringify(message, null, 2), { mode: 0o600 });
		this.logger.log('Development email written to .local/mail');
	}
}
