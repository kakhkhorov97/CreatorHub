import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { CreatorModule } from './creator/creator.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { EngagementModule } from './engagement/engagement.module';
import { InquiryModule } from './inquiry/inquiry.module';
import { NotificationModule } from './notification/notification.module';
import { ProjectModule } from './project/project.module';
import { ServiceModule } from './service/service.module';
import { UserModule } from './user/user.module';

@Module({
	imports: [
		AuthModule,
		UserModule,
		CategoryModule,
		CreatorModule,
		ProjectModule,
		ServiceModule,
		EngagementModule,
		InquiryModule,
		NotificationModule,
		DiscoveryModule,
	],
})
export class ComponentsModule {}
