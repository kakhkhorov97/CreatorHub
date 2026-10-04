import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ActivityModule } from '../activity/activity.module';
import { CreatorModule } from '../creator/creator.module';
import { ProjectModule } from '../project/project.module';
import ProjectLikeSchema from '../../schemas/ProjectLike.model';
import { LikeService } from './like.service';
import { LikeResolver } from './like.resolver';

@Module({
	imports: [
		AuthModule,
		ActivityModule,
		CreatorModule,
		ProjectModule,
		MongooseModule.forFeature([{ name: 'ProjectLike', schema: ProjectLikeSchema }]),
	],
	providers: [LikeService, LikeResolver],
	exports: [LikeService],
})
export class LikeModule {}
