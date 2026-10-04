import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CreativeEvent } from '../../libs/dto/event/creative-event';
import { EventInput, EventsInput } from '../../libs/dto/event/event.input';
import { UpdateEventInput } from '../../libs/dto/event/event.update';
import { User } from '../../libs/dto/user/user';
import { UserRole } from '../../libs/enums/user-role.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { EventsService } from './event.service';
@Resolver()
export class EventsResolver {
	constructor(private readonly events: EventsService) {}
	@Query(() => [CreativeEvent])
	getEvents(@Args('input', { defaultValue: {} }) input: EventsInput) {
		return this.events.list(input);
	}
	@Query(() => CreativeEvent)
	getEvent(@Args('id', { type: () => ID }) id: string) {
		return this.events.get(id);
	}
	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Query(() => [CreativeEvent])
	adminEvents(@Args('input', { defaultValue: {} }) input: EventsInput) {
		return this.events.list(input, true);
	}
	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => CreativeEvent)
	createEvent(@AuthMember() user: User, @Args('input') input: EventInput) {
		return this.events.create(user, input);
	}
	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => CreativeEvent)
	updateEvent(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: UpdateEventInput,
	) {
		return this.events.update(user, id, input);
	}
}
