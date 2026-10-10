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

@ObjectType()
export class GoogleSignInResult {
	@Field(() => AuthPayload, { nullable: true })
	session?: AuthPayload;

	@Field(() => String, { nullable: true })
	signupToken?: string;

	@Field(() => String, { nullable: true })
	displayName?: string;
}

@ObjectType()
export class SocialSignInResult extends GoogleSignInResult {}

@ObjectType()
export class KakaoLoginChallenge {
	@Field()
	authorizationUrl!: string;

	@Field()
	state!: string;
}
