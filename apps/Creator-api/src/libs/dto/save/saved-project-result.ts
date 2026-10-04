import { MetaCounter } from '../common/meta-counter';
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

@ObjectType()
export class SavedProjects {
	@Field(() => [SavedProjectResult])
	list!: SavedProjectResult[];

	@Field(() => [MetaCounter])
	metaCounter!: MetaCounter[];
}
