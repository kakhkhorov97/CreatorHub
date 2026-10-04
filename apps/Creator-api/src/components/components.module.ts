import { AdminModule } from './admin/admin.module';
import { EventModule } from './event/event.module';
import { UploadModule } from './upload/upload.module';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoryModule } from './category/category.module';
import { CreatorModule } from './creator/creator.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { LikeModule } from './like/like.module';
import { FollowModule } from './follow/follow.module';
import { SaveModule } from './save/save.module';
import { CommentModule } from './comment/comment.module';
import { InquiryModule } from './inquiry/inquiry.module';
import { NotificationModule } from './notification/notification.module';
import { ProjectModule } from './project/project.module';
import { ServiceModule } from './service/service.module';
import { UserModule } from './user/user.module';

@Module({
	imports: [
		AdminModule,
		EventModule,
		UploadModule,
		AuthModule,
		UserModule,
		CategoryModule,
		CreatorModule,
		ProjectModule,
		ServiceModule,
		LikeModule,
		FollowModule,
		SaveModule,
		CommentModule,
		InquiryModule,
		NotificationModule,
		DiscoveryModule,
	],
})
export class ComponentsModule {}
