import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Category } from '../../libs/dto/category/category';
import { CategoryInput } from '../../libs/dto/category/category.input';
import { UpdateCategoryInput } from '../../libs/dto/category/category.update';
import { User } from '../../libs/dto/user/user';
import { requireAdmin } from '../../libs/helpers/policy';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { CategoriesService } from './category.service';

@Resolver()
export class CategoriesResolver {
	constructor(private readonly categoriesService: CategoriesService) {}

	@Query(() => [Category])
	categories() {
		return this.categoriesService.list();
	}

	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Query(() => [Category])
	adminCategories(@AuthMember() currentUser: User) {
		requireAdmin(currentUser);
		return this.categoriesService.list(true);
	}

	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => Category)
	createCategory(@AuthMember() currentUser: User, @Args('input') input: CategoryInput) {
		return this.categoriesService.create(currentUser, input);
	}

	@Roles(UserRole.ADMIN)
	@UseGuards(AuthGuard, RolesGuard)
	@Mutation(() => Category)
	updateCategory(
		@AuthMember() currentUser: User,
		@Args('id', { type: () => ID }) id: string,
		@Args('input') input: UpdateCategoryInput,
	) {
		return this.categoriesService.update(currentUser, id, input);
	}
}
