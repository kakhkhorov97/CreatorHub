import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { requestLogger } from './libs/utils/request-logger';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const config = app.get(ConfigService);
	app.use(requestLogger);
	app.useGlobalPipes(
		new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }),
	);
	app.enableCors({ origin: config.getOrThrow<string>('FRONTEND_URL'), credentials: false });
	app.enableShutdownHooks();
	await app.listen(process.env.PORT_API ?? 3001);
}
bootstrap().catch(() => {
	process.stderr.write('CreatorHub failed to start. Check configuration and database availability.\n');
	process.exitCode = 1;
});
