import { ActivityService } from '../activity/activity.service';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreateProjectInput } from '../../libs/dto/project/project.input';
import { UpdateProjectInput } from '../../libs/dto/project/project.update';
import { User } from '../../libs/dto/user/user';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';
import { ProjectStatus } from '../../libs/enums/project-status.enum';
import { MediaPolicy } from '../../libs/helpers/media-policy.service';
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
export class ProjectService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		private readonly activity: ActivityService,
		@InjectModel('PortfolioProject') private readonly projectModel: Model<PortfolioProject>,
		private readonly creators: CreatorsService,
		private readonly categories: CategoriesService,
		private readonly visibility: VisibilityService,
		private readonly media: MediaPolicy,
	) {}

	public async getProject(id: string) {
		const project = requireRecord(
			await this.projectModel.findOne({
				_id: shapeIntoMongooseObjectId(id),
				status: ProjectStatus.PUBLISHED,
				deletedAt: { $exists: false },
			}),
		);
		await this.visibility.profile(project.creatorId);
		return project;
	}

	public async getMyProjects(currentUser: User, input: PageInput) {
		requireCreator(currentUser);
		const creator = await this.creators.own(currentUser);
		const { offset, limit } = page(input);
		const query = this.projectModel.find({ creatorId: creator._id, deletedAt: { $exists: false } });
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
			await this.projectModel.findOne({
				_id: shapeIntoMongooseObjectId(id),
				creatorId: creator._id,
				deletedAt: { $exists: false },
			}),
		);
	}

	private async validate(project: PortfolioProject, currentUser: User) {
		if (project.categoryId) await this.categories.validate([project.categoryId], false);
		if (project.coverImageUrl) this.media.validate(project.coverImageUrl, String(currentUser._id));
		this.media.portfolio(project.media, String(currentUser._id));
		if (project.status === ProjectStatus.PUBLISHED) {
			check(
				project.categoryId && project.description && project.coverImageUrl && project.media.length,
				'Publishing requires a category, description, cover image, and media',
			);
			await this.categories.validate([project.categoryId]);
		}
	}

	public async createProject(currentUser: User, input: CreateProjectInput) {
		requireCreator(currentUser);
		const creator = await this.creators.own(currentUser);
		const project = new this.projectModel({ ...defined(input), creatorId: creator._id });
		await this.validate(project, currentUser);
		return project.save();
	}

	public async updateProject(currentUser: User, id: string, input: UpdateProjectInput) {
		const project = await this.owned(currentUser, id);
		Object.assign(project, defined(input));
		await this.validate(project, currentUser);
		return saveRevision(this.projectModel, project);
	}

	public async setProjectStatus(currentUser: User, id: string, status: ProjectStatus) {
		return this.connection.transaction(async (session) => {
			const project = await this.owned(currentUser, id);
			const firstPublication = status === ProjectStatus.PUBLISHED && !project.publishedAt;
			check(
				status !== ProjectStatus.DRAFT || project.status === ProjectStatus.DRAFT,
				'Published projects cannot return to draft',
			);
			check(
				status !== ProjectStatus.ARCHIVED || project.status !== ProjectStatus.DRAFT,
				'Publish a project before archiving it',
			);
			project.status = status;
			await this.validate(project, currentUser);
			if (status === ProjectStatus.PUBLISHED) project.publishedAt ??= new Date();
			const updated = await saveRevision(this.projectModel, project, session);
			if (firstPublication) {
				await this.visibility.profile(project.creatorId, session);
				await this.activity.record(
					{
						performedById: currentUser._id,
						creatorId: project.creatorId,
						projectId: project._id,
						type: ActivityEventType.PROJECT_PUBLISHED,
					},
					session,
				);
			}
			return updated;
		});
	}

	public async deleteProject(currentUser: User, id: string) {
		const project = await this.owned(currentUser, id);
		project.deletedAt = new Date();
		await saveRevision(this.projectModel, project);
		return true;
	}
}
