import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { Category } from '../../libs/dto/category/category';
import { CategoryInput } from '../../libs/dto/category/category.input';
import { UpdateCategoryInput } from '../../libs/dto/category/category.update';
import { User } from '../../libs/dto/user/user';
import { check, defined, shapeIntoMongooseObjectId, requireAdmin, requireRecord } from '../../libs/helpers/policy';

@Injectable()
export class CategoriesService {
	constructor(@InjectModel(Category.name) private readonly categories: Model<Category>) {}

	list(includeInactive = false) {
		return this.categories.find(includeInactive ? {} : { isActive: true }).sort({ sortOrder: 1, _id: 1 });
	}

	async validate(ids: (Types.ObjectId | string)[], active = true, session: ClientSession | null = null) {
		const count = await this.categories
			.countDocuments({ _id: { $in: ids }, ...(active ? { isActive: true } : {}) })
			.session(session);
		check(count === ids.length, active ? 'Select active categories' : 'Unknown category');
	}

	create(currentUser: User, input: CategoryInput) {
		requireAdmin(currentUser);
		return this.categories.create(input);
	}

	async update(currentUser: User, id: string, input: UpdateCategoryInput) {
		requireAdmin(currentUser);
		return requireRecord(
			await this.categories.findByIdAndUpdate(
				shapeIntoMongooseObjectId(id),
				{ $set: defined(input) },
				{ new: true, runValidators: true },
			),
		);
	}
}
