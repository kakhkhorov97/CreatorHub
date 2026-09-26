import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { Inquiry } from '../../libs/dto/inquiry/inquiry';
import { InquiryEvent } from '../../libs/dto/inquiry/inquiry-event';
import { InquiryMessage } from '../../libs/dto/inquiry/inquiry-message';
import {
	CloseInquiryInput,
	CreateInquiryInput,
	InquiryVersionInput,
	SendMessageInput,
	UpdateInquiryInput,
} from '../../libs/dto/inquiry/inquiry.input';
import { User } from '../../libs/dto/user/user';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { InquiryService } from './inquiry.service';

@UseGuards(AuthGuard)
@Resolver()
export class InquiryResolver {
	constructor(private readonly inquiryService: InquiryService) {}

	@Query(() => Inquiry)
	public getInquiry(@CurrentUser() currentUser: User, @Args('inquiryId', { type: () => ID }) id: string) {
		return this.inquiryService.getInquiry(currentUser, id);
	}

	@Query(() => [Inquiry])
	public getInquiries(
		@CurrentUser() currentUser: User,
		@Args('creatorInbox', { defaultValue: false }) creatorInbox: boolean,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiryService.getInquiries(currentUser, creatorInbox, input);
	}

	@Query(() => [InquiryMessage])
	public getInquiryMessages(
		@CurrentUser() currentUser: User,
		@Args('inquiryId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiryService.getMessages(currentUser, id, input);
	}

	@Query(() => [InquiryEvent])
	public getInquiryEvents(
		@CurrentUser() currentUser: User,
		@Args('inquiryId', { type: () => ID }) id: string,
		@Args('input', { defaultValue: {} }) input: PageInput,
	) {
		return this.inquiryService.getEvents(currentUser, id, input);
	}

	@Mutation(() => Inquiry)
	public createInquiry(@CurrentUser() currentUser: User, @Args('input') input: CreateInquiryInput) {
		return this.inquiryService.createInquiry(currentUser, input);
	}

	@Mutation(() => Inquiry)
	public updateInquiry(@CurrentUser() currentUser: User, @Args('input') input: UpdateInquiryInput) {
		return this.inquiryService.updateInquiry(currentUser, input);
	}

	@Mutation(() => Boolean)
	public deleteInquiryDraft(@CurrentUser() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.deleteDraft(currentUser, input);
	}

	@Mutation(() => Inquiry)
	public submitInquiry(@CurrentUser() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.submitInquiry(currentUser, input);
	}

	@Mutation(() => InquiryMessage)
	public sendInquiryMessage(@CurrentUser() currentUser: User, @Args('input') input: SendMessageInput) {
		return this.inquiryService.sendMessage(currentUser, input);
	}

	@Mutation(() => Boolean)
	public markInquiryMessageRead(@CurrentUser() currentUser: User, @Args('messageId', { type: () => ID }) id: string) {
		return this.inquiryService.markMessageRead(currentUser, id);
	}

	@Mutation(() => Inquiry)
	public declineInquiry(@CurrentUser() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.finishInquiry(currentUser, input, 'DECLINE');
	}

	@Mutation(() => Inquiry)
	public cancelInquiry(@CurrentUser() currentUser: User, @Args('input') input: InquiryVersionInput) {
		return this.inquiryService.finishInquiry(currentUser, input, 'CANCEL');
	}

	@Mutation(() => Inquiry)
	public closeInquiry(@CurrentUser() currentUser: User, @Args('input') input: CloseInquiryInput) {
		return this.inquiryService.finishInquiry(currentUser, input, 'CLOSE');
	}
}
