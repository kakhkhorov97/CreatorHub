import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PortfolioProject } from '../project/portfolio-project';

@ObjectType()
export class SavedProjectResult {
	@Field(() => ID)
	projectId: string;

	@Field()
	savedAt: Date;

	@Field()
	available: boolean;

	@Field(() => PortfolioProject, { nullable: true })
	project?: PortfolioProject;
}
