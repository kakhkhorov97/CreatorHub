import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { modelDefinitions } from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { ActivityModule } from '../activity/activity.module';
import { MediaPolicy } from '../../libs/helpers/media-policy.service';
import { ReviewService } from './review.service';
import { ReviewResolver } from './review.resolver';

@Module({
	imports: [
		AuthModule,
		CategoryModule,
		ActivityModule,
		MongooseModule.forFeature(
			modelDefinitions.filter((m) =>
				['ContentReview', 'CreatorProfile', 'PortfolioProject', 'CreatorService', 'User'].includes(m.name),
			),
		),
	],
	providers: [ReviewService, ReviewResolver, MediaPolicy],
	exports: [ReviewService],
})
export class ReviewModule {}
