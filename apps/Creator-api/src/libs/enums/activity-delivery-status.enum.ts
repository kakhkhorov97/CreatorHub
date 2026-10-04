import { registerEnumType } from '@nestjs/graphql';

export enum ActivityDeliveryStatus {
	PENDING = 'PENDING',
	PROCESSING = 'PROCESSING',
	COMPLETE = 'COMPLETE',
}

registerEnumType(ActivityDeliveryStatus, { name: 'ActivityDeliveryStatus' });
