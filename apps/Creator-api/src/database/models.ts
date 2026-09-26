import ActivityEventSchema from '../schemas/notification/ActivityEvent.model';
import CreatorFollowSchema from '../schemas/engagement/CreatorFollow.model';
import AuthIdentitySchema from '../schemas/auth/AuthIdentity.model';
import { Connection } from 'mongoose';
import AuthSessionSchema from '../schemas/auth/AuthSession.model';
import AuthTokenSchema from '../schemas/auth/AuthToken.model';
import CategorySchema from '../schemas/category/Category.model';
import CreatorProfileSchema from '../schemas/creator/CreatorProfile.model';
import CreatorServiceSchema from '../schemas/service/CreatorService.model';
import InquirySchema from '../schemas/inquiry/Inquiry.model';
import InquiryEventSchema from '../schemas/inquiry/InquiryEvent.model';
import InquiryMessageSchema from '../schemas/inquiry/InquiryMessage.model';
import NotificationSchema from '../schemas/notification/Notification.model';
import PortfolioProjectSchema from '../schemas/project/PortfolioProject.model';
import ProjectCommentSchema from '../schemas/engagement/ProjectComment.model';
import ProjectLikeSchema from '../schemas/engagement/ProjectLike.model';
import SavedProjectSchema from '../schemas/engagement/SavedProject.model';
import UserSchema from '../schemas/user/User.model';

export const modelDefinitions = [
	{ name: 'ActivityEvent', schema: ActivityEventSchema },
	{ name: 'CreatorFollow', schema: CreatorFollowSchema },
	{ name: 'AuthIdentity', schema: AuthIdentitySchema },
	{ name: 'User', schema: UserSchema },
	{ name: 'CreatorProfile', schema: CreatorProfileSchema },
	{ name: 'Category', schema: CategorySchema },
	{ name: 'PortfolioProject', schema: PortfolioProjectSchema },
	{ name: 'CreatorService', schema: CreatorServiceSchema },
	{ name: 'ProjectLike', schema: ProjectLikeSchema },
	{ name: 'SavedProject', schema: SavedProjectSchema },
	{ name: 'ProjectComment', schema: ProjectCommentSchema },
	{ name: 'Inquiry', schema: InquirySchema },
	{ name: 'InquiryMessage', schema: InquiryMessageSchema },
	{ name: 'InquiryEvent', schema: InquiryEventSchema },
	{ name: 'Notification', schema: NotificationSchema },
	{ name: 'AuthSession', schema: AuthSessionSchema },
	{ name: 'AuthToken', schema: AuthTokenSchema },
];

export function registerModels(connection: Connection) {
	for (const { name, schema } of modelDefinitions) {
		if (!connection.models[name]) connection.model(name, schema);
	}
}
