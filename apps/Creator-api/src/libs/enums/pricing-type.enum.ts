import { registerEnumType } from '@nestjs/graphql';

export enum PricingType {
	STARTING_AT = 'STARTING_AT',
	CUSTOM_QUOTE = 'CUSTOM_QUOTE',
}

registerEnumType(PricingType, { name: 'PricingType' });
