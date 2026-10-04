import { Services } from '../../libs/dto/service/creator-service';
import { Projects } from '../../libs/dto/project/portfolio-project';
import { Creators } from '../../libs/dto/creator/creator-profile';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { DiscoveryResult } from '../../libs/dto/discovery/discovery-result';
import { CITIES, City } from '../../libs/dto/common/locations';

import { AssistantInput, DiscoveryInput } from '../../libs/dto/discovery/discovery.input';

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

	@Query(() => Creators)
	public getCreators(@Args('input', { defaultValue: {} }) input: DiscoveryInput) {
		return this.discovery.getCreators(input);
	}

	@Query(() => Projects)
	public getProjects(@Args('input', { defaultValue: {} }) input: DiscoveryInput) {
		return this.discovery.getProjects(input);
	}

	@Query(() => Services)
	public getServices(@Args('input', { defaultValue: {} }) input: DiscoveryInput) {
		return this.discovery.getServices(input);
	}

	@Query(() => DiscoveryResult)
	public discoverCreators(@Args('input') input: AssistantInput) {
		return this.assistant.discover(input.request);
	}
}
