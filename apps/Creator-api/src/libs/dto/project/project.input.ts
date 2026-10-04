import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsEnum,
	IsInt,
	IsMongoId,
	IsString,
	IsUrl,
	Length,
	Matches,
	Max,
	MaxLength,
	Min,
	ValidateIf,
	ValidateNested,
} from 'class-validator';
import { MediaType } from '../../enums/media-type.enum';

@InputType()
export class PortfolioMediaInput {
	@Field(() => MediaType)
	@IsEnum(MediaType)
	type!: MediaType;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MaxLength(2048)
	@IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false, disallow_auth: true })
	url!: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 300)
	altText!: string;

	@Field(() => Int)
	@IsInt()
	@Min(0)
	@Max(19)
	sortOrder!: number;
}

@InputType()
export class CreateProjectInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 150)
	title!: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(3, 100)
	@Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
	slug!: string;

	@Field(() => ID, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsMongoId()
	categoryId?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 300)
	summary?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 20000)
	description?: string;

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MaxLength(2048)
	@IsUrl({ protocols: ['https', 'http'], require_protocol: true, require_tld: false, disallow_auth: true })
	coverImageUrl?: string;

	@Field(() => [PortfolioMediaInput], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(20)
	@ValidateNested({ each: true })
	@Type(() => PortfolioMediaInput)
	media?: PortfolioMediaInput[];

	@Field(() => [String], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) =>
		Array.isArray(value)
			? value.map((item: unknown) => (typeof item === 'string' ? item.trim().toLowerCase() : item))
			: value,
	)
	@IsArray()
	@ArrayMaxSize(10)
	@ArrayUnique()
	@IsString({ each: true })
	@Length(1, 40, { each: true })
	tags?: string[];

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@MaxLength(2048)
	@IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true, disallow_auth: true })
	externalUrl?: string;
}
