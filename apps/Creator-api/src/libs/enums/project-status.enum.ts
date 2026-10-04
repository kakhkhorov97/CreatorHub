import { registerEnumType } from '@nestjs/graphql';

export enum ProjectStatus {
	DRAFT = 'DRAFT',
	PUBLISHED = 'PUBLISHED',
	ARCHIVED = 'ARCHIVED',
}

registerEnumType(ProjectStatus, { name: 'ProjectStatus' });
