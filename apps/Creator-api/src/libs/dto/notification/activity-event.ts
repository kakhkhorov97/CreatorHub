import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { MutableEntity } from '../common/entity';
import { ActivityDeliveryStatus } from '../../enums/activity-delivery-status.enum';
import { ActivityEventType } from '../../enums/activity-event-type.enum';

@ObjectType()
export class ActivityEvent extends MutableEntity {
	@Field(() => ID)
	performedById!: Types.ObjectId;

	@Field(() => ID)
	creatorId!: Types.ObjectId;

	@Field(() => ActivityEventType)
	type!: ActivityEventType;

	@Field(() => ID, { nullable: true })
	projectId?: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	commentId?: Types.ObjectId;

	actionKey!: string;

	deliveryStatus!: ActivityDeliveryStatus;

	deliveryCursor?: string;

	leaseUntil?: Date;

	nextAttemptAt!: Date;

	attempts!: number;

	completedAt?: Date;
}
