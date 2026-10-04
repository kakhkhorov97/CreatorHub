import { registerEnumType } from '@nestjs/graphql';

export enum ProfileStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	HIDDEN = 'HIDDEN',
}

registerEnumType(ProfileStatus, { name: 'ProfileStatus' });
