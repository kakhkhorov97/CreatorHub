import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '../../libs/dto/user/user';
import { UpdateUserInput } from '../../libs/dto/user/user.update';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { UsersService } from './user.service';

@UseGuards(AuthGuard)
@Resolver()
export class UsersResolver {
	constructor(private readonly users: UsersService) {}

	@Query(() => User)
	me(@AuthMember() currentUser: User) {
		return currentUser;
	}

	@Mutation(() => User)
	updateMe(@AuthMember() currentUser: User, @Args('input') input: UpdateUserInput) {
		return this.users.update(currentUser, input);
	}

	@Mutation(() => Boolean)
	deleteMyAccount(@AuthMember() currentUser: User) {
		return this.users.delete(currentUser);
	}

	@Roles(UserRole.ADMIN)
	@UseGuards(RolesGuard)
	@Mutation(() => User)
	setAccountSuspended(
		@AuthMember() currentUser: User,
		@Args('userId', { type: () => ID }) id: string,
		@Args('suspended') suspended: boolean,
	) {
		return this.users.setSuspended(currentUser, id, suspended);
	}
}
