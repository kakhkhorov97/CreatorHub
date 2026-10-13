import { ProjectSort } from '../../libs/enums/project-sort.enum';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { CITIES } from '../../libs/dto/common/locations';
import { CreatorProfile, Creators } from '../../libs/dto/creator/creator-profile';
import { DiscoveryInput } from '../../libs/dto/discovery/discovery.input';
import { PortfolioProject, Projects } from '../../libs/dto/project/portfolio-project';
import { CreatorService, Services } from '../../libs/dto/service/creator-service';
import { PricingType } from '../../libs/enums/pricing-type.enum';
import { ProfileStatus } from '../../libs/enums/profile-status.enum';
import { ProjectStatus } from '../../libs/enums/project-status.enum';
import { ServiceStatus } from '../../libs/enums/service-status.enum';
import { check, shapeIntoMongooseObjectId, page } from '../../libs/helpers/policy';
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

	// The newest published covers of one creator, used for the work strip and the service image fallback.
	// Runs after pagination so it only touches one page of rows, through ix_projects_creator.
	private covers(localField: string, as: string, limit: number): PipelineStage.Lookup {
		return {
			$lookup: {
				from: 'portfolioProjects',
				localField,
				foreignField: 'creatorId',
				as,
				pipeline: [
					{
						$match: {
							status: ProjectStatus.PUBLISHED,
							deletedAt: { $exists: false },
							coverImageUrl: { $type: 'string' },
						},
					},
					{ $sort: { publishedAt: -1, _id: -1 } },
					{ $limit: limit },
					{ $project: { coverImageUrl: 1 } },
				],
			},
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
					...(input.categoryId ? { categoryIds: shapeIntoMongooseObjectId(input.categoryId) } : {}),
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
			{
				$facet: {
					list: [
						{ $skip: offset },
						{ $limit: limit },
						this.covers('_id', '_work', 3),
						{ $set: { workImageUrls: '$_work.coverImageUrl' } },
						{ $unset: ['_owner', '_offers', '_work'] },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		);
		const [result] = await this.profileModel.aggregate<Creators>(pipeline);
		return result;
	}

	public async getProjects(input: DiscoveryInput) {
		await this.validate(input);
		const { offset, limit } = page(input);
		const [result] = await this.projectModel.aggregate<Projects>([
			{
				$match: {
					status: ProjectStatus.PUBLISHED,
					...(input.excludeProjectIds?.length
						? { _id: { $nin: input.excludeProjectIds.map(shapeIntoMongooseObjectId) } }
						: {}),
					deletedAt: { $exists: false },
					...(input.categoryId ? { categoryId: shapeIntoMongooseObjectId(input.categoryId) } : {}),
					...(input.creatorId ? { creatorId: shapeIntoMongooseObjectId(input.creatorId) } : {}),
					...this.text(input, ['title', 'summary', 'tags']),
				},
			},
			...VisibilityService.ownerPipeline('creatorId'),
			{ $match: this.creatorFilters(input, '_creator.') },
			...(input.sort === ProjectSort.POPULAR
				? ([
						{
							$lookup: {
								from: 'projectLikes',
								localField: '_id',
								foreignField: 'projectId',
								as: '_likes',
								pipeline: [{ $count: 'total' }],
							},
						},
						{ $set: { _likeCount: { $ifNull: [{ $arrayElemAt: ['$_likes.total', 0] }, 0] } } },
						{ $sort: { _likeCount: -1, publishedAt: -1, _id: -1 } },
					] as PipelineStage[])
				: [{ $sort: { publishedAt: -1, _id: -1 } } as PipelineStage]),
			{
				$facet: {
					list: [{ $skip: offset }, { $limit: limit }, { $unset: ['_owner', '_creator', '_likes', '_likeCount'] }],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]);
		return result;
	}

	public async getServices(input: DiscoveryInput) {
		await this.validate(input);
		const { offset, limit } = page(input);
		const [result] = await this.serviceModel.aggregate<Services>([
			{
				$match: {
					status: ServiceStatus.ACTIVE,
					deletedAt: { $exists: false },
					...(input.categoryId ? { categoryId: shapeIntoMongooseObjectId(input.categoryId) } : {}),
					...(input.creatorId ? { creatorId: shapeIntoMongooseObjectId(input.creatorId) } : {}),
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
			{
				$facet: {
					list: [
						{ $skip: offset },
						{ $limit: limit },
						this.covers('creatorId', '_fallback', 1),
						{ $set: { imageUrl: { $ifNull: ['$imageUrl', { $arrayElemAt: ['$_fallback.coverImageUrl', 0] }] } } },
						{ $unset: ['_owner', '_creator', '_fallback'] },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]);
		return result;
	}
}
