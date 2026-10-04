import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../Creator-api/src/database/database.module';
import { ActivityModule } from '../../Creator-api/src/components/activity/activity.module';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule, ActivityModule, ScheduleModule.forRoot()],
	controllers: [BatchController],
	providers: [BatchService],
})
export class BatchModule {}
