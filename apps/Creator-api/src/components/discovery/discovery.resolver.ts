import { Args, Query, Resolver } from '@nestjs/graphql';
import { DiscoveryResult } from '../../libs/dto/discovery/discovery-result';
import { CITIES, City } from '../../libs/dto/common/locations';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { AssistantInput, DiscoveryInput } from '../../libs/dto/discovery/discovery.input';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { AssistantService } from './assistant.service';
import { DiscoveryService } from './discovery.service';

@Resolver()
export class DiscoveryResolver {
	constructor(
		private readonly discovery: DiscoveryService,
		private readonly assistant: AssistantService,
	) {}

	@Query(() => [City])
	public getCities() {
		return CITIES;
	}

	@Query(() => [CreatorProfile])
	public getCreators(@Args('input', { defaultValue: {} }) input: DiscoveryInput) {
		return this.discovery.getCreators(input);
	}

	@Query(() => [PortfolioProject])
	public getProjects(@Args('input', { defaultValue: {} }) input: DiscoveryInput) {
		return this.discovery.getProjects(input);
	}

	@Query(() => [CreatorService])
	public getServices(@Args('input', { defaultValue: {} }) input: DiscoveryInput) {
		return this.discovery.getServices(input);
	}

	@Query(() => DiscoveryResult)
	public discoverCreators(@Args('input') input: AssistantInput) {
		return this.assistant.discover(input.request);
	}
}
