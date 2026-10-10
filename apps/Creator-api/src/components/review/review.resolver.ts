import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Parent } from '@nestjs/graphql';
import { ContentReview } from '../../libs/dto/review/content-review';
import { User } from '../../libs/dto/user/user';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ReviewService } from './review.service';

@Resolver(() => ContentReview)
@UseGuards(AuthGuard)
export class ReviewResolver {
	constructor(private readonly reviews: ReviewService) {}

	@Query(() => [ContentReview])
	myContentReviews(@AuthMember() user: User) {
		return this.reviews.list(user);
	}

	@Query(() => [ContentReview])
	adminContentReviews(@AuthMember() user: User, @Args('status', { defaultValue: 'PENDING' }) status: string) {
		return this.reviews.list(user, status);
	}

	@Query(() => Int)
	adminPendingContentReviewCount(@AuthMember() user: User) {
		return this.reviews.pendingCount(user);
	}

	@Mutation(() => ContentReview)
	adminDecideContentReview(
		@AuthMember() user: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('approve') approve: boolean,
		@Args('revision') revision: Date,
		@Args('reason', { nullable: true }) reason?: string,
	) {
		return this.reviews.decide(user, id, approve, revision, reason);
	}

	@ResolveField(() => String)
	preview(@Parent() review: ContentReview) {
		return JSON.stringify(review.snapshot, null, 2);
	}
}
