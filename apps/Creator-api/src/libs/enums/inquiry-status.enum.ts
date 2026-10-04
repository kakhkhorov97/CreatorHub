import { registerEnumType } from '@nestjs/graphql';

export enum InquiryStatus {
	DRAFT = 'DRAFT',
	SENT = 'SENT',
	IN_DISCUSSION = 'IN_DISCUSSION',
	DECLINED = 'DECLINED',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED',
}

registerEnumType(InquiryStatus, { name: 'InquiryStatus' });
