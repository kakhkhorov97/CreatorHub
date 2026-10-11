import type { Express } from 'express';

export function configureTrustedProxy(app: Express, setting?: string) {
	app.set('trust proxy', setting === 'loopback' ? 'loopback' : false);
}
