import { LoggingInterceptor } from './libs/interceptors/logging.interceptor';
import { configureUploads } from './components/upload/upload.middleware';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { requestLogger } from './libs/interceptors/request-logger';

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const config = app.get(ConfigService);
	app.use(requestLogger);
	app.useGlobalInterceptors(new LoggingInterceptor());
	configureUploads(app);
	app.useGlobalPipes(
		new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true }),
	);
	app.enableCors({ origin: config.getOrThrow<string>('FRONTEND_URL'), credentials: false });
	app.enableShutdownHooks();
	await app.listen(process.env.PORT_API ?? 7001);
}

bootstrap().catch(() => {
	process.stderr.write('CreatorHub failed to start. Check configuration and database availability.\n');
	process.exitCode = 1;
});
