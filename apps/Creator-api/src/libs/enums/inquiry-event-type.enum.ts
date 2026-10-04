import { registerEnumType } from '@nestjs/graphql';

export enum InquiryEventType {
	COMPLETED = 'COMPLETED',
	SUBMITTED = 'SUBMITTED',
	MESSAGE_SENT = 'MESSAGE_SENT',
	DECLINED = 'DECLINED',
	CLOSED = 'CLOSED',
	CANCELLED = 'CANCELLED',
}

registerEnumType(InquiryEventType, { name: 'InquiryEventType' });
