import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import ProjectLikeSchema from '../../schemas/engagement/ProjectLike.model';
import ActivityEventSchema from '../../schemas/notification/ActivityEvent.model';
import NotificationSchema from '../../schemas/notification/Notification.model';
import CreatorFollowSchema from '../../schemas/engagement/CreatorFollow.model';
import CreatorProfileSchema from '../../schemas/creator/CreatorProfile.model';
import PortfolioProjectSchema from '../../schemas/project/PortfolioProject.model';
import ProjectCommentSchema from '../../schemas/engagement/ProjectComment.model';
import UserSchema from '../../schemas/user/User.model';
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
