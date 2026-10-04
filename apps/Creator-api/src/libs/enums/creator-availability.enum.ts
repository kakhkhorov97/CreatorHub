import { registerEnumType } from '@nestjs/graphql';

export enum CreatorAvailability {
	AVAILABLE = 'AVAILABLE',
	BUSY = 'BUSY',
	UNAVAILABLE = 'UNAVAILABLE',
}

registerEnumType(CreatorAvailability, { name: 'CreatorAvailability' });
