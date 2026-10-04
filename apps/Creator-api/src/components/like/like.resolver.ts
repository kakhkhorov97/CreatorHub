import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';

import { User } from '../../libs/dto/user/user';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { LikeService } from './like.service';

@Resolver()
export class LikeResolver {
	constructor(private readonly likeService: LikeService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public setProjectLike(
		@AuthMember() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('liked') liked: boolean,
	) {
		return this.likeService.setLike(currentUser, id, liked);
	}

	@UseGuards(AuthGuard)
	@Query(() => Boolean)
	public getMyProjectLike(@AuthMember() currentUser: User, @Args('projectId', { type: () => ID }) id: string) {
		return this.likeService.getMyLike(currentUser, id);
	}

	@Query(() => Int)
	public getProjectLikeCount(@Args('projectId', { type: () => ID }) id: string) {
		return this.likeService.getLikeCount(id);
	}
}
