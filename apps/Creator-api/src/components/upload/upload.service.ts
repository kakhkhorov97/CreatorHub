import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWriteStream } from 'node:fs';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { FileUpload } from 'graphql-upload';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../libs/dto/user/user';
import { requireActive } from '../../libs/helpers/policy';

const MAX_BYTES = 10_000_000;

const extensions: Record<string, string> = {
	'image/png': '.png',
	'image/jpeg': '.jpg',
	'image/webp': '.webp',
	'video/mp4': '.mp4',
	'video/webm': '.webm',
};

@Injectable()
export class UploadService {
	constructor(private readonly config: ConfigService) {}

	public async imageUploader(user: User, file: FileUpload, target: string): Promise<string> {
		requireActive(user);
		if (!['avatar', 'project'].includes(target))
			throw new BadRequestException('Choose avatar or project as the upload target');
		const extension = extensions[file.mimetype];
		if (!extension || (target === 'avatar' && !file.mimetype.startsWith('image/')))
			throw new BadRequestException('Unsupported upload type');
		const root = resolve(this.config.get<string>('UPLOAD_DIR') ?? 'uploads');
		const directory = join(root, String(user._id), target);
		const pending = join(root, '.pending');
		await mkdir(directory, { recursive: true });
		await mkdir(pending, { recursive: true });
		const filename = uuidv4() + extension;
		const temporary = join(pending, filename);
		const destination = join(directory, filename);
		let size = 0;
		try {
			await pipeline(
				file.createReadStream(),
				new Transform({
					transform(chunk, _encoding, callback) {
						size += chunk.length;
						callback(size > MAX_BYTES ? new BadRequestException('Uploads must be at most 10 MB') : null, chunk);
					},
				}),
				createWriteStream(temporary, { flags: 'wx' }),
			);
			const handle = await open(temporary, 'r');
			const header = Buffer.alloc(16);
			try {
				await handle.read(header, 0, header.length, 0);
			} finally {
				await handle.close();
			}
			const valid =
				file.mimetype === 'image/png'
					? header.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
					: file.mimetype === 'image/jpeg'
						? header.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))
						: file.mimetype === 'image/webp'
							? header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP'
							: file.mimetype === 'video/mp4'
								? header.toString('ascii', 4, 8) === 'ftyp'
								: header.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex'));
			if (!size || !valid) throw new BadRequestException('File content does not match its media type');
			await rename(temporary, destination);
			const base = this.config.getOrThrow<string>('UPLOAD_BASE_URL').replace(/\/$/, '');
			return `${base}/${user._id}/${target}/${filename}`;
		} catch (error) {
			await unlink(temporary).catch(() => undefined);
			throw error;
		}
	}

	public async imagesUploader(user: User, files: Promise<FileUpload>[], target: string): Promise<string[]> {
		if (!files.length || files.length > 10) throw new BadRequestException('Upload between one and ten files');
		const urls: string[] = [];
		try {
			for (const file of files) urls.push(await this.imageUploader(user, await file, target));
			return urls;
		} catch (error) {
			const root = resolve(this.config.get<string>('UPLOAD_DIR') ?? 'uploads');
			const base = this.config.getOrThrow<string>('UPLOAD_BASE_URL').replace(/\/$/, '') + '/';
			await Promise.all(urls.map((url) => unlink(join(root, url.slice(base.length))).catch(() => undefined)));
			throw error;
		}
	}
}
