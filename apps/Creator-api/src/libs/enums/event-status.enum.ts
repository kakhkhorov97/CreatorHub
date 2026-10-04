import { registerEnumType } from '@nestjs/graphql';

export enum EventStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	ARCHIVED = 'ARCHIVED',
}

registerEnumType(EventStatus, { name: 'EventStatus' });
