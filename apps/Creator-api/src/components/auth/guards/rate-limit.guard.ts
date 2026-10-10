import { CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { GraphQLResolveInfo } from 'graphql';

const securityGroups: Record<string, string> = {
	login: 'login',
	loginPhone: 'login',
	beginSocialLogin: 'login',
	loginSocial: 'login',
	register: 'registration',
	registerPhone: 'registration',
	requestEmailVerification: 'verification',
	verifyEmail: 'verification',
	requestPasswordReset: 'password-reset',
	resetPassword: 'password-reset',
};
const accountChanges = new Set([
	'beginSocialLink',
	'linkSocial',
	'linkEmail',
	'linkPhone',
	'unlinkAuthIdentity',
	'changePhonePassword',
	'changePassword',
]);

@Injectable()
export class RateLimitGuard implements CanActivate {
	private readonly windows = new Map<string, { expires: number; count: number }>();

	private readonly identities = new WeakMap<Request, Promise<string | null>>();

	constructor(
		private readonly config: ConfigService,
		private readonly jwt: JwtService,
	) {}

	private identity(request: Request): Promise<string | null> {
		let pending = this.identities.get(request);
		if (!pending) {
			const header = request.headers.authorization;
			pending =
				header?.startsWith('Bearer ') && header.length <= 4103
					? this.jwt
							.verifyAsync<{ sub: string }>(header.slice(7))
							.then((payload) => (/^[a-f0-9]{24}$/i.test(payload.sub) ? payload.sub.toLowerCase() : null))
							.catch(() => null)
					: Promise.resolve(null);
			this.identities.set(request, pending);
		}
		return pending;
	}

	private consume(key: string, limit: number, now: number) {
		if (this.windows.size >= 10000) {
			for (const [entry, value] of this.windows) if (value.expires <= now) this.windows.delete(entry);
			if (this.windows.size >= 10000 && !this.windows.has(key))
				throw new HttpException('Too many requests. Try again shortly.', 429);
		}
		let window = this.windows.get(key);
		if (!window || window.expires <= now) {
			window = { expires: now + 60000, count: 0 };
			this.windows.set(key, window);
		}
		if (++window.count > limit)
			throw new HttpException(
				{
					statusCode: 429,
					message: 'Too many requests. Try again shortly.',
					retryAfterSeconds: Math.max(1, Math.ceil((window.expires - now) / 1000)),
				},
				429,
			);
	}

	async canActivate(context: ExecutionContext) {
		if (this.config.get('NODE_ENV') === 'test') return true;
		if (context.getType<string>() !== 'graphql') return true;
		const gql = GqlExecutionContext.create(context);
		const request = gql.getContext<{ req: Request }>().req;
		const info = gql.getInfo<GraphQLResolveInfo>();
		const field = info.fieldName;
		const now = Date.now();
		const address = request.ip || 'unknown';
		const security = securityGroups[field];
		if (security) {
			// Security attempts stay IP-limited even when a caller supplies a token.
			this.consume(`ip:${address}:${security}`, 10, now);
			return true;
		}
		if (field === 'refreshSession') {
			this.consume(`ip:${address}:refresh`, 30, now);
			return true;
		}
		// Verify the signature before using a user ID for quota separation. This is
		// quota identity only; resolver guards still validate the active session.
		const userId = await this.identity(request);
		const subject = userId ? `user:${userId}` : `ip:${address}`;
		if (accountChanges.has(field)) {
			this.consume(`ip:${address}:account-security`, 60, now);
			this.consume(`${subject}:account-security`, 20, now);
		} else {
			const read = info.operation.operation === 'query';
			const group = read ? 'read' : 'write';
			this.consume(`ip:${address}:backstop:${group}`, read ? 3000 : 600, now);
			this.consume(`${subject}:${group}`, userId ? (read ? 600 : 120) : read ? 300 : 60, now);
		}
		return true;
	}
}
