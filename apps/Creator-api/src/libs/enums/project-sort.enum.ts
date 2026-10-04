import { registerEnumType } from '@nestjs/graphql';
export enum ProjectSort {
	RECENT = 'RECENT',
	POPULAR = 'POPULAR',
}
registerEnumType(ProjectSort, { name: 'ProjectSort' });
