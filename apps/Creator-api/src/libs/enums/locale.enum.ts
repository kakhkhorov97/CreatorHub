import { registerEnumType } from '@nestjs/graphql';

export enum Locale {
	ko = 'ko',
	en = 'en',
}

registerEnumType(Locale, { name: 'Locale' });
