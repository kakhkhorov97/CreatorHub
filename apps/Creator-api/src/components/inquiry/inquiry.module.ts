import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CreatorProfileSchema from '../../schemas/creator/CreatorProfile.model';
import InquirySchema from '../../schemas/inquiry/Inquiry.model';
import InquiryEventSchema from '../../schemas/inquiry/InquiryEvent.model';
import InquiryMessageSchema from '../../schemas/inquiry/InquiryMessage.model';
import NotificationSchema from '../../schemas/notification/Notification.model';
import UserSchema from '../../schemas/user/User.model';
import { AuthModule } from '../auth/auth.module';
import { CreatorModule } from '../creator/creator.module';
import { ServiceModule } from '../service/service.module';
import { InquiryResolver } from './inquiry.resolver';
import { InquiryService } from './inquiry.service';

@Module({
	imports: [
		AuthModule,
		CreatorModule,
		ServiceModule,
		MongooseModule.forFeature([
			{ name: 'Inquiry', schema: InquirySchema },
			{ name: 'InquiryMessage', schema: InquiryMessageSchema },
			{ name: 'InquiryEvent', schema: InquiryEventSchema },
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'CreatorProfile', schema: CreatorProfileSchema },
			{ name: 'User', schema: UserSchema },
		]),
	],
	providers: [InquiryService, InquiryResolver],
	exports: [InquiryService],
})
export class InquiryModule {}
