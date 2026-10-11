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
		if (this.config.get<string>('RESEND_API_KEY')) {
			await this.sendWithResend(email, purpose, url.href);
			return;
		}
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

	private async sendWithResend(email: string, purpose: AuthTokenPurpose, actionUrl: string): Promise<void> {
		const content = {
			[AuthTokenPurpose.EMAIL_VERIFY]: {
				subject: 'Verify your CreatorHub email',
				instruction: 'Verify your email address to finish setting up your CreatorHub account.',
				action: 'Verify email',
				expiry: '24 hours',
			},
			[AuthTokenPurpose.EMAIL_CHANGE]: {
				subject: 'Confirm your new CreatorHub email',
				instruction: 'Confirm this address to change the email on your CreatorHub account.',
				action: 'Confirm email change',
				expiry: '30 minutes',
			},
			[AuthTokenPurpose.PASSWORD_RESET]: {
				subject: 'Reset your CreatorHub password',
				instruction: 'Use this link to choose a new password for your CreatorHub account.',
				action: 'Reset password',
				expiry: '30 minutes',
			},
		}[purpose];
		const safeUrl = actionUrl
			.replace(/&/g, '&amp;')
			.replace(/"/g, '&quot;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
		const text = `${content.instruction}\n\n${actionUrl}\n\nThis link expires in ${content.expiry}. If you did not request this email, you can ignore it.`;
		const html = `<h1>${content.subject}</h1><p>${content.instruction}</p><p><a href="${safeUrl}">${content.action}</a></p><p>This link expires in ${content.expiry}. If you did not request this email, you can ignore it.</p>`;
		try {
			const response = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${this.config.getOrThrow<string>('RESEND_API_KEY')}`,
				},
				body: JSON.stringify({
					from: this.config.getOrThrow<string>('RESEND_FROM_EMAIL'),
					to: [email],
					subject: content.subject,
					text,
					html,
				}),
				signal: AbortSignal.timeout(10000),
				redirect: 'error',
			});
			if (!response.ok) throw new Error('Email provider rejected the request');
		} catch {
			// Provider responses and errors must not expose credentials or action tokens.
			throw new ServiceUnavailableException('Email delivery is unavailable. Request a new email later.');
		}
	}
}
