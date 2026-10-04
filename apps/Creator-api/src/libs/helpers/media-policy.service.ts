import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PortfolioMediaInput } from '../dto/project/project.input';
import { MediaType } from '../enums/media-type.enum';
import { check } from './policy';

@Injectable()
export class MediaPolicy {
	constructor(private readonly config: ConfigService) {}

	validate(url: string, userId: string, type: MediaType = MediaType.IMAGE): void {
		const parsed = new URL(url);
		check(
			(parsed.protocol === 'https:' || (this.config.get('NODE_ENV') !== 'production' && parsed.protocol === 'http:')) &&
				!parsed.username &&
				!parsed.password,
			'Media requires an approved URL',
		);
		const prefixes = ['MEDIA_BASE_URL', 'UPLOAD_BASE_URL']
			.map((key) => this.config.get<string>(key))
			.filter((base): base is string => !!base)
			.map((base) => new URL(`${base.replace(/\/$/, '')}/${userId}/`));
		check(
			prefixes.some((prefix) => parsed.origin === prefix.origin && parsed.pathname.startsWith(prefix.pathname)),
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
