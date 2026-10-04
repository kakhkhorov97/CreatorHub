import { registerEnumType } from '@nestjs/graphql';

export enum AuthTokenPurpose {
	EMAIL_VERIFY = 'EMAIL_VERIFY',
	PASSWORD_RESET = 'PASSWORD_RESET',
}

registerEnumType(AuthTokenPurpose, { name: 'AuthTokenPurpose' });
