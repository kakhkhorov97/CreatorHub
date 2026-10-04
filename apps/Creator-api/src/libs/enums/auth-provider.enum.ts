import { registerEnumType } from '@nestjs/graphql';

export enum AuthProvider {
	EMAIL = 'EMAIL',
	PHONE = 'PHONE',
	GOOGLE = 'GOOGLE',
	TELEGRAM = 'TELEGRAM',
	KAKAO = 'KAKAO',
}

registerEnumType(AuthProvider, { name: 'AuthProvider' });
