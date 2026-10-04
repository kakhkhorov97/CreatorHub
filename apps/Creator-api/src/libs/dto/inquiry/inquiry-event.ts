import { MetaCounter } from '../common/meta-counter';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { InquiryEventType } from '../../enums/inquiry-event-type.enum';
import { InquiryStatus } from '../../enums/inquiry-status.enum';
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

@ObjectType()
export class InquiryEvents {
	@Field(() => [InquiryEvent])
	list!: InquiryEvent[];

	@Field(() => [MetaCounter])
	metaCounter!: MetaCounter[];
}
