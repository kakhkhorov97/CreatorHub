import { ActivityModule } from '../activity/activity.module';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import InquiryEventSchema from '../../schemas/inquiry/InquiryEvent.model';
import NotificationSchema from '../../schemas/notification/Notification.model';
import { AuthModule } from '../auth/auth.module';
import { NotificationResolver } from './notification.resolver';
import { NotificationService } from './notification.service';

@Module({
	imports: [
		ActivityModule,
		AuthModule,
		MongooseModule.forFeature([
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'InquiryEvent', schema: InquiryEventSchema },
		]),
	],
	providers: [NotificationService, NotificationResolver],
	exports: [NotificationService],
})
export class NotificationModule {}
