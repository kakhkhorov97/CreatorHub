import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsBoolean,
	IsEnum,
	IsMongoId,
	IsString,
	IsUrl,
	Length,
	Matches,
	MaxLength,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { CreatorAvailability } from '../../enums/creator-availability.enum';

@InputType()
export class SocialLinkInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 40)
	label!: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MaxLength(2048)
	@IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true, disallow_auth: true })
	url!: string;
}

@InputType()
export class CreateCreatorInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(3, 80)
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	slug!: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 120)
	headline?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 3000)
	bio?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 80)
	city?: string;

	@Field(() => Boolean, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsBoolean()
	remoteAvailable?: boolean;

	@Field(() => CreatorAvailability, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(CreatorAvailability)
	availability?: CreatorAvailability;

	@Field(() => [ID], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(5)
	@ArrayUnique()
	@IsMongoId({ each: true })
	categoryIds?: string[];

	@Field(() => [String], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) =>
		Array.isArray(value) ? value.map((item: unknown) => (typeof item === 'string' ? item.trim() : item)) : value,
	)
	@IsArray()
	@ArrayMaxSize(20)
	@ArrayUnique()
	@IsString({ each: true })
	@Length(1, 50, { each: true })
	skills?: string[];

	@Field(() => [SocialLinkInput], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(8)
	@ValidateNested({ each: true })
	@Type(() => SocialLinkInput)
	socialLinks?: SocialLinkInput[];
}
