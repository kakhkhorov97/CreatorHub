import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
	constructor(
		private readonly appService: AppService,
		@InjectConnection() private readonly connection: Connection,
	) {}

	@Get('health')
	@Header('Cache-Control', 'no-store')
	async health() {
		try {
			if (this.connection.readyState !== 1 || !this.connection.db) throw new Error('Database unavailable');
			await this.connection.db.command({ ping: 1 }, { timeoutMS: 2000 });
			return { status: 'ok' };
		} catch {
			throw new ServiceUnavailableException('Service unavailable');
		}
	}

	@Get()
	getHello(): string {
		return this.appService.getHello();
	}
}
