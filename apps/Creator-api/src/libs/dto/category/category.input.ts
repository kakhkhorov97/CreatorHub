import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsString, Length, Matches, Max, Min, ValidateIf } from 'class-validator';

@InputType()
export class CategoryInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(2, 80)
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	slug!: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 80)
	name!: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 500)
	description?: string;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Max(10000)
	sortOrder?: number;

	@Field(() => Boolean, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	isActive?: boolean;
}
