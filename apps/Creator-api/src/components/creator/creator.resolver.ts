import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { CreatorIdentity } from '../../libs/dto/creator/creator-identity';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { CreateCreatorInput, UpdateCreatorInput } from '../../libs/dto/creator/creator.input';
import { User } from '../../libs/dto/user/user';
import { ProfileStatus } from '../../libs/enums/creatorhub.enum';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { CreatorsService } from './creator.service';

@Resolver(() => CreatorProfile)
export class CreatorsResolver {
	constructor(private readonly creators: CreatorsService) {}

	@Query(() => CreatorProfile)
	creator(@Args('slug') slug: string) {
		return this.creators.public(slug);
	}

	@ResolveField(() => CreatorIdentity)
	identity(@Parent() profile: CreatorProfile) {
		return this.creators.displayOwner(profile);
	}

	@UseGuards(AuthGuard)
	@Query(() => CreatorProfile)
	myCreatorProfile(@CurrentUser() currentUser: User) {
		return this.creators.own(currentUser);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CreatorProfile)
	createCreatorProfile(@CurrentUser() currentUser: User, @Args('input') input: CreateCreatorInput) {
		return this.creators.create(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CreatorProfile)
	updateCreatorProfile(@CurrentUser() currentUser: User, @Args('input') input: UpdateCreatorInput) {
		return this.creators.update(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => CreatorProfile)
	setCreatorProfileStatus(
		@CurrentUser() currentUser: User,
		@Args('status', { type: () => ProfileStatus }) status: ProfileStatus,
	) {
		return this.creators.setStatus(currentUser, status);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	deleteCreatorProfile(@CurrentUser() currentUser: User) {
		return this.creators.delete(currentUser);
	}
}
