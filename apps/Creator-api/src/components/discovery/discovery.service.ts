import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { CITIES } from '../../libs/dto/common/locations';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { DiscoveryInput } from '../../libs/dto/discovery/discovery.input';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { PricingType, ProfileStatus, ProjectStatus, ServiceStatus } from '../../libs/enums/creatorhub.enum';
import { check, objectId, page } from '../../libs/utils/policy';
import { CategoriesService } from '../category/category.service';
import { VisibilityService } from '../creator/visibility.service';

@Injectable()
export class DiscoveryService {
	constructor(
		@InjectModel('CreatorProfile') private readonly profileModel: Model<CreatorProfile>,
		@InjectModel('PortfolioProject') private readonly projectModel: Model<PortfolioProject>,
		@InjectModel('CreatorService') private readonly serviceModel: Model<CreatorService>,
		private readonly categories: CategoriesService,
	) {}

	private async validate(input: DiscoveryInput) {
		if (input.categoryId) await this.categories.validate([input.categoryId]);
		if (input.city)
			check(
				CITIES.some((city) => city.key === input.city),
				'Unknown city',
			);
	}

	private text(input: DiscoveryInput, fields: string[]) {
		if (!input.query) return {};
		const expression = input.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return { $or: fields.map((field) => ({ [field]: { $regex: expression, $options: 'i' } })) };
	}

	private creatorFilters(input: DiscoveryInput, prefix = '') {
		return {
			...(input.city ? { [prefix + 'city']: input.city } : {}),
			...(input.remoteAvailable !== undefined ? { [prefix + 'remoteAvailable']: input.remoteAvailable } : {}),
		};
	}

	public async getCreators(input: DiscoveryInput) {
		await this.validate(input);
		const { offset, limit } = page(input);
		const pipeline: PipelineStage[] = [
			{
				$match: {
					status: ProfileStatus.PUBLISHED,
					deletedAt: { $exists: false },
					...this.creatorFilters(input),
					...(input.categoryId ? { categoryIds: objectId(input.categoryId) } : {}),
					...this.text(input, ['headline', 'bio', 'skills']),
				},
			},
			...VisibilityService.ownerPipeline(),
		];
		if (input.budgetMax !== undefined)
			pipeline.push(
				{
					$lookup: {
						from: 'services',
						localField: '_id',
						foreignField: 'creatorId',
						as: '_offers',
						pipeline: [
							{
								$match: {
									status: ServiceStatus.ACTIVE,
									deletedAt: { $exists: false },
									$or: [{ pricingType: PricingType.CUSTOM_QUOTE }, { startingPrice: { $lte: input.budgetMax } }],
								},
							},
							{ $limit: 1 },
						],
					},
				},
				{ $match: { '_offers.0': { $exists: true } } },
			);
		pipeline.push(
			{ $sort: { publishedAt: -1, _id: -1 } },
			{ $skip: offset },
			{ $limit: limit },
			{ $unset: ['_owner', '_offers'] },
		);
		return this.profileModel.aggregate<CreatorProfile>(pipeline);
	}

	public async getProjects(input: DiscoveryInput) {
		await this.validate(input);
		const { offset, limit } = page(input);
		return this.projectModel.aggregate<PortfolioProject>([
			{
				$match: {
					status: ProjectStatus.PUBLISHED,
					deletedAt: { $exists: false },
					...(input.categoryId ? { categoryId: objectId(input.categoryId) } : {}),
					...(input.creatorId ? { creatorId: objectId(input.creatorId) } : {}),
					...this.text(input, ['title', 'summary', 'tags']),
				},
			},
			...VisibilityService.ownerPipeline('creatorId'),
			{ $match: this.creatorFilters(input, '_creator.') },
			{ $sort: { publishedAt: -1, _id: -1 } },
			{ $skip: offset },
			{ $limit: limit },
			{ $unset: ['_owner', '_creator'] },
		]);
	}

	public async getServices(input: DiscoveryInput) {
		await this.validate(input);
		const { offset, limit } = page(input);
		return this.serviceModel.aggregate<CreatorService>([
			{
				$match: {
					status: ServiceStatus.ACTIVE,
					deletedAt: { $exists: false },
					...(input.categoryId ? { categoryId: objectId(input.categoryId) } : {}),
					...(input.creatorId ? { creatorId: objectId(input.creatorId) } : {}),
					...this.text(input, ['title', 'description']),
				},
			},
			...(input.budgetMax !== undefined
				? [
						{
							$match: {
								$or: [{ pricingType: PricingType.CUSTOM_QUOTE }, { startingPrice: { $lte: input.budgetMax } }],
							},
						},
					]
				: []),
			...VisibilityService.ownerPipeline('creatorId'),
			{ $match: this.creatorFilters(input, '_creator.') },
			{ $sort: { createdAt: -1, _id: -1 } },
			{ $skip: offset },
			{ $limit: limit },
			{ $unset: ['_owner', '_creator'] },
		]);
	}
}
