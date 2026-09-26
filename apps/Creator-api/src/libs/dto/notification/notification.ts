import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Entity } from '../common/entity';

@ObjectType()
export class Notification extends Entity {
	@Field(() => ID)
	recipientId!: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	inquiryEventId?: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	activityEventId?: Types.ObjectId;

	@Field(() => Date, { nullable: true })
	readAt?: Date;
}
