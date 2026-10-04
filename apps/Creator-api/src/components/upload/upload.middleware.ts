import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { graphqlUploadExpress } from 'graphql-upload';
import express from 'express';
import { resolve } from 'node:path';

export function configureUploads(app: INestApplication): void {
	const config = app.get(ConfigService);
	app.use(graphqlUploadExpress({ maxFileSize: 10_000_000, maxFiles: 10 }));
	app.use(
		'/uploads',
		express.static(resolve(config.get<string>('UPLOAD_DIR') ?? 'uploads'), {
			dotfiles: 'deny',
			index: false,
			setHeaders(response) {
				response.setHeader('X-Content-Type-Options', 'nosniff');
			},
		}),
	);
}
