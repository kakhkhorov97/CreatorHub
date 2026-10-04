import { ActivityModule } from '../activity/activity.module';
import { ReviewModule } from '../review/review.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaPolicy } from '../../libs/helpers/media-policy.service';
import PortfolioProjectSchema from '../../schemas/PortfolioProject.model';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { CreatorModule } from '../creator/creator.module';
import { ProjectResolver } from './project.resolver';
import { ProjectService } from './project.service';

@Module({
	imports: [
		ReviewModule,
		ActivityModule,
		AuthModule,
		CreatorModule,
		CategoryModule,
		MongooseModule.forFeature([{ name: 'PortfolioProject', schema: PortfolioProjectSchema }]),
	],
	providers: [ProjectService, ProjectResolver, MediaPolicy],
	exports: [ProjectService],
})
export class ProjectModule {}
