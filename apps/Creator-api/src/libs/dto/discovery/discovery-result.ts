import { Field, ObjectType } from '@nestjs/graphql';
import { CreatorProfile } from '../creator/creator-profile';
import { PortfolioProject } from '../project/portfolio-project';
import { CreatorService } from '../service/creator-service';

@ObjectType()
export class DiscoveryResult {
	@Field()
	mode: string;

	@Field()
	explanation: string;

	@Field(() => [CreatorProfile])
	creators: CreatorProfile[];

	@Field(() => [PortfolioProject])
	projects: PortfolioProject[];

	@Field(() => [CreatorService])
	services: CreatorService[];
}
