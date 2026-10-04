import { Field, ObjectType } from '@nestjs/graphql';
import { Locale } from '../../enums/locale.enum';
import { UserRole } from '../../enums/user-role.enum';
import { UserStatus } from '../../enums/user-status.enum';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class User extends MutableEntity {
	@Field(() => String)
	displayName!: string;

	@Field(() => String, { nullable: true })
	avatarUrl?: string;

	@Field(() => UserRole)
	role!: UserRole;

	@Field(() => UserStatus)
	status!: UserStatus;

	@Field(() => Locale)
	preferredLocale!: Locale;

	@Field(() => Date, { nullable: true })
	lastLoginAt?: Date;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;
}
