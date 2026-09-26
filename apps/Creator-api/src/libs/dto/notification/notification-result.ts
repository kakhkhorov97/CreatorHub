import { Field, ObjectType } from '@nestjs/graphql';
import { InquiryEvent } from '../inquiry/inquiry-event';
import { ActivityEvent } from './activity-event';
import { Notification } from './notification';

@ObjectType()
export class NotificationResult extends Notification {
	@Field(() => InquiryEvent, { nullable: true })
	event?: InquiryEvent;

	@Field(() => ActivityEvent, { nullable: true })
	activityEvent?: ActivityEvent;

	@Field(() => Boolean)
	unavailable: boolean;
}
