import { registerEnumType } from '@nestjs/graphql';

export enum ActivityEventType {
	PROJECT_PUBLISHED = 'PROJECT_PUBLISHED',
	PROJECT_LIKED = 'PROJECT_LIKED',
	PROJECT_COMMENTED = 'PROJECT_COMMENTED',
	CREATOR_FOLLOWED = 'CREATOR_FOLLOWED',
}

registerEnumType(ActivityEventType, { name: 'ActivityEventType' });
