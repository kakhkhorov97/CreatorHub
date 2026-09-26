import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
	USER = 'USER',
	CREATOR = 'CREATOR',
	ADMIN = 'ADMIN',
}
registerEnumType(UserRole, { name: 'UserRole' });

export enum UserStatus {
	ACTIVE = 'ACTIVE',
	SUSPENDED = 'SUSPENDED',
	DELETED = 'DELETED',
}
registerEnumType(UserStatus, { name: 'UserStatus' });

export enum Locale {
	ko = 'ko',
	en = 'en',
}
registerEnumType(Locale, { name: 'Locale' });

export enum CreatorAvailability {
	AVAILABLE = 'AVAILABLE',
	BUSY = 'BUSY',
	UNAVAILABLE = 'UNAVAILABLE',
}
registerEnumType(CreatorAvailability, { name: 'CreatorAvailability' });

export enum ProfileStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	HIDDEN = 'HIDDEN',
}
registerEnumType(ProfileStatus, { name: 'ProfileStatus' });

export enum ProjectStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	ARCHIVED = 'ARCHIVED',
}
registerEnumType(ProjectStatus, { name: 'ProjectStatus' });

export enum ServiceStatus {
	DRAFT = 'DRAFT',
	ACTIVE = 'ACTIVE',
	PAUSED = 'PAUSED',
	ARCHIVED = 'ARCHIVED',
}
registerEnumType(ServiceStatus, { name: 'ServiceStatus' });

export enum PricingType {
	STARTING_AT = 'STARTING_AT',
	CUSTOM_QUOTE = 'CUSTOM_QUOTE',
}
registerEnumType(PricingType, { name: 'PricingType' });

export enum Currency {
	KRW = 'KRW',
}
registerEnumType(Currency, { name: 'Currency' });

export enum MediaType {
	IMAGE = 'IMAGE',
	VIDEO = 'VIDEO',
}
registerEnumType(MediaType, { name: 'MediaType' });

export enum CommentStatus {
	ACTIVE = 'ACTIVE',
	HIDDEN = 'HIDDEN',
	DELETED = 'DELETED',
}
registerEnumType(CommentStatus, { name: 'CommentStatus' });

export enum InquiryStatus {
	DRAFT = 'DRAFT',
	SENT = 'SENT',
	IN_DISCUSSION = 'IN_DISCUSSION',
	DECLINED = 'DECLINED',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(InquiryStatus, { name: 'InquiryStatus' });

export enum InquiryOutcome {
	AGREED_TO_PROCEED = 'AGREED_TO_PROCEED',
	NOT_PROCEEDING = 'NOT_PROCEEDING',
	NO_RESPONSE = 'NO_RESPONSE',
}
registerEnumType(InquiryOutcome, { name: 'InquiryOutcome' });

export enum InquiryEventType {
	SUBMITTED = 'SUBMITTED',
	MESSAGE_SENT = 'MESSAGE_SENT',
	DECLINED = 'DECLINED',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(InquiryEventType, { name: 'InquiryEventType' });

export enum AuthTokenPurpose {
	EMAIL_VERIFY = 'EMAIL_VERIFY',
	PASSWORD_RESET = 'PASSWORD_RESET',
}
registerEnumType(AuthTokenPurpose, { name: 'AuthTokenPurpose' });

export enum AuthProvider {
	EMAIL = 'EMAIL',
	PHONE = 'PHONE',
	GOOGLE = 'GOOGLE',
	TELEGRAM = 'TELEGRAM',
	KAKAO = 'KAKAO',
}
registerEnumType(AuthProvider, { name: 'AuthProvider' });
export enum ActivityEventType {
	PROJECT_PUBLISHED = 'PROJECT_PUBLISHED',
	PROJECT_LIKED = 'PROJECT_LIKED',
	PROJECT_COMMENTED = 'PROJECT_COMMENTED',
	CREATOR_FOLLOWED = 'CREATOR_FOLLOWED',
}
registerEnumType(ActivityEventType, { name: 'ActivityEventType' });
export enum ActivityDeliveryStatus {
	PENDING = 'PENDING',
	PROCESSING = 'PROCESSING',
	COMPLETE = 'COMPLETE',
}
registerEnumType(ActivityDeliveryStatus, { name: 'ActivityDeliveryStatus' });
