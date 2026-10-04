import { Field, ObjectType } from '@nestjs/graphql';
import { MutableEntity } from '../common/entity';
import { EventStatus } from '../../enums/event-status.enum';

@ObjectType()
export class CreativeEvent extends MutableEntity {
	@Field(() => String)
	title!: string;

	@Field(() => String)
	description!: string;

	@Field(() => Date)
	startsAt!: Date;

	@Field(() => Date)
	endsAt!: Date;

	@Field(() => String)
	location!: string;

	@Field(() => String, { nullable: true })
	eventUrl?: string;

	@Field(() => EventStatus)
	status!: EventStatus;

	@Field(() => Boolean)
	isDemo!: boolean;
}
