import { Body, Controller, HttpCode, HttpException, Post, Req, Res } from '@nestjs/common';
import { IsEmail, IsString, MaxLength, MinLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request, Response } from 'express';
import { MailService } from '../auth/mail.service';

export class ContactInput {
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MinLength(2)
	@MaxLength(100)
	@Matches(/^[^\r\n]+$/)
	name: string;

	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsEmail()
	@MaxLength(254)
	email: string;

	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MinLength(10)
	@MaxLength(5000)
	message: string;

	@IsString()
	@MaxLength(0)
	website: string;
}

@Controller('contact')
export class ContactController {
	private readonly attempts = new Map<string, { count: number; expires: number }>();

	constructor(private readonly mail: MailService) {}

	@Post()
	@HttpCode(202)
	async send(@Body() input: ContactInput, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
		const now = Date.now();
		for (const [key, value] of this.attempts) if (value.expires <= now) this.attempts.delete(key);
		const key = request.ip || request.socket.remoteAddress || 'unknown';
		const window = this.attempts.get(key) || { count: 0, expires: now + 15 * 60 * 1000 };
		if (window.count >= 3 || (!this.attempts.has(key) && this.attempts.size >= 10000)) {
			response.setHeader('Retry-After', String(Math.max(1, Math.ceil((window.expires - now) / 1000))));
			throw new HttpException('Please wait before sending another message.', 429);
		}
		window.count += 1;
		this.attempts.set(key, window);
		await this.mail.sendContact(input.name, input.email, input.message);
		return { accepted: true };
	}
}
