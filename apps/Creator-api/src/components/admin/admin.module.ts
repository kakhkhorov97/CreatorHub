import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { modelDefinitions } from '../../database/models';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { CreatorModule } from '../creator/creator.module';
import { ActivityModule } from '../activity/activity.module';
import { MediaPolicy } from '../../libs/helpers/media-policy.service';
import { AdminService } from './admin.service';
import { AdminResolver, SiteContentResolver } from './admin.resolver';
@Module({
	imports: [
		AuthModule,
		CategoryModule,
		CreatorModule,
		ActivityModule,
		MongooseModule.forFeature(
			modelDefinitions.filter((m) =>
				[
					'User',
					'CreatorProfile',
					'PortfolioProject',
					'CreatorService',
					'ProjectComment',
					'SiteContent',
					'Category',
					'CreativeEvent',
				].includes(m.name),
			),
		),
	],
	providers: [AdminService, AdminResolver, SiteContentResolver, MediaPolicy],
})
export class AdminModule {}
