import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, JsonWebKey, verify } from 'node:crypto';
import { AuthProvider } from '../../libs/enums/auth-provider.enum';
import { SocialLoginInput } from '../../libs/dto/auth/auth.input';
import { newToken } from './password';

const providers = {
	GOOGLE: {
		issuer: 'https://accounts.google.com',
		keys: 'https://www.googleapis.com/oauth2/v3/certs',
		client: 'GOOGLE_CLIENT_ID',
	},
	TELEGRAM: {
		issuer: 'https://oauth.telegram.org',
		keys: 'https://oauth.telegram.org/.well-known/jwks.json',
		client: 'TELEGRAM_CLIENT_ID',
	},
	KAKAO: {
		issuer: 'https://kauth.kakao.com',
		keys: 'https://kauth.kakao.com/.well-known/jwks.json',
		client: 'KAKAO_CLIENT_ID',
	},
};

@Injectable()
export class SocialAuthService {
	private readonly kakaoAttempts = new Map<string, { nonce: string; redirectUri: string; expiresAt: number }>();

	private readonly challenges = new Map<
		string,
		{ provider: AuthProvider; expiresAt: number; userId?: string; subject?: string; displayName?: string }
	>();

	constructor(private readonly config: ConfigService) {}

	private settings(provider: AuthProvider) {
		const settings = providers[provider as keyof typeof providers];
		if (!settings) throw new UnauthorizedException('Select a social provider');
		const audience = this.config.get<string>(settings.client);
		if (!audience) throw new ServiceUnavailableException(`${provider} login is not configured`);
		return { ...settings, audience };
	}

	public begin(provider: AuthProvider, userId?: string) {
		this.settings(provider);
		for (const [nonce, value] of this.challenges) if (value.expiresAt <= Date.now()) this.challenges.delete(nonce);
		if (this.challenges.size >= 1000) throw new ServiceUnavailableException('Try signing in again shortly');
		const nonce = newToken();
		this.challenges.set(nonce, { provider, expiresAt: Date.now() + 10 * 60000, userId });
		return nonce;
	}

	public prepareGoogleSignup(profile: { subject: string; displayName?: string }) {
		return this.prepareSignup(AuthProvider.GOOGLE, profile);
	}

	public consumeGoogleSignup(token: string) {
		return this.consumeSignup(AuthProvider.GOOGLE, token);
	}

	public prepareSignup(provider: AuthProvider, profile: { subject: string; displayName?: string }) {
		const token = this.begin(provider);
		this.challenges.set(token, { provider, expiresAt: Date.now() + 10 * 60000, ...profile });
		return token;
	}

	public consumeSignup(provider: AuthProvider, token: string) {
		const pending = this.challenges.get(token);
		this.challenges.delete(token);
		if (!pending?.subject || pending.provider !== provider || pending.expiresAt <= Date.now()) {
			const name = provider === AuthProvider.GOOGLE ? 'Google' : provider === AuthProvider.KAKAO ? 'Kakao' : 'Telegram';
			throw new UnauthorizedException(`${name} signup expired. Continue with ${name} again.`);
		}
		return { subject: pending.subject, displayName: pending.displayName };
	}

	public beginKakao() {
		const settings = this.settings(AuthProvider.KAKAO);
		if (!this.config.get<string>('KAKAO_CLIENT_SECRET'))
			throw new ServiceUnavailableException('Kakao login is not configured');
		for (const [state, attempt] of this.kakaoAttempts)
			if (attempt.expiresAt <= Date.now()) this.kakaoAttempts.delete(state);
		if (this.kakaoAttempts.size >= 1000) throw new ServiceUnavailableException('Try signing in again shortly');
		const redirectUri = new URL(
			'/account/kakao-callback',
			this.config.get<string>('FRONTEND_URL') || 'http://localhost:7007',
		).toString();
		const nonce = this.begin(AuthProvider.KAKAO);
		const state = newToken();
		this.kakaoAttempts.set(state, { nonce, redirectUri, expiresAt: Date.now() + 10 * 60000 });
		const url = new URL('https://kauth.kakao.com/oauth/authorize');
		url.search = new URLSearchParams({
			client_id: settings.audience,
			redirect_uri: redirectUri,
			response_type: 'code',
			scope: 'openid',
			nonce,
			state,
		}).toString();
		return { authorizationUrl: url.toString(), state };
	}

