import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { CreateServiceInput } from '../../libs/dto/service/service.input';
import { UpdateServiceInput } from '../../libs/dto/service/service.update';
import { User } from '../../libs/dto/user/user';
import { PricingType } from '../../libs/enums/pricing-type.enum';
import { ServiceStatus } from '../../libs/enums/service-status.enum';
import {
	check,
	defined,
	shapeIntoMongooseObjectId,
	page,
	requireRecord,
	requireCreator,
} from '../../libs/helpers/policy';
import { saveRevision } from '../../libs/helpers/save-revision';
import { CategoriesService } from '../category/category.service';
import { CreatorsService } from '../creator/creator.service';
import { VisibilityService } from '../creator/visibility.service';

@Injectable()
export class ServiceService {
	constructor(
		@InjectModel('CreatorService') private readonly serviceModel: Model<CreatorService>,
		private readonly creators: CreatorsService,
		private readonly categories: CategoriesService,
		private readonly visibility: VisibilityService,
	) {}

	public async getService(id: string) {
		const service = requireRecord(
			await this.serviceModel.findOne({
				_id: shapeIntoMongooseObjectId(id),
				status: ServiceStatus.ACTIVE,
				deletedAt: { $exists: false },
			}),
		);
		await this.visibility.profile(service.creatorId);
		return service;
	}

	public async forSubmission(id: Types.ObjectId, creatorId: Types.ObjectId, session: ClientSession) {
		return requireRecord(
			await this.serviceModel
				.findOne({ _id: id, creatorId, status: ServiceStatus.ACTIVE, deletedAt: { $exists: false } })
				.session(session),
		);
	}

	public async getMyServices(currentUser: User, input: PageInput) {
		requireCreator(currentUser);
		const creator = await this.creators.own(currentUser);
		const { offset, limit } = page(input);
		const query = this.serviceModel.find({ creatorId: creator._id, deletedAt: { $exists: false } });
		const [list, total] = await Promise.all([
			query.clone().sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list, metaCounter: total ? [{ total }] : [] };
	}

	private async owned(currentUser: User, id: string) {
		requireCreator(currentUser);
		const creator = await this.creators.own(currentUser);
		return requireRecord(
			await this.serviceModel.findOne({
				_id: shapeIntoMongooseObjectId(id),
				creatorId: creator._id,
				deletedAt: { $exists: false },
			}),
		);
	}

	private async validate(service: CreatorService) {
		if (service.categoryId) await this.categories.validate([service.categoryId], false);
		if (service.pricingType === PricingType.STARTING_AT)
			check(service.startingPrice !== undefined, 'A starting price is required');
		else check(service.startingPrice === undefined, 'Custom quotes cannot have a starting price');
		if (service.status === ServiceStatus.ACTIVE) {
			check(
				service.categoryId && service.description && service.deliverables.length,
				'Activation requires a category, description, and deliverables',
			);
			await this.categories.validate([service.categoryId]);
		}
	}

	public async createService(currentUser: User, input: CreateServiceInput) {
		requireCreator(currentUser);
		const creator = await this.creators.own(currentUser);
		const service = new this.serviceModel({ ...defined(input), creatorId: creator._id });
		await this.validate(service);
		return service.save();
	}

	public async updateService(currentUser: User, id: string, input: UpdateServiceInput) {
		const service = await this.owned(currentUser, id);
		Object.assign(service, defined(input));
		if (input.pricingType === PricingType.CUSTOM_QUOTE && input.startingPrice === undefined)
			service.startingPrice = undefined;
		await this.validate(service);
		return saveRevision(this.serviceModel, service);
	}

	public async setServiceStatus(currentUser: User, id: string, status: ServiceStatus) {
		const service = await this.owned(currentUser, id);
		const transitions: Record<ServiceStatus, ServiceStatus[]> = {
			DRAFT: [ServiceStatus.DRAFT, ServiceStatus.ACTIVE],
			ACTIVE: [ServiceStatus.ACTIVE, ServiceStatus.PAUSED, ServiceStatus.ARCHIVED],
			PAUSED: [ServiceStatus.PAUSED, ServiceStatus.ACTIVE, ServiceStatus.ARCHIVED],
			ARCHIVED: [ServiceStatus.ARCHIVED, ServiceStatus.ACTIVE],
		};
		check(transitions[service.status].includes(status), 'Invalid service status transition');
		service.status = status;
		await this.validate(service);
		return saveRevision(this.serviceModel, service);
	}

	public async deleteService(currentUser: User, id: string) {
		const service = await this.owned(currentUser, id);
		service.deletedAt = new Date();
		await saveRevision(this.serviceModel, service);
		return true;
	}
}
