import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { BatchModule } from './batch.module';

async function bootstrap() {
	const app = await NestFactory.create(BatchModule);

	app.enableShutdownHooks();
	await app.listen(process.env.PORT_BATCH ?? 7002, app.get(ConfigService).get<string>('LISTEN_HOST') ?? '0.0.0.0');
}

bootstrap();
