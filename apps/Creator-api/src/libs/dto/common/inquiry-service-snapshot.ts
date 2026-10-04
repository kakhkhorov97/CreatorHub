import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Currency } from '../../enums/currency.enum';
import { PricingType } from '../../enums/pricing-type.enum';

@ObjectType()
export class InquiryServiceSnapshot {
	@Field(() => String)
	title!: string;

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
}
