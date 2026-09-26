import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEnum, IsString, IsUrl, Length, MaxLength, ValidateIf } from 'class-validator';
import { Locale } from '../../enums/creatorhub.enum';

@InputType()
export class UpdateUserInput {
	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(2, 60)
	displayName?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MaxLength(2048)
	@IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true, disallow_auth: true })
	avatarUrl?: string;

	@Field(() => Locale, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(Locale)
	preferredLocale?: Locale;
}
