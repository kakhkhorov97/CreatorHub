import { registerEnumType } from '@nestjs/graphql';

export enum Currency {
	KRW = 'KRW',
}

registerEnumType(Currency, { name: 'Currency' });
