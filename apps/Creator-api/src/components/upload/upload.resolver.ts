import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import GraphQLUpload from 'graphql-upload/GraphQLUpload.js';
import type { FileUpload } from '../../libs/dto/upload/file-upload';
import { User } from '../../libs/dto/user/user';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { AuthGuard } from '../auth/guards/auth.guard';
import { UploadService } from './upload.service';

@UseGuards(AuthGuard)
@Resolver()
export class UploadResolver {
	constructor(private readonly uploadService: UploadService) {}

	@Mutation(() => String)
	public imageUploader(
		@AuthMember() user: User,
		@Args({ name: 'file', type: () => GraphQLUpload }) file: FileUpload,
		@Args('target', { defaultValue: 'project' }) target: string,
	) {
		return this.uploadService.imageUploader(user, file, target);
	}

	@Mutation(() => [String])
	public imagesUploader(
		@AuthMember() user: User,
		@Args('files', { type: () => [GraphQLUpload] }) files: Promise<FileUpload>[],
		@Args('target', { defaultValue: 'project' }) target: string,
	) {
		return this.uploadService.imagesUploader(user, files, target);
	}
}
