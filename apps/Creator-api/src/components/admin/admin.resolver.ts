import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AdminKind } from '../../libs/enums/admin-kind.enum';
import { AdminDirectory, AdminOverview } from '../../libs/dto/admin/admin';
import { AdminDirectoryInput, AdminUserUpdateInput } from '../../libs/dto/admin/admin.input';
import { SiteContent, SiteContentInput } from '../../libs/dto/admin/site-content';
import { User } from '../../libs/dto/user/user';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { UpdateCreatorInput } from '../../libs/dto/creator/creator.update';
import { CreateProjectInput } from '../../libs/dto/project/project.input';
import { AdminProjectUpdateInput } from '../../libs/dto/admin/admin-project.update';
import { CreateServiceInput } from '../../libs/dto/service/service.input';
import { UpdateServiceInput } from '../../libs/dto/service/service.update';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';
import { ProfileStatus } from '../../libs/enums/profile-status.enum';
import { ProjectStatus } from '../../libs/enums/project-status.enum';
import { ServiceStatus } from '../../libs/enums/service-status.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@Resolver()
@Roles(UserRole.ADMIN)
@UseGuards(AuthGuard, RolesGuard)
export class AdminResolver {
	constructor(private readonly admin: AdminService) {}

	@Query(() => AdminOverview)
	adminOverview(@AuthMember() user: User) {
		return this.admin.overview(user);
	}

	@Query(() => AdminDirectory)
	adminDirectory(
		@AuthMember() user: User,
		@Args('kind', { type: () => AdminKind }) kind: AdminKind,
		@Args('input', { defaultValue: {} }) input: AdminDirectoryInput,
	) {
		return this.admin.directory(user, kind, input);
	}

	@Mutation(() => User)
	adminUpdateUser(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: AdminUserUpdateInput,
	) {
		return this.admin.updateUser(user, id, input);
	}

	@Mutation(() => User)
	adminSetUserStatus(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('status', { type: () => UserStatus }) status: UserStatus,
	) {
		return this.admin.userStatus(user, id, status);
	}

	@Mutation(() => CreatorProfile)
	adminUpdateCreator(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: UpdateCreatorInput,
		@Args('status', { type: () => ProfileStatus, nullable: true }) status?: ProfileStatus,
	) {
		return this.admin.updateCreator(user, id, input, status);
	}

	@Mutation(() => PortfolioProject)
	adminCreateProject(
		@AuthMember() user: User,
		@Args('creatorId', { type: () => ID }) creatorId: string,
		@Args('input') input: CreateProjectInput,
	) {
		return this.admin.createProject(user, creatorId, input);
	}

	@Mutation(() => PortfolioProject)
	adminUpdateProject(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: AdminProjectUpdateInput,
		@Args('status', { type: () => ProjectStatus, nullable: true }) status?: ProjectStatus,
	) {
		return this.admin.updateProject(user, id, input, status);
	}

	@Mutation(() => CreatorService)
	adminCreateService(
		@AuthMember() user: User,
		@Args('creatorId', { type: () => ID }) creatorId: string,
		@Args('input') input: CreateServiceInput,
	) {
		return this.admin.createService(user, creatorId, input);
	}

	@Mutation(() => CreatorService)
	adminUpdateService(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: UpdateServiceInput,
		@Args('status', { type: () => ServiceStatus, nullable: true }) status?: ServiceStatus,
	) {
		return this.admin.updateService(user, id, input, status);
	}

	@Mutation(() => Boolean)
	adminSetRemoved(
		@AuthMember() user: User,
		@Args('kind', { type: () => AdminKind }) kind: AdminKind,
		@Args('id', { type: () => ID }) id: string,
		@Args('removed') removed: boolean,
	) {
		return this.admin.removed(user, kind, id, removed);
	}

	@Mutation(() => SiteContent)
	adminUpdateSiteContent(@AuthMember() user: User, @Args('input') input: SiteContentInput) {
		return this.admin.updateSiteContent(user, input);
	}
}

@Resolver()
export class SiteContentResolver {
	constructor(private readonly admin: AdminService) {}

	@Query(() => SiteContent)
	getSiteContent() {
		return this.admin.siteContent();
	}
}
