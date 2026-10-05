import { MetaCounter } from '../common/meta-counter';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Currency } from '../../enums/currency.enum';
import { InquiryOutcome } from '../../enums/inquiry-outcome.enum';
import { InquiryStatus } from '../../enums/inquiry-status.enum';
import { MutableEntity } from '../common/entity';
import { InquiryServiceSnapshot } from '../common/inquiry-service-snapshot';

@ObjectType()
export class Inquiry extends MutableEntity {
	clientRequestKey?: string;

	@Field(() => String, { nullable: true })
	counterpartyName?: string;

	@Field(() => String, { nullable: true })
	counterpartyAvatarUrl?: string;

	@Field(() => Int, { nullable: true })
	unreadCount?: number;

	@Field(() => ID)
	clientId!: Types.ObjectId;

	@Field(() => ID)
	creatorId!: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	serviceId?: Types.ObjectId;

	@Field(() => String, { nullable: true })
	subject?: string;

	@Field(() => String, { nullable: true })
	brief?: string;

	@Field(() => Int, { nullable: true })
	budgetMin?: number;

	@Field(() => Int, { nullable: true })
	budgetMax?: number;

	@Field(() => Currency)
	currency!: Currency;

	@Field(() => Date, { nullable: true })
	desiredDeadline?: Date;

	@Field(() => InquiryServiceSnapshot, { nullable: true })
	serviceSnapshot?: InquiryServiceSnapshot;

	@Field(() => InquiryStatus)
	status!: InquiryStatus;

	@Field(() => InquiryOutcome, { nullable: true })
	outcome?: InquiryOutcome;

	@Field(() => ID, { nullable: true })
	closedById?: Types.ObjectId;

	@Field(() => Date, { nullable: true })
	closedAt?: Date;

	@Field(() => Date, { nullable: true })
	submittedAt?: Date;

	@Field(() => Date, { nullable: true })
	lastMessageAt?: Date;

	@Field(() => Int)
	version!: number;
}

@ObjectType()
export class Inquiries {
	@Field(() => [Inquiry])
	list!: Inquiry[];

	@Field(() => [MetaCounter])
	metaCounter!: MetaCounter[];
}
