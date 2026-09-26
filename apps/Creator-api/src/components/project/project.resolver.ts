import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreateProjectInput, UpdateProjectInput } from '../../libs/dto/project/project.input';
import { User } from '../../libs/dto/user/user';
import { ProjectStatus } from '../../libs/enums/creatorhub.enum';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { ProjectService } from './project.service';

@Resolver()
export class ProjectResolver {
	constructor(private readonly projectService: ProjectService) {}

	@Query(() => PortfolioProject)
	public getProject(@Args('projectId', { type: () => ID }) id: string) {
		return this.projectService.getProject(id);
	}

	@UseGuards(AuthGuard)
	@Query(() => [PortfolioProject])
	public getMyProjects(@CurrentUser() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.projectService.getMyProjects(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => PortfolioProject)
	public createProject(@CurrentUser() currentUser: User, @Args('input') input: CreateProjectInput) {
		return this.projectService.createProject(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => PortfolioProject)
	public updateProject(
		@CurrentUser() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('input') input: UpdateProjectInput,
	) {
		return this.projectService.updateProject(currentUser, id, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => PortfolioProject)
	public setProjectStatus(
		@CurrentUser() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('status', { type: () => ProjectStatus }) status: ProjectStatus,
	) {
		return this.projectService.setProjectStatus(currentUser, id, status);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public deleteProject(@CurrentUser() currentUser: User, @Args('projectId', { type: () => ID }) id: string) {
		return this.projectService.deleteProject(currentUser, id);
	}
}
