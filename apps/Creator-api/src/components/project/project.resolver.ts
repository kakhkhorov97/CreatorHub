import { Projects } from '../../libs/dto/project/portfolio-project';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreateProjectInput } from '../../libs/dto/project/project.input';
import { UpdateProjectInput } from '../../libs/dto/project/project.update';
import { User } from '../../libs/dto/user/user';
import { ProjectStatus } from '../../libs/enums/project-status.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { ProjectService } from './project.service';

@Resolver()
export class ProjectResolver {
	constructor(private readonly projectService: ProjectService) {}

	@Query(() => PortfolioProject)
	public getProject(@Args('projectId', { type: () => ID }) id: string) {
		return this.projectService.getProject(id);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Query(() => Projects)
	public getMyProjects(@AuthMember() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.projectService.getMyProjects(currentUser, input);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => PortfolioProject)
	public createProject(@AuthMember() currentUser: User, @Args('input') input: CreateProjectInput) {
		return this.projectService.createProject(currentUser, input);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => PortfolioProject)
	public updateProject(
		@AuthMember() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('input') input: UpdateProjectInput,
	) {
		return this.projectService.updateProject(currentUser, id, input);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => PortfolioProject)
	public setProjectStatus(
		@AuthMember() currentUser: User,
		@Args('projectId', { type: () => ID }) id: string,
		@Args('status', { type: () => ProjectStatus }) status: ProjectStatus,
	) {
		return this.projectService.setProjectStatus(currentUser, id, status);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => Boolean)
	public deleteProject(@AuthMember() currentUser: User, @Args('projectId', { type: () => ID }) id: string) {
		return this.projectService.deleteProject(currentUser, id);
	}
}
