import { Field, ID, InputType, Int } from '@nestjs/graphql';

import { IsBoolean, IsInt, IsMongoId, Min, ValidateIf } from 'class-validator';

import { DraftFieldsInput } from './inquiry.input';

@InputType()
export class UpdateInquiryInput extends DraftFieldsInput {
	@Field(() => ID)
	@IsMongoId()
	inquiryId!: string;

	@Field(() => Int)
	@IsInt()
	@Min(0)
	expectedVersion!: number;

	@Field({ nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	clearService?: boolean;
}
