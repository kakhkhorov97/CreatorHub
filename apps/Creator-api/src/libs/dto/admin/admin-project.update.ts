import { Field, InputType, OmitType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString, MaxLength, ValidateIf, ValidateNested } from 'class-validator';
import { UpdateProjectInput } from '../project/project.update';
import { PortfolioMediaInput } from '../project/project.input';

// Existing media URLs are checked against the stored record by AdminService.
// New or changed URLs still pass the account-owned MediaPolicy.
@InputType()
export class AdminPortfolioMediaInput extends OmitType(PortfolioMediaInput, ['url'] as const) {
	@Field(() => String)
	@IsString()
	@MaxLength(2048)
	url!: string;
}

@InputType()
export class AdminProjectUpdateInput extends OmitType(UpdateProjectInput, ['media', 'coverImageUrl'] as const) {
	@Field(() => String, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsString()
	@MaxLength(2048)
	coverImageUrl?: string;

	@Field(() => [AdminPortfolioMediaInput], { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsArray()
	@ArrayMaxSize(20)
	@ArrayUnique((m: AdminPortfolioMediaInput) => m.sortOrder)
	@ValidateNested({ each: true })
	@Type(() => AdminPortfolioMediaInput)
	media?: AdminPortfolioMediaInput[];
}
