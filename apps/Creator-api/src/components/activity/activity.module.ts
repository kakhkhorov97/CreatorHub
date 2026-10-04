import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ProjectLikeSchema from '../../schemas/ProjectLike.model';
import ActivityEventSchema from '../../schemas/ActivityEvent.model';
import NotificationSchema from '../../schemas/Notification.model';
import CreatorFollowSchema from '../../schemas/CreatorFollow.model';
import CreatorProfileSchema from '../../schemas/CreatorProfile.model';
import PortfolioProjectSchema from '../../schemas/PortfolioProject.model';
import ProjectCommentSchema from '../../schemas/ProjectComment.model';
import UserSchema from '../../schemas/User.model';
import { ActivityService } from './activity.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'ProjectLike', schema: ProjectLikeSchema },
			{ name: 'ActivityEvent', schema: ActivityEventSchema },
			{ name: 'Notification', schema: NotificationSchema },
			{ name: 'CreatorFollow', schema: CreatorFollowSchema },
			{ name: 'CreatorProfile', schema: CreatorProfileSchema },
			{ name: 'PortfolioProject', schema: PortfolioProjectSchema },
			{ name: 'ProjectComment', schema: ProjectCommentSchema },
			{ name: 'User', schema: UserSchema },
		]),
	],
	providers: [ActivityService],
	exports: [ActivityService, MongooseModule],
})
export class ActivityModule {}
