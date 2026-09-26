import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthPayload } from '../../libs/dto/auth/auth-payload';
import {
	PhoneRegisterInput,
	PhoneLoginInput,
	SocialLoginInput,
	EmailInput,
	LinkEmailInput,
	LinkPhoneInput,
	ChangePhonePasswordInput,
	LoginInput,
	RegisterInput,
	ResetPasswordInput,
} from '../../libs/dto/auth/auth.input';
import { AuthIdentity } from '../../libs/dto/auth/auth-identity';
import { User } from '../../libs/dto/user/user';
import { AuthProvider, AuthTokenPurpose } from '../../libs/enums/creatorhub.enum';
import { AuthService } from './auth.service';
import { CurrentUser, AuthGuard, SessionId } from './guards/auth.guard';

@Resolver()
export class AuthResolver {
	constructor(private readonly auth: AuthService) {}

	@Mutation(() => AuthPayload)
	register(@Args('input') input: RegisterInput) {
		return this.auth.register(input);
	}

	@Mutation(() => AuthPayload)
	registerPhone(@Args('input') input: PhoneRegisterInput) {
		return this.auth.registerPhone(input);
	}

	@Mutation(() => AuthPayload)
	loginPhone(@Args('input') input: PhoneLoginInput) {
		return this.auth.loginPhone(input);
	}

	@Mutation(() => String)
	beginSocialLogin(@Args('provider', { type: () => AuthProvider }) provider: AuthProvider) {
		return this.auth.beginSocialLogin(provider);
	}

	@Mutation(() => AuthPayload)
	loginSocial(@Args('input') input: SocialLoginInput) {
		return this.auth.loginSocial(input);
	}

	@Mutation(() => AuthPayload)
	login(@Args('input') input: LoginInput) {
		return this.auth.login(input);
	}

	@Mutation(() => AuthPayload)
	refreshSession(@Args('refreshToken') token: string) {
		return this.auth.refresh(token);
	}

	@Mutation(() => Boolean)
	verifyEmail(@Args('token') token: string) {
		return this.auth.verifyEmail(token);
	}

	@Mutation(() => Boolean)
	requestEmailVerification(@Args('input') input: EmailInput) {
		return this.auth.requestToken(input.email, AuthTokenPurpose.EMAIL_VERIFY);
	}

	@Mutation(() => Boolean)
	requestPasswordReset(@Args('input') input: EmailInput) {
		return this.auth.requestToken(input.email, AuthTokenPurpose.PASSWORD_RESET);
	}

	@Mutation(() => Boolean)
	resetPassword(@Args('input') input: ResetPasswordInput) {
		return this.auth.resetPassword(input);
	}

	@UseGuards(AuthGuard)
	@Query(() => [AuthIdentity])
	getMyAuthIdentities(@CurrentUser() user: User) {
		return this.auth.getMyIdentities(user);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AuthIdentity)
	linkEmail(@CurrentUser() user: User, @SessionId() sessionId: string, @Args('input') input: LinkEmailInput) {
		return this.auth.linkEmail(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AuthIdentity)
	linkPhone(@CurrentUser() user: User, @SessionId() sessionId: string, @Args('input') input: LinkPhoneInput) {
		return this.auth.linkPhone(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => String)
	beginSocialLink(
		@CurrentUser() user: User,
		@SessionId() sessionId: string,
		@Args('provider', { type: () => AuthProvider }) provider: AuthProvider,
	) {
		return this.auth.beginSocialLink(user, sessionId, provider);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AuthIdentity)
	linkSocial(@CurrentUser() user: User, @SessionId() sessionId: string, @Args('input') input: SocialLoginInput) {
		return this.auth.linkSocial(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	unlinkAuthIdentity(
		@CurrentUser() user: User,
		@SessionId() sessionId: string,
		@Args('authIdentityId', { type: () => ID }) id: string,
	) {
		return this.auth.unlinkIdentity(user, sessionId, id);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	changePhonePassword(
		@CurrentUser() user: User,
		@SessionId() sessionId: string,
		@Args('input') input: ChangePhonePasswordInput,
	) {
		return this.auth.changePhonePassword(user, sessionId, input.password);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	logout(@CurrentUser() user: User, @SessionId() sessionId: string) {
		return this.auth.logout(user, sessionId);
	}
}
