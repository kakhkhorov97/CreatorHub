import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Currency, PricingType, ServiceStatus } from '../../enums/creatorhub.enum';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class CreatorService extends MutableEntity {
	@Field(() => ID)
	creatorId!: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	categoryId?: Types.ObjectId;

	@Field(() => String)
	title!: string;

	@Field(() => String, { nullable: true })
	description?: string;

	@Field(() => PricingType)
	pricingType!: PricingType;

	@Field(() => Int, { nullable: true })
	startingPrice?: number;

	@Field(() => Currency)
	currency!: Currency;

	@Field(() => Int, { nullable: true })
	estimatedDays?: number;

	@Field(() => [String])
	deliverables!: string[];

	@Field(() => ServiceStatus)
	status!: ServiceStatus;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;
}
