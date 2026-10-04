import { registerEnumType } from '@nestjs/graphql';

export enum UserStatus {
	ACTIVE = 'ACTIVE',
	SUSPENDED = 'SUSPENDED',
	DELETED = 'DELETED',
}

registerEnumType(UserStatus, { name: 'UserStatus' });
