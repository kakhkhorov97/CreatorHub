import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MediaPolicy } from '../../libs/utils/media-policy.service';
import UserSchema from '../../schemas/user/User.model';
import { AuthModule } from '../auth/auth.module';
import { UsersResolver } from './user.resolver';
import { UsersService } from './user.service';

@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'User', schema: UserSchema }])],
	providers: [UsersService, UsersResolver, MediaPolicy],
	exports: [UsersService],
})
export class UserModule {}
