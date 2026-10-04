import { Comments } from '../../libs/dto/comment/project-comment';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../libs/enums/user-role.enum';

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CommentInput } from '../../libs/dto/comment/comment.input';
import { EditCommentInput } from '../../libs/dto/comment/comment.update';
import { ProjectComment } from '../../libs/dto/comment/project-comment';
import { User } from '../../libs/dto/user/user';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CommentService } from './comment.service';

@Resolver()
export class CommentResolver {
	constructor(private readonly commentService: CommentService) {}

	@Query(() => Comments)
	public getProjectComments(
		@Args('projectId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.commentService.getComments(id, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => ProjectComment)
	public createProjectComment(@AuthMember() currentUser: User, @Args('input') input: CommentInput) {
		return this.commentService.createComment(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => ProjectComment)
	public editProjectComment(
		@AuthMember() currentUser: User,
		@Args('commentId', { type: () => ID }) id: string,
		@Args('input') input: EditCommentInput,
	) {
		return this.commentService.editComment(currentUser, id, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public deleteProjectComment(@AuthMember() currentUser: User, @Args('commentId', { type: () => ID }) id: string) {
		return this.commentService.deleteComment(currentUser, id);
	}

	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => ProjectComment)
	public moderateProjectComment(
		@AuthMember() currentUser: User,
		@Args('commentId', { type: () => ID }) id: string,
		@Args('hidden') hidden: boolean,
	) {
		return this.commentService.moderateComment(currentUser, id, hidden);
	}
}
