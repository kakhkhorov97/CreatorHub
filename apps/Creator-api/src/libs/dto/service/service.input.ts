import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsEnum,
	IsInt,
	IsMongoId,
	IsString,
	Length,
	Max,
	Min,
	ValidateIf,
} from 'class-validator';
import { PricingType } from '../../enums/pricing-type.enum';

@InputType()
export class CreateServiceInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 150)
	title!: string;

	@Field(() => ID, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsMongoId()
	categoryId?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 10000)
	description?: string;

	@Field(() => PricingType, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(PricingType)
	pricingType?: PricingType;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Max(1000000000)
	startingPrice?: number;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(1)
	@Max(365)
	estimatedDays?: number;

	@Field(() => [String], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) =>
		Array.isArray(value) ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : item)) : value,
	)
	@IsArray()
	@ArrayMaxSize(15)
	@ArrayUnique()
	@IsString({ each: true })
	@Length(1, 200, { each: true })
	deliverables?: string[];
}
