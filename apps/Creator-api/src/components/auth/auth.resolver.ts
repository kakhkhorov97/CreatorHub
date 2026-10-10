import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
	AuthPayload,
	GoogleSignInResult,
	SocialSignInResult,
	KakaoLoginChallenge,
} from '../../libs/dto/auth/auth-payload';
import {
	GoogleLoginInput,
	TelegramLoginInput,
	KakaoLoginInput,
	CompleteSocialSignupInput,
	CompleteGoogleSignupInput,
	PhoneRegisterInput,
	PhoneLoginInput,
	SocialLoginInput,
	EmailInput,
	LinkEmailInput,
	LinkPhoneInput,
	ChangePhonePasswordInput,
	ChangePasswordInput,
	ChangeEmailInput,
	LoginInput,
	RegisterInput,
	ResetPasswordInput,
} from '../../libs/dto/auth/auth.input';
import { AuthIdentity } from '../../libs/dto/auth/auth-identity';
import { User } from '../../libs/dto/user/user';
import { AuthProvider } from '../../libs/enums/auth-provider.enum';
import { AuthTokenPurpose } from '../../libs/enums/auth-token-purpose.enum';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { AuthMember } from './decorators/authMember.decorator';
import { SessionId } from './decorators/sessionId.decorator';

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

	@Mutation(() => GoogleSignInResult)
	loginGoogle(@Args('input') input: GoogleLoginInput) {
		return this.auth.loginGoogle(input);
	}

	@Mutation(() => AuthPayload)
	completeGoogleSignup(@Args('input') input: CompleteGoogleSignupInput) {
		return this.auth.completeGoogleSignup(input);
	}

	@Mutation(() => KakaoLoginChallenge)
	beginKakaoLogin() {
		return this.auth.beginKakaoLogin();
	}

	@Mutation(() => SocialSignInResult)
	loginKakao(@Args('input') input: KakaoLoginInput) {
		return this.auth.loginKakao(input);
	}

	@Mutation(() => SocialSignInResult)
	loginTelegram(@Args('input') input: TelegramLoginInput) {
		return this.auth.loginTelegram(input);
	}

	@Mutation(() => AuthPayload)
	completeSocialSignup(@Args('input') input: CompleteSocialSignupInput) {
		return this.auth.completeSocialSignup(input);
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
	getMyAuthIdentities(@AuthMember() user: User) {
		return this.auth.getMyIdentities(user);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AuthIdentity)
	linkEmail(@AuthMember() user: User, @SessionId() sessionId: string, @Args('input') input: LinkEmailInput) {
		return this.auth.linkEmail(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	requestEmailChange(@AuthMember() user: User, @SessionId() sessionId: string, @Args('input') input: ChangeEmailInput) {
		return this.auth.requestEmailChange(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AuthIdentity)
	linkPhone(@AuthMember() user: User, @SessionId() sessionId: string, @Args('input') input: LinkPhoneInput) {
		return this.auth.linkPhone(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => String)
	beginSocialLink(
		@AuthMember() user: User,
		@SessionId() sessionId: string,
		@Args('provider', { type: () => AuthProvider }) provider: AuthProvider,
	) {
		return this.auth.beginSocialLink(user, sessionId, provider);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => AuthIdentity)
	linkSocial(@AuthMember() user: User, @SessionId() sessionId: string, @Args('input') input: SocialLoginInput) {
		return this.auth.linkSocial(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	unlinkAuthIdentity(
		@AuthMember() user: User,
		@SessionId() sessionId: string,
		@Args('authIdentityId', { type: () => ID }) id: string,
	) {
		return this.auth.unlinkIdentity(user, sessionId, id);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	changePassword(@AuthMember() user: User, @SessionId() sessionId: string, @Args('input') input: ChangePasswordInput) {
		return this.auth.changePassword(user, sessionId, input);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	changePhonePassword(
		@AuthMember() user: User,
		@SessionId() sessionId: string,
		@Args('input') input: ChangePhonePasswordInput,
	) {
		return this.auth.changePhonePassword(user, sessionId, input.password);
	}

	@UseGuards(AuthGuard)
	@Mutation(() => Boolean)
	logout(@AuthMember() user: User, @SessionId() sessionId: string) {
		return this.auth.logout(user, sessionId);
	}
}
