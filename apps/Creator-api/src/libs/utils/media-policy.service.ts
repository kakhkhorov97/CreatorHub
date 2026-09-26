import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PortfolioMediaInput } from '../dto/project/project.input';
import { MediaType } from '../enums/creatorhub.enum';
import { check } from './policy';

@Injectable()
export class MediaPolicy {
	constructor(private readonly config: ConfigService) {}

	validate(url: string, userId: string, type: MediaType = MediaType.IMAGE): void {
		const parsed = new URL(url);
		check(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'Media requires an HTTPS URL');
		const base = this.config.getOrThrow<string>('MEDIA_BASE_URL');
		const prefix = new URL(`${base.replace(/\/$/, '')}/${userId}/`);
		check(
			parsed.origin === prefix.origin && parsed.pathname.startsWith(prefix.pathname),
			'Media must be uploaded to your account storage prefix',
		);
		check(!/%2f|%5c|%2e/i.test(parsed.pathname), 'Encoded path separators are not allowed');
		const allowed = type === MediaType.IMAGE ? /\.(png|jpe?g|webp|avif)$/i : /\.(mp4|webm)$/i;
		check(allowed.test(parsed.pathname), 'Unsupported media extension');
	}

	portfolio(media: PortfolioMediaInput[], userId: string): void {
		check(new Set(media.map((item) => item.sortOrder)).size === media.length, 'Media sort positions must be distinct');
		for (const item of media) this.validate(item.url, userId, item.type);
	}
}
