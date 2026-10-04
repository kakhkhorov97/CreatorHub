import { registerEnumType } from '@nestjs/graphql';

export enum InquiryEventType {
	SUBMITTED = 'SUBMITTED',
	MESSAGE_SENT = 'MESSAGE_SENT',
	DECLINED = 'DECLINED',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED',
}

registerEnumType(InquiryEventType, { name: 'InquiryEventType' });
