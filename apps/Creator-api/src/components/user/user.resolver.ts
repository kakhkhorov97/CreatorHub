import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '../../libs/dto/user/user';
import { UpdateUserInput } from '../../libs/dto/user/user.input';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { UsersService } from './user.service';

@UseGuards(AuthGuard)
@Resolver()
export class UsersResolver {
	constructor(private readonly users: UsersService) {}

	@Query(() => User)
	me(@CurrentUser() currentUser: User) {
		return currentUser;
	}

	@Mutation(() => User)
	updateMe(@CurrentUser() currentUser: User, @Args('input') input: UpdateUserInput) {
		return this.users.update(currentUser, input);
	}

	@Mutation(() => Boolean)
	deleteMyAccount(@CurrentUser() currentUser: User) {
		return this.users.delete(currentUser);
	}

	@Mutation(() => User)
	setAccountSuspended(
		@CurrentUser() currentUser: User,
		@Args('userId', { type: () => ID }) id: string,
		@Args('suspended') suspended: boolean,
	) {
		return this.users.setSuspended(currentUser, id, suspended);
	}
}
