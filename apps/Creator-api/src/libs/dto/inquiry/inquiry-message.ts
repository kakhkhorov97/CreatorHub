import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Entity } from '../common/entity';

@ObjectType()
export class InquiryMessage extends Entity {
	@Field(() => ID)
	inquiryId!: Types.ObjectId;

	@Field(() => ID)
	senderId!: Types.ObjectId;

	@Field(() => String)
	clientMessageKey!: string;

	@Field(() => String)
	body!: string;

	@Field(() => Date, { nullable: true })
	readAt?: Date;
}
