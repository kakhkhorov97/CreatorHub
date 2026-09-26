import { Field, InputType, Int } from '@nestjs/graphql';
import { IsInt, Max, Min, ValidateIf } from 'class-validator';

@InputType()
export class PageInput {
	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Max(10000)
	offset?: number;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(1)
	@Max(50)
	limit?: number;
}
