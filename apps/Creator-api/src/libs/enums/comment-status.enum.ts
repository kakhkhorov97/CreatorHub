import { registerEnumType } from '@nestjs/graphql';

export enum CommentStatus {
	ACTIVE = 'ACTIVE',
	HIDDEN = 'HIDDEN',
	DELETED = 'DELETED',
}

registerEnumType(CommentStatus, { name: 'CommentStatus' });
