import { Field, ID, InputType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsMongoId, IsString, MaxLength, ValidateIf } from 'class-validator';
import { PageInput } from '../common/pagination.input';
import { UpdateUserInput } from '../user/user.update';
import { UserRole } from '../../enums/user-role.enum';
@InputType()
export class AdminDirectoryInput extends PageInput {
	@Field(() => String, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsString()
	@MaxLength(100)
	search?: string;
	@Field(() => String, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsString()
	@MaxLength(20)
	status?: string;
	@Field(() => UserRole, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsEnum(UserRole)
	role?: UserRole;
	@Field(() => Boolean, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsBoolean()
	removed?: boolean;
	@Field(() => ID, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsMongoId()
	id?: string;
}
@InputType()
export class AdminUserUpdateInput extends UpdateUserInput {
	@Field(() => UserRole, { nullable: true })
	@ValidateIf((_o, v) => v !== undefined)
	@IsEnum(UserRole)
	role?: UserRole;
}
