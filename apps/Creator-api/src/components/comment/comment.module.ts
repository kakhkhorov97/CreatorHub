import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ActivityModule } from '../activity/activity.module';
import { CreatorModule } from '../creator/creator.module';
import { ProjectModule } from '../project/project.module';
import ProjectCommentSchema from '../../schemas/ProjectComment.model';
import { CommentService } from './comment.service';
import { CommentResolver } from './comment.resolver';

@Module({
	imports: [
		AuthModule,
		ActivityModule,
		CreatorModule,
		ProjectModule,
		MongooseModule.forFeature([{ name: 'ProjectComment', schema: ProjectCommentSchema }]),
	],
	providers: [CommentService, CommentResolver],
	exports: [CommentService],
})
export class CommentModule {}
