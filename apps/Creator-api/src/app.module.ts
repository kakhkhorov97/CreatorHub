import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { AppController } from './app.controller';
import { AppResolver } from './app.resolver';
import { AppService } from './app.service';
import { ComponentsModule } from './components/components.module';
import { DatabaseModule } from './database/database.module';
import { validateEnvironment } from './libs/config';
import { GraphqlErrorFilter } from './libs/filters/graphql-error.filter';
import { AuthModule } from './components/auth/auth.module';
import { RateLimitGuard } from './components/auth/guards/rate-limit.guard';
import { graphqlRequestLogger } from './libs/interceptors/request-logger';

@Module({
	imports: [
		ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
		GraphQLModule.forRoot<ApolloDriverConfig>({
			driver: ApolloDriver,
			autoSchemaFile: true,
			sortSchema: true,
			playground: process.env.NODE_ENV !== 'production',
			introspection: process.env.NODE_ENV !== 'production',
			includeStacktraceInErrorResponses: false,
			csrfPrevention: true,
			allowBatchedHttpRequests: false,
			plugins: [graphqlRequestLogger],
		}),
		DatabaseModule,
		AuthModule,
		ComponentsModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		AppResolver,
		{ provide: APP_FILTER, useClass: GraphqlErrorFilter },
		{ provide: APP_GUARD, useClass: RateLimitGuard },
	],
})
export class AppModule {}
