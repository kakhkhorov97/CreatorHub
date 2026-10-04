import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CreatorProfileSchema from '../../schemas/CreatorProfile.model';
import ServiceFeedbackSchema from '../../schemas/ServiceFeedback.model';
import InquirySchema from '../../schemas/Inquiry.model';
import InquiryEventSchema from '../../schemas/InquiryEvent.model';
import InquiryMessageSchema from '../../schemas/InquiryMessage.model';
import NotificationSchema from '../../schemas/Notification.model';
import UserSchema from '../../schemas/User.model';
import { AuthModule } from '../auth/auth.module';
import { CreatorModule } from '../creator/creator.module';
import { ServiceModule } from '../service/service.module';
import { InquiryResolver, ServiceFeedbackResolver } from './inquiry.resolver';
import { InquiryService } from './inquiry.service';

@Module({
	imports: [
		AuthModule,
		CreatorModule,
		ServiceModule,
		MongooseModule.forFeature([
			{ name: 'Inquiry', schema: InquirySchema },
			{ name: 'ServiceFeedback', schema: ServiceFeedbackSchema },
			{ name: 'InquiryMessage', schema: InquiryMessageSchema },
			{ name: 'InquiryEvent', schema: InquiryEventSchema },
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'CreatorProfile', schema: CreatorProfileSchema },
			{ name: 'User', schema: UserSchema },
		]),
	],
	providers: [InquiryService, InquiryResolver, ServiceFeedbackResolver],
	exports: [InquiryService],
})
export class InquiryModule {}
