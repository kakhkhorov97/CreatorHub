import { registerEnumType } from '@nestjs/graphql';
export enum AdminKind {
	USERS = 'USERS',
	CREATORS = 'CREATORS',
	PROJECTS = 'PROJECTS',
	SERVICES = 'SERVICES',
	COMMENTS = 'COMMENTS',
}
registerEnumType(AdminKind, { name: 'AdminKind' });
