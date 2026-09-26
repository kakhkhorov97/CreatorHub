import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

// Reserved entry point. Version 1 uses MongoDB TTL indexes, not ranking jobs.
@Module({ imports: [ConfigModule.forRoot()], controllers: [BatchController], providers: [BatchService] })
export class BatchModule {}
