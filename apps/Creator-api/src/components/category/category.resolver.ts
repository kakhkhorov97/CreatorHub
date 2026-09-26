import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Category } from '../../libs/dto/category/category';
import { CategoryInput, UpdateCategoryInput } from '../../libs/dto/category/category.input';
import { User } from '../../libs/dto/user/user';
import { requireAdmin } from '../../libs/utils/policy';
import { CurrentUser, AuthGuard } from '../auth/guards/auth.guard';
import { CategoriesService } from './category.service';

@Resolver()
export class CategoriesResolver {
	constructor(private readonly categoriesService: CategoriesService) {}

	@Query(() => [Category])
	categories() {
		return this.categoriesService.list();
	}

	@UseGuards(AuthGuard)
	@Query(() => [Category])
	adminCategories(@CurrentUser() currentUser: User) {
		requireAdmin(currentUser);
		return this.categoriesService.list(true);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Category)
	createCategory(@CurrentUser() currentUser: User, @Args('input') input: CategoryInput) {
		return this.categoriesService.create(currentUser, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Category)
	updateCategory(
		@CurrentUser() currentUser: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: UpdateCategoryInput,
	) {
		return this.categoriesService.update(currentUser, id, input);
	}
}
