import { Services } from '../../libs/dto/service/creator-service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { CreateServiceInput } from '../../libs/dto/service/service.input';
import { UpdateServiceInput } from '../../libs/dto/service/service.update';
import { User } from '../../libs/dto/user/user';
import { ServiceStatus } from '../../libs/enums/service-status.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { ServiceService } from './service.service';

@Resolver()
export class ServiceResolver {
	constructor(private readonly serviceService: ServiceService) {}

	@Query(() => CreatorService)
	public getService(@Args('serviceId', { type: () => ID }) id: string) {
		return this.serviceService.getService(id);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Query(() => Services)
	public getMyServices(@AuthMember() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.serviceService.getMyServices(currentUser, input);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => CreatorService)
	public createService(@AuthMember() currentUser: User, @Args('input') input: CreateServiceInput) {
		return this.serviceService.createService(currentUser, input);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => CreatorService)
	public updateService(
		@AuthMember() currentUser: User,
		@Args('serviceId', { type: () => ID }) id: string,
		@Args('input') input: UpdateServiceInput,
	) {
		return this.serviceService.updateService(currentUser, id, input);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => CreatorService)
	public setServiceStatus(
		@AuthMember() currentUser: User,
		@Args('serviceId', { type: () => ID }) id: string,
		@Args('status', { type: () => ServiceStatus }) status: ServiceStatus,
	) {
		return this.serviceService.setServiceStatus(currentUser, id, status);
	}

	@Roles(UserRole.CREATOR, UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => Boolean)
	public deleteService(@AuthMember() currentUser: User, @Args('serviceId', { type: () => ID }) id: string) {
		return this.serviceService.deleteService(currentUser, id);
	}
}
