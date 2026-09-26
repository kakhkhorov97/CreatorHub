import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CategorySchema from '../../schemas/category/Category.model';
import { AuthModule } from '../auth/auth.module';
import { CategoriesResolver } from './category.resolver';
import { CategoriesService } from './category.service';

@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'Category', schema: CategorySchema }])],
	providers: [CategoriesService, CategoriesResolver],
	exports: [CategoriesService],
})
export class CategoryModule {}
