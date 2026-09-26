import { Field, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../user/user';

@ObjectType()
export class AuthPayload {
	@Field()
	accessToken!: string;

	@Field()
	refreshToken!: string;

	@Field(() => Int)
	expiresIn!: number;

	@Field(() => User)
	user!: User;
}
