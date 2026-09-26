import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { InquiryEventType, InquiryStatus } from '../../enums/creatorhub.enum';
import { Entity } from '../common/entity';

@ObjectType()
export class InquiryEvent extends Entity {
	@Field(() => ID)
	inquiryId!: Types.ObjectId;

	@Field(() => ID)
	performedById!: Types.ObjectId;

	@Field(() => InquiryEventType)
	type!: InquiryEventType;

	@Field(() => InquiryStatus)
	fromStatus!: InquiryStatus;

	@Field(() => InquiryStatus)
	toStatus!: InquiryStatus;

	@Field(() => ID, { nullable: true })
	messageId?: Types.ObjectId;

	@Field(() => Int)
	version!: number;
}
