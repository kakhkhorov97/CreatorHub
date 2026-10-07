import { registerEnumType } from '@nestjs/graphql';

export enum Locale {
	ko = 'ko',
	en = 'en',
	uz = 'uz',
}

registerEnumType(Locale, { name: 'Locale' });
