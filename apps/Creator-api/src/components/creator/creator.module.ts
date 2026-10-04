import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CreatorProfileSchema from '../../schemas/CreatorProfile.model';
import UserSchema from '../../schemas/User.model';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { CreatorsResolver } from './creator.resolver';
import { CreatorsService } from './creator.service';
import { VisibilityService } from './visibility.service';

@Module({
	imports: [
		AuthModule,
		CategoryModule,
		MongooseModule.forFeature([
			{ name: 'CreatorProfile', schema: CreatorProfileSchema },
			{ name: 'User', schema: UserSchema },
		]),
	],
	providers: [CreatorsService, CreatorsResolver, VisibilityService],
	exports: [CreatorsService, VisibilityService],
})
export class CreatorModule {}
