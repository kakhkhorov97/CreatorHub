import { ConfigService } from '@nestjs/config';
import { ValidationPipe, HttpException } from '@nestjs/common';
import { ContactController, ContactInput } from '../src/components/contact/contact.controller';
import { MailService } from '../src/components/auth/mail.service';
import type { Request, Response } from 'express';

const valid = { name: 'Sean', email: 'reader@example.com', message: 'I need help with my account.', website: '' };
describe('Contact messages', () => {
	afterEach(() => jest.restoreAllMocks());
	const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
	it.each([
		{ ...valid, email: 'bad' },
		{ ...valid, name: 'S' },
		{ ...valid, name: 'Name\nInjected' },
		{ ...valid, message: 'short' },
		{ ...valid, website: 'spam' },
		{ ...valid, to: 'evil@example.com' },
	])('rejects invalid and injected values', async (input) => {
		await expect(pipe.transform(input, { type: 'body', metatype: ContactInput })).rejects.toThrow();
	});
	it('sends to the fixed team recipient with a safe reply address and plain text', async () => {
		const mocked = jest.spyOn(global, 'fetch').mockResolvedValue(new globalThis.Response(null, { status: 200 }));
		const mail = new MailService(
			new ConfigService({ RESEND_API_KEY: 'disposable', RESEND_FROM_EMAIL: 'CreatorHub <noreply@example.com>' }),
		);
		await mail.sendContact(valid.name, valid.email, '<script>plain text only</script>');
		const body = JSON.parse(String(mocked.mock.calls[0][1]?.body));
		expect(body.to).toEqual(['kakhkhorov97@gmail.com']);
		expect(body.reply_to).toBe(valid.email);
		expect(body.html).toBeUndefined();
	});
	it('does not claim success if delivery fails', async () => {
		jest.spyOn(global, 'fetch').mockRejectedValue(new Error('private provider detail'));
		const mail = new MailService(
			new ConfigService({ RESEND_API_KEY: 'disposable', RESEND_FROM_EMAIL: 'noreply@example.com' }),
		);
		await expect(mail.sendContact(valid.name, valid.email, valid.message)).rejects.toThrow(
			'Your message could not be delivered.',
		);
	});
	it('limits each client separately and sets a retry delay', async () => {
		const mail = { sendContact: jest.fn().mockResolvedValue(undefined) } as unknown as MailService;
		const controller = new ContactController(mail);
		const response = { setHeader: jest.fn() } as unknown as Response;
		const request = { ip: '192.0.2.10', socket: {} } as Request;
		for (let i = 0; i < 3; i++) expect(await controller.send(valid, request, response)).toEqual({ accepted: true });
		await expect(controller.send(valid, request, response)).rejects.toBeInstanceOf(HttpException);
		expect(response.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
		expect(await controller.send(valid, { ip: '192.0.2.11', socket: {} } as Request, response)).toEqual({
			accepted: true,
		});
		expect(mail.sendContact).toHaveBeenCalledTimes(4);
	});
});

import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GraphqlErrorFilter } from '../src/libs/filters/graphql-error.filter';
describe('Contact HTTP responses', () => {
	it('returns JSON validation and delivery errors without hanging or exposing provider details', async () => {
		const module = await Test.createTestingModule({
			controllers: [ContactController],
			providers: [
				{
					provide: MailService,
					useValue: { sendContact: jest.fn().mockRejectedValue(new Error('private provider credentials')) },
				},
			],
		}).compile();
		const app = module.createNestApplication();
		app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
		app.useGlobalFilters(new GraphqlErrorFilter());
		await app.init();
		try {
			const invalid = await request(app.getHttpServer())
				.post('/contact')
				.send({ ...valid, email: 'bad' })
				.expect(400);
			expect(invalid.body.message).toBeDefined();
			const failure = await request(app.getHttpServer()).post('/contact').send(valid).expect(500);
			expect(JSON.stringify(failure.body)).not.toContain('credentials');
		} finally {
			await app.close();
		}
	});
});
