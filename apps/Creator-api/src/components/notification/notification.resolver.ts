import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotificationResult } from '../../libs/dto/notification/notification-result';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { User } from '../../libs/dto/user/user';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { NotificationService } from './notification.service';

@UseGuards(AuthGuard)
@Resolver()
export class NotificationResolver {
	constructor(private readonly notificationService: NotificationService) {}

	@Query(() => [NotificationResult])
	public getNotifications(
		@CurrentUser() currentUser: User,
		@Args('input', { defaultValue: {} }) input: PageInput,
		@Args('unreadOnly', { defaultValue: false }) unreadOnly: boolean,
	) {
		return this.notificationService.getNotifications(currentUser, input, unreadOnly);
	}

	@Query(() => Int)
	public getUnreadNotificationCount(@CurrentUser() currentUser: User) {
		return this.notificationService.getUnreadCount(currentUser);
	}

	@Mutation(() => Boolean)
	public markNotificationRead(
		@CurrentUser() currentUser: User,
		@Args('notificationId', { type: () => ID }) id: string,
	) {
		return this.notificationService.markRead(currentUser, id);
	}
}
