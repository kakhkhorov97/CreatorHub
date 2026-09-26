import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, JsonWebKey, verify } from 'node:crypto';
import { AuthProvider } from '../../libs/enums/creatorhub.enum';
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
	private readonly challenges = new Map<string, { provider: AuthProvider; expiresAt: number; userId?: string }>();
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

	public async verify(input: SocialLoginInput, userId?: string): Promise<string> {
		const settings = this.settings(input.provider);
		const challenge = this.challenges.get(input.nonce);
		this.challenges.delete(input.nonce);
		if (
			!challenge ||
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
			return claims.sub;
		} catch {
			throw new UnauthorizedException('Social sign-in could not be verified');
		}
	}
}
