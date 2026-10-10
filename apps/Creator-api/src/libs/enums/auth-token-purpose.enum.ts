import { registerEnumType } from '@nestjs/graphql';

export enum AuthTokenPurpose {
	EMAIL_VERIFY = 'EMAIL_VERIFY',
	EMAIL_CHANGE = 'EMAIL_CHANGE',
	PASSWORD_RESET = 'PASSWORD_RESET',
}

registerEnumType(AuthTokenPurpose, { name: 'AuthTokenPurpose' });
