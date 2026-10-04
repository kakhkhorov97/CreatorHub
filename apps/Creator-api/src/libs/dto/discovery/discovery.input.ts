import { ProjectSort } from '../../enums/project-sort.enum';
import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
	ArrayMaxSize,
	IsArray,
	IsEnum,
	IsBoolean,
	IsInt,
	IsMongoId,
	IsString,
	Length,
	Max,
	Min,
	ValidateIf,
} from 'class-validator';

@InputType()
export class DiscoveryInput {
	@Field(() => ProjectSort, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsEnum(ProjectSort)
	sort?: ProjectSort;

	@Field(() => [ID], { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsArray()
	@ArrayMaxSize(50)
	@IsMongoId({ each: true })
	excludeProjectIds?: string[];

	@Field(() => ID, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsMongoId()
	creatorId?: string;

	@Field(() => ID, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsMongoId()
	categoryId?: string;

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

	@Field(() => String, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 200)
	query?: string;

	@Field(() => Int, { nullable: true })
	@ValidateIf((_object, value) => value !== undefined)
	@IsInt()
	@Min(0)
	@Max(1000000000)
	budgetMax?: number;

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

@InputType()
export class AssistantInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(3, 1000)
	request!: string;
}
