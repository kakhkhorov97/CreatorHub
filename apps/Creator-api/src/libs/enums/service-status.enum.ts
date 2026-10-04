import { registerEnumType } from '@nestjs/graphql';

export enum ServiceStatus {
	DRAFT = 'DRAFT',
	ACTIVE = 'ACTIVE',
	PAUSED = 'PAUSED',
	ARCHIVED = 'ARCHIVED',
}

registerEnumType(ServiceStatus, { name: 'ServiceStatus' });
