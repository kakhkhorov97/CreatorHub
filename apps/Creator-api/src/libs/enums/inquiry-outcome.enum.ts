import { registerEnumType } from '@nestjs/graphql';

export enum InquiryOutcome {
	AGREED_TO_PROCEED = 'AGREED_TO_PROCEED',
	COMPLETED = 'COMPLETED',
	NOT_PROCEEDING = 'NOT_PROCEEDING',
	NO_RESPONSE = 'NO_RESPONSE',
}

registerEnumType(InquiryOutcome, { name: 'InquiryOutcome' });
