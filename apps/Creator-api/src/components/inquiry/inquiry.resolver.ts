import { ServiceFeedback, ServiceFeedbacks } from '../../libs/dto/inquiry/service-feedback';
import { SendInquiryInput, CreateServiceFeedbackInput } from '../../libs/dto/inquiry/inquiry.input';
import { InquiryEvents } from '../../libs/dto/inquiry/inquiry-event';
import { InquiryMessages } from '../../libs/dto/inquiry/inquiry-message';
import { Inquiries } from '../../libs/dto/inquiry/inquiry';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { Inquiry } from '../../libs/dto/inquiry/inquiry';

import { InquiryMessage } from '../../libs/dto/inquiry/inquiry-message';
import {
	CloseInquiryInput,
	CreateInquiryInput,
	InquiryVersionInput,
	SendMessageInput,
} from '../../libs/dto/inquiry/inquiry.input';
import { UpdateInquiryInput } from '../../libs/dto/inquiry/inquiry.update';
import { User } from '../../libs/dto/user/user';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { InquiryService } from './inquiry.service';

@UseGuards(AuthGuard)
@Resolver()
export class InquiryResolver {
	constructor(private readonly inquiryService: InquiryService) {}

	@Query(() => Int)
	public getUnreadInquiryCount(@AuthMember() currentUser: User) {
		return this.inquiryService.unreadCount(currentUser);
	}

	@Mutation(() => Boolean)
	public markInquiryRead(@AuthMember() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.markInquiryRead(currentUser, input);
	}

	@Query(() => Inquiry)
	public getInquiry(@AuthMember() currentUser: User, @Args('inquiryId', { type: () => ID }) id: string) {
		return this.inquiryService.getInquiry(currentUser, id);
	}

	@Query(() => Inquiries)
	public getInquiries(
		@AuthMember() currentUser: User,
		@Args('creatorInbox', { defaultValue: false }) creatorInbox: boolean,
		@Args('allConversations', { defaultValue: false }) allConversations: boolean,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiryService.getInquiries(currentUser, creatorInbox, input, allConversations);
	}

	@Query(() => InquiryMessages)
	public getInquiryMessages(
		@AuthMember() currentUser: User,
		@Args('inquiryId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiryService.getMessages(currentUser, id, input);
	}

	@Query(() => InquiryEvents)
	public getInquiryEvents(
		@AuthMember() currentUser: User,
		@Args('inquiryId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiryService.getEvents(currentUser, id, input);
	}

	@Mutation(() => Inquiry)
	public sendInquiry(@AuthMember() currentUser: User, @Args('input') input: SendInquiryInput) {
		return this.inquiryService.sendInquiry(currentUser, input);
	}

	@Mutation(() => Inquiry)
	public completeInquiry(@AuthMember() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.completeInquiry(currentUser, input);
	}

	@Mutation(() => ServiceFeedback)
	public createServiceFeedback(@AuthMember() currentUser: User, @Args('input') input: CreateServiceFeedbackInput) {
		return this.inquiryService.createFeedback(currentUser, input);
	}

	@Query(() => ServiceFeedback, { nullable: true })
	public getInquiryFeedback(@AuthMember() currentUser: User, @Args('inquiryId', { type: () => ID }) id: string) {
		return this.inquiryService.myFeedback(currentUser, id);
	}

	@Mutation(() => Inquiry)
	public createInquiry(@AuthMember() currentUser: User, @Args('input') input: CreateInquiryInput) {
		return this.inquiryService.createInquiry(currentUser, input);
	}

	@Mutation(() => Inquiry)
	public updateInquiry(@AuthMember() currentUser: User, @Args('input') input: UpdateInquiryInput) {
		return this.inquiryService.updateInquiry(currentUser, input);
	}

	@Mutation(() => Boolean)
	public deleteInquiryDraft(@AuthMember() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.deleteDraft(currentUser, input);
	}

	@Mutation(() => Inquiry)
	public submitInquiry(@AuthMember() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.submitInquiry(currentUser, input);
	}

	@Mutation(() => InquiryMessage)
	public sendInquiryMessage(@AuthMember() currentUser: User, @Args('input') input: SendMessageInput) {
		return this.inquiryService.sendMessage(currentUser, input);
	}

	@Mutation(() => Boolean)
	public markInquiryMessageRead(@AuthMember() currentUser: User, @Args('messageId', { type: () => ID }) id: string) {
		return this.inquiryService.markMessageRead(currentUser, id);
	}

	@Mutation(() => Inquiry)
	public declineInquiry(@AuthMember() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.finishInquiry(currentUser, input, 'DECLINE');
	}

	@Mutation(() => Inquiry)
	public cancelInquiry(@AuthMember() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.finishInquiry(currentUser, input, 'CANCEL');
	}

	@Mutation(() => Inquiry)
	public closeInquiry(@AuthMember() currentUser: User, @Args('input') input: CloseInquiryInput) {
		return this.inquiryService.finishInquiry(currentUser, input, 'CLOSE');
	}
}

@Resolver()
export class ServiceFeedbackResolver {
	constructor(private readonly inquiries: InquiryService) {}

	@Query(() => ServiceFeedbacks)
	public getCreatorFeedback(
		@Args('creatorId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiries.creatorFeedback(id, input);
	}
}
