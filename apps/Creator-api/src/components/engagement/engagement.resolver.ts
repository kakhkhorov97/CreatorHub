import { SavedProjectResult } from '../../libs/dto/engagement/saved-project-result';
import { CreatorFollow } from '../../libs/dto/engagement/creator-follow';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CommentInput, EditCommentInput } from '../../libs/dto/engagement/engagement.input';
import { ProjectComment } from '../../libs/dto/engagement/project-comment';
import { User } from '../../libs/dto/user/user';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { EngagementService } from './engagement.service';

@Resolver()
export class EngagementResolver {
	constructor(private readonly engagementService: EngagementService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public setCreatorFollow(
		@CurrentUser() currentUser: User,
		@Args('creatorId', { type: () => ID }) id: string,
		@Args('following') following: boolean,
	) {
		return this.engagementService.setFollow(currentUser, id, following);
	}

	@UseGuards(AuthGuard)
	@Query(() => [CreatorFollow])
	public getMyFollows(@CurrentUser() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.engagementService.getMyFollows(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public setProjectLike(
		@CurrentUser() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('liked') liked: boolean,
	) {
		return this.engagementService.setLike(currentUser, id, liked);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public setProjectSaved(
		@CurrentUser() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('saved') saved: boolean,
	) {
		return this.engagementService.setSave(currentUser, id, saved);
	}

	@UseGuards(AuthGuard)
	@Query(() => [SavedProjectResult])
	public getSavedProjects(@CurrentUser() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.engagementService.getSavedProjects(currentUser, input);
	}

	@Query(() => [ProjectComment])
	public getProjectComments(
		@Args('projectId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.engagementService.getComments(id, input);
	}

	@Query(() => Int)
	public getProjectLikeCount(@Args('projectId', { type: () => ID }) id: string) {
		return this.engagementService.getLikeCount(id);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => ProjectComment)
	public createProjectComment(@CurrentUser() currentUser: User, @Args('input') input: CommentInput) {
		return this.engagementService.createComment(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => ProjectComment)
	public editProjectComment(
		@CurrentUser() currentUser: User,
		@Args('commentId', { type: () => ID }) id: string,
		@Args('input') input: EditCommentInput,
	) {
		return this.engagementService.editComment(currentUser, id, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public deleteProjectComment(@CurrentUser() currentUser: User, @Args('commentId', { type: () => ID }) id: string) {
		return this.engagementService.deleteComment(currentUser, id);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => ProjectComment)
	public moderateProjectComment(
		@CurrentUser() currentUser: User,
		@Args('commentId', { type: () => ID }) id: string,
		@Args('hidden') hidden: boolean,
	) {
		return this.engagementService.moderateComment(currentUser, id, hidden);
	}
}
