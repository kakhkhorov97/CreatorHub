import { Field, InputType, OmitType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
	IsIn,
	IsNotEmpty,
	Matches,
	IsPhoneNumber,
	IsEmail,
	IsEnum,
	IsString,
	Length,
	MaxLength,
	ValidateIf,
} from 'class-validator';
import { normalizePhone } from '../../utils/phone';
import { AuthProvider, Locale } from '../../enums/creatorhub.enum';

@InputType()
export class RegisterInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
	@IsEmail()
	@MaxLength(254)
	email!: string;

	@Field(() => String)
	@IsString()
	@Length(12, 128)
	declare password: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(2, 60)
	displayName!: string;

	@Field(() => Locale, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(Locale)
	preferredLocale?: Locale;
}

@InputType()
export class LoginInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
	@IsEmail()
	@MaxLength(254)
	email!: string;

	@Field(() => String)
	@IsString()
	@Length(1, 128)
	password!: string;
}

@InputType()
export class ResetPasswordInput {
	@Field(() => String)
	@IsString()
	@Length(64, 64)
	token!: string;

	@Field(() => String)
	@IsString()
	@Length(12, 128)
	declare password: string;
}

@InputType()
export class EmailInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
	@IsEmail()
	@MaxLength(254)
	email!: string;
}

@InputType()
export class PhoneLoginInput {
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === 'string' ? normalizePhone(value) : value))
	@Matches(/^\+[1-9]\d{7,14}$/)
	@IsPhoneNumber()
	@Field(() => String)
	phoneNumber!: string;

	@IsNotEmpty()
	@IsString()
	@Length(1, 128)
	@Field(() => String)
	password!: string;
}

@InputType()
export class PhoneRegisterInput extends PhoneLoginInput {
	@IsNotEmpty()
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@Length(2, 60)
	@Field(() => String)
	displayName!: string;

	@Length(12, 128)
	declare password: string;

	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(Locale)
	@Field(() => Locale, { nullable: true })
	preferredLocale?: Locale;
}

@InputType()
export class SocialLoginInput {
	@IsIn([AuthProvider.GOOGLE, AuthProvider.TELEGRAM, AuthProvider.KAKAO])
	@Field(() => AuthProvider)
	provider!: AuthProvider;

	@IsNotEmpty()
	@IsString()
	@MaxLength(16384)
	@Field(() => String)
	idToken!: string;

	@Matches(/^[a-f0-9]{64}$/)
	@Field(() => String)
	nonce!: string;

	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
	@Length(2, 60)
	@Field(() => String, { nullable: true })
	displayName?: string;

	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(Locale)
	@Field(() => Locale, { nullable: true })
	preferredLocale?: Locale;
}

@InputType()
export class LinkEmailInput extends OmitType(RegisterInput, ['displayName', 'preferredLocale'] as const) {}

@InputType()
export class LinkPhoneInput extends OmitType(PhoneRegisterInput, ['displayName', 'preferredLocale'] as const) {}

@InputType()
export class ChangePhonePasswordInput {
	@IsString()
	@Length(12, 128)
	@Field(() => String)
	password!: string;
}
