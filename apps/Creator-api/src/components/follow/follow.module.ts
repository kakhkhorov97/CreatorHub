import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ActivityModule } from '../activity/activity.module';
import { CreatorModule } from '../creator/creator.module';
import { ProjectModule } from '../project/project.module';
import CreatorFollowSchema from '../../schemas/CreatorFollow.model';
import { FollowService } from './follow.service';
import { FollowResolver } from './follow.resolver';

@Module({
	imports: [
		AuthModule,
		ActivityModule,
		CreatorModule,
		ProjectModule,
		MongooseModule.forFeature([{ name: 'CreatorFollow', schema: CreatorFollowSchema }]),
	],
	providers: [FollowService, FollowResolver],
	exports: [FollowService],
})
export class FollowModule {}
