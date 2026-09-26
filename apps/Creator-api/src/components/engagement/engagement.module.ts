import { ActivityModule } from '../activity/activity.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ProjectCommentSchema from '../../schemas/engagement/ProjectComment.model';
import ProjectLikeSchema from '../../schemas/engagement/ProjectLike.model';
import SavedProjectSchema from '../../schemas/engagement/SavedProject.model';
import { AuthModule } from '../auth/auth.module';
import { CreatorModule } from '../creator/creator.module';
import { ProjectModule } from '../project/project.module';
import { EngagementResolver } from './engagement.resolver';
import { EngagementService } from './engagement.service';

@Module({
	imports: [
		ActivityModule,
		AuthModule,
		CreatorModule,
		ProjectModule,
		MongooseModule.forFeature([
			{ name: 'ProjectLike', schema: ProjectLikeSchema },
			{ name: 'SavedProject', schema: SavedProjectSchema },
			{ name: 'ProjectComment', schema: ProjectCommentSchema },
		]),
	],
	providers: [EngagementService, EngagementResolver],
	exports: [EngagementService],
})
export class EngagementModule {}
