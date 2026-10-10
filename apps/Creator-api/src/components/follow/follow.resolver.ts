import { Followings, Followers } from '../../libs/dto/follow/creator-follow';

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';

import { User } from '../../libs/dto/user/user';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { FollowService } from './follow.service';

@Resolver()
export class FollowResolver {
	constructor(private readonly followService: FollowService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public setCreatorFollow(
		@AuthMember() currentUser: User,
		@Args('creatorId', { type: () => ID }) id: string,
		@Args('following') following: boolean,
	) {
		return this.followService.setFollow(currentUser, id, following);
	}

	@UseGuards(AuthGuard)
	@Query(() => Followings)
	public getMyFollows(@AuthMember() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.followService.getMyFollows(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Query(() => Followers)
	public getMyFollowers(@AuthMember() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.followService.getMyFollowers(currentUser, input);
	}
}
