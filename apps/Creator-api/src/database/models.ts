import SiteContentSchema from '../schemas/SiteContent.model';
import CreativeEventSchema from '../schemas/CreativeEvent.model';
import ActivityEventSchema from '../schemas/ActivityEvent.model';
import CreatorFollowSchema from '../schemas/CreatorFollow.model';
import AuthIdentitySchema from '../schemas/AuthIdentity.model';
import { Connection } from 'mongoose';
import AuthSessionSchema from '../schemas/AuthSession.model';
import AuthTokenSchema from '../schemas/AuthToken.model';
import CategorySchema from '../schemas/Category.model';
import CreatorProfileSchema from '../schemas/CreatorProfile.model';
import CreatorServiceSchema from '../schemas/CreatorService.model';
import InquirySchema from '../schemas/Inquiry.model';
import InquiryEventSchema from '../schemas/InquiryEvent.model';
import InquiryMessageSchema from '../schemas/InquiryMessage.model';
import NotificationSchema from '../schemas/Notification.model';
import PortfolioProjectSchema from '../schemas/PortfolioProject.model';
import ProjectCommentSchema from '../schemas/ProjectComment.model';
import ProjectLikeSchema from '../schemas/ProjectLike.model';
import SavedProjectSchema from '../schemas/SavedProject.model';
import UserSchema from '../schemas/User.model';

export const modelDefinitions = [
	{ name: 'SiteContent', schema: SiteContentSchema },
	{ name: 'CreativeEvent', schema: CreativeEventSchema },
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
