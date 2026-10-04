import { registerEnumType } from '@nestjs/graphql';

export enum MediaType {
	IMAGE = 'IMAGE',
	VIDEO = 'VIDEO',
}

registerEnumType(MediaType, { name: 'MediaType' });
