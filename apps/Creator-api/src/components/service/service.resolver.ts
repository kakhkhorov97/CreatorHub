import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { CreateServiceInput, UpdateServiceInput } from '../../libs/dto/service/service.input';
import { User } from '../../libs/dto/user/user';
import { ServiceStatus } from '../../libs/enums/creatorhub.enum';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { ServiceService } from './service.service';

@Resolver()
export class ServiceResolver {
	constructor(private readonly serviceService: ServiceService) {}

	@Query(() => CreatorService)
	public getService(@Args('serviceId', { type: () => ID }) id: string) {
		return this.serviceService.getService(id);
	}

	@UseGuards(AuthGuard)
	@Query(() => [CreatorService])
	public getMyServices(@CurrentUser() currentUser: User, @Args('input', { defaultValue: {} }) input: PageInput) {
		return this.serviceService.getMyServices(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CreatorService)
	public createService(@CurrentUser() currentUser: User, @Args('input') input: CreateServiceInput) {
		return this.serviceService.createService(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CreatorService)
	public updateService(
		@CurrentUser() currentUser: User,
		@Args('serviceId', { type: () => ID }) id: string,
		@Args('input') input: UpdateServiceInput,
	) {
		return this.serviceService.updateService(currentUser, id, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CreatorService)
	public setServiceStatus(
		@CurrentUser() currentUser: User,
		@Args('serviceId', { type: () => ID }) id: string,
		@Args('status', { type: () => ServiceStatus }) status: ServiceStatus,
	) {
		return this.serviceService.setServiceStatus(currentUser, id, status);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	public deleteService(@CurrentUser() currentUser: User, @Args('serviceId', { type: () => ID }) id: string) {
		return this.serviceService.deleteService(currentUser, id);
	}
}
