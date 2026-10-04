import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsString, Length, Max, Min, ValidateIf } from 'class-validator';
import { EventStatus } from '../../enums/event-status.enum';
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

@InputType()
export class EventInput {
	@Field(() => String)
	@Transform(trim)
	@IsString()
	@Length(1, 160)
	title!: string;

	@Field(() => String)
	@Transform(trim)
	@IsString()
	@Length(1, 3000)
	description!: string;

	@Field(() => Date)
	@IsDate()
	startsAt!: Date;

	@Field(() => Date)
	@IsDate()
	endsAt!: Date;

	@Field(() => String)
	@Transform(trim)
	@IsString()
	@Length(1, 200)
	location!: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(trim)
	@IsString()
	@Length(0, 2000)
	eventUrl?: string;

	@Field(() => EventStatus)
	@IsEnum(EventStatus)
	status!: EventStatus;

	@Field(() => Boolean)
	@IsBoolean()
	isDemo!: boolean;
}

@InputType()
export class EventsInput {
	@Field(() => Boolean, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	upcoming?: boolean;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(1)
	@Max(10000)
	page?: number;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(1)
	@Max(50)
	limit?: number;
}