	public async verifyKakaoCode(input: { code: string; state: string }) {
		const attempt = this.kakaoAttempts.get(input.state);
		this.kakaoAttempts.delete(input.state);
		if (!attempt || attempt.expiresAt <= Date.now())
			throw new UnauthorizedException('Kakao sign-in expired. Please try again.');
		try {
			const settings = this.settings(AuthProvider.KAKAO);
			const response = await fetch('https://kauth.kakao.com/oauth/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'authorization_code',
					client_id: settings.audience,
					client_secret: this.config.get<string>('KAKAO_CLIENT_SECRET') || '',
					redirect_uri: attempt.redirectUri,
					code: input.code,
				}),
				signal: AbortSignal.timeout(8000),
				redirect: 'error',
			});
			if (!response.ok) throw new Error('Token exchange failed');
			const result = await response.json();
			if (typeof result.id_token !== 'string' || result.id_token.length > 16384) throw new Error('Missing ID token');
			return await this.verifyProfile({ provider: AuthProvider.KAKAO, nonce: attempt.nonce, idToken: result.id_token });
		} catch {
			throw new UnauthorizedException('Kakao sign-in could not be verified. Please try again.');
		} finally {
			this.challenges.delete(attempt.nonce);
		}
	}

	public async verify(input: SocialLoginInput, userId?: string): Promise<string> {
		return (await this.verifyProfile(input, userId)).subject;
	}

	public async verifyProfile(
		input: SocialLoginInput,
		userId?: string,
	): Promise<{ subject: string; displayName?: string }> {
		const settings = this.settings(input.provider);
		const challenge = this.challenges.get(input.nonce);
		this.challenges.delete(input.nonce);
		if (
			!challenge ||
			challenge.subject ||
			challenge.provider !== input.provider ||
			challenge.userId !== userId ||
			challenge.expiresAt <= Date.now()
		)
			throw new UnauthorizedException('Start a new social sign-in');
		try {
			const parts = input.idToken.split('.');
			if (parts.length !== 3) throw new Error('Invalid token');
			const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
			const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
			if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Invalid algorithm');
			const response = await fetch(settings.keys, { signal: AbortSignal.timeout(5000) });
			if (!response.ok) throw new Error('Provider unavailable');
			const { keys } = (await response.json()) as { keys: (JsonWebKey & { kid: string })[] };
			const key = keys.find((key) => key.kid === header.kid && key.kty === 'RSA');
			if (
				!key ||
				!verify(
					'RSA-SHA256',
					Buffer.from(parts.slice(0, 2).join('.')),
					createPublicKey({ key, format: 'jwk' }),
					Buffer.from(parts[2], 'base64url'),
				)
			)
				throw new Error('Invalid signature');
			const issuers =
				input.provider === AuthProvider.GOOGLE ? [settings.issuer, 'accounts.google.com'] : [settings.issuer];
			const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
			const now = Math.floor(Date.now() / 1000);
			if (
				!issuers.includes(claims.iss) ||
				!audiences.includes(settings.audience) ||
				(claims.azp && claims.azp !== settings.audience) ||
				typeof claims.exp !== 'number' ||
				claims.exp <= now ||
				typeof claims.iat !== 'number' ||
				claims.iat > now + 60 ||
				(claims.nbf && claims.nbf > now) ||
				claims.nonce !== input.nonce ||
				typeof claims.sub !== 'string' ||
				!claims.sub ||
				claims.sub.length > 254
			)
				throw new Error('Invalid claims');
			return {
				subject: claims.sub,
				displayName:
					typeof claims.name === 'string'
						? claims.name.trim().slice(0, 60)
						: typeof claims.nickname === 'string'
							? claims.nickname.trim().slice(0, 60)
							: undefined,
			};
		} catch {
			throw new UnauthorizedException('Social sign-in could not be verified');
		}
	}
}
