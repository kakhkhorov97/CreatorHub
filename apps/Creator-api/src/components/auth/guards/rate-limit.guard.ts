import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Request } from 'express';
import { GraphQLResolveInfo } from 'graphql';

@Injectable()
export class RateLimitGuard implements CanActivate {
	private readonly windows = new Map<string, { expires: number; count: number }>();

	constructor(private readonly config: ConfigService) {}

	canActivate(context: ExecutionContext) {
		if (this.config.get('NODE_ENV') === 'test') return true;
		if (context.getType<string>() !== 'graphql') return true;
		const gql = GqlExecutionContext.create(context);
		const request = gql.getContext<{ req: Request }>().req;
		const field = gql.getInfo<GraphQLResolveInfo>().fieldName;
		const sensitive = [
			'register',
			'registerPhone',
			'loginPhone',
			'beginSocialLogin',
			'loginSocial',
			'beginSocialLink',
			'linkSocial',
			'linkEmail',
			'linkPhone',
			'unlinkAuthIdentity',
			'changePhonePassword',
			'setCreatorFollow',
			'setProjectLike',
			'createProjectComment',
			'login',
			'refreshSession',
			'requestEmailVerification',
			'requestPasswordReset',
			'resetPassword',
			'verifyEmail',
			'discoverCreators',
		].includes(field);
		const key = `${request.ip}:${sensitive ? 'sensitive' : 'general'}`;
		const now = Date.now();
		if (this.windows.size >= 10000) {
			for (const [key, value] of this.windows) if (value.expires <= now) this.windows.delete(key);
			if (this.windows.size >= 10000 && !this.windows.has(key)) throw new HttpException('Too many requests', 429);
		}
		let window = this.windows.get(key);
		if (!window || window.expires <= now) {
			window = { expires: now + 60000, count: 0 };
			this.windows.set(key, window);
		}
		if (++window.count > (sensitive ? 10 : 120)) throw new HttpException('Too many requests. Try again shortly.', 429);
		return true;
	}
}
