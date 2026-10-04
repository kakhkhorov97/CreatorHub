import { SavedProjects } from '../../libs/dto/save/saved-project-result';

import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';

import { User } from '../../libs/dto/user/user';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { SaveService } from './save.service';

@Resolver()
export class SaveResolver {
	constructor(private readonly saveService: SaveService) {}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public setProjectSaved(
		@AuthMember() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('saved') saved: boolean,
	) {
		return this.saveService.setSave(currentUser, id, saved);
	}

	@UseGuards(AuthGuard)
	@Query(() => SavedProjects)
	public getSavedProjects(@AuthMember() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.saveService.getSavedProjects(currentUser, input);
	}
}
