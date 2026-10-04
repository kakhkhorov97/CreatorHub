import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsMongoId, IsString, IsUUID, Length, Max, Min, ValidateIf } from 'class-validator';
import { InquiryOutcome } from '../../enums/inquiry-outcome.enum';

@InputType()
export class DraftFieldsInput {
	@Field(() => ID, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsMongoId()
	serviceId?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 150)
	subject?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(20, 10000)
	brief?: string;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Max(1000000000)
	budgetMin?: number;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Max(1000000000)
	budgetMax?: number;

	@Field(() => Date, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsDate()
	desiredDeadline?: Date;
}

@InputType()
export class InquiryVersionInput {
	@Field(() => ID)
	@IsMongoId()
	inquiryId!: string;

	@Field(() => Int)
	@IsInt()
	@Min(0)
	@Max(2147483647)
	expectedVersion!: number;
}

@InputType()
export class SendMessageInput {
	@Field(() => ID)
	@IsMongoId()
	inquiryId!: string;

	@Field(() => Int)
	@IsInt()
	@Min(0)
	@Max(2147483647)
	expectedVersion!: number;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsUUID()
	clientMessageKey!: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 5000)
	body!: string;
}

@InputType()
export class CloseInquiryInput {
	@Field(() => ID)
	@IsMongoId()
	inquiryId!: string;

	@Field(() => Int)
	@IsInt()
	@Min(0)
	@Max(2147483647)
	expectedVersion!: number;

	@Field(() => InquiryOutcome)
	@IsEnum(InquiryOutcome)
	outcome!: InquiryOutcome;
}

@InputType()
export class CreateInquiryInput extends DraftFieldsInput {
	@Field(() => ID)
	@IsMongoId()
	creatorId!: string;
}

@InputType()
export class SendInquiryInput extends CreateInquiryInput {
	@Field(() => String)
	@IsString()
	@Length(1, 150)
	declare subject: string;

	@Field(() => String)
	@IsString()
	@Length(20, 10000)
	declare brief: string;

	@Field(() => String)
	@IsUUID()
	clientRequestKey!: string;
}

@InputType()
export class CreateServiceFeedbackInput {
	@Field(() => ID)
	@IsMongoId()
	inquiryId!: string;

	@Field(() => Int)
	@IsInt()
	@Min(1)
	@Max(5)
	rating!: number;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 2000)
	feedback!: string;
}
