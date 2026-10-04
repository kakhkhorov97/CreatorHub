import { registerEnumType } from '@nestjs/graphql';

export enum UserRole {
	USER = 'USER',
	CREATOR = 'CREATOR',
	ADMIN = 'ADMIN',
}

registerEnumType(UserRole, { name: 'UserRole' });
