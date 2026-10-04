import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { AdminKind } from '../../libs/enums/admin-kind.enum';
import { AdminDirectoryInput, AdminUserUpdateInput } from '../../libs/dto/admin/admin.input';
import { SiteContent, SiteContentInput, siteDefaults } from '../../libs/dto/admin/site-content';
import { User } from '../../libs/dto/user/user';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { ProjectComment } from '../../libs/dto/comment/project-comment';
import { UpdateCreatorInput } from '../../libs/dto/creator/creator.update';
import { CreateProjectInput } from '../../libs/dto/project/project.input';
import { AdminProjectUpdateInput } from '../../libs/dto/admin/admin-project.update';
import { CreateServiceInput } from '../../libs/dto/service/service.input';
import { UpdateServiceInput } from '../../libs/dto/service/service.update';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';
import { ProfileStatus } from '../../libs/enums/profile-status.enum';
import { ProjectStatus } from '../../libs/enums/project-status.enum';
import { ServiceStatus } from '../../libs/enums/service-status.enum';
import { CommentStatus } from '../../libs/enums/comment-status.enum';
import { PricingType } from '../../libs/enums/pricing-type.enum';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';
import { CITIES } from '../../libs/dto/common/locations';
import {
	check,
	defined,
	page,
	requireActive,
	requireAdmin,
	requireRecord,
	sameId,
	shapeIntoMongooseObjectId,
} from '../../libs/helpers/policy';
import { saveRevision } from '../../libs/helpers/save-revision';
import { MediaPolicy } from '../../libs/helpers/media-policy.service';
import { CategoriesService } from '../category/category.service';
import { AuthService } from '../auth/auth.service';
import { ActivityService } from '../activity/activity.service';
import { VisibilityService } from '../creator/visibility.service';

@Injectable()
export class AdminService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		@InjectModel('User') private readonly users: Model<User>,
		@InjectModel('CreatorProfile') private readonly creators: Model<CreatorProfile>,
		@InjectModel('PortfolioProject') private readonly projects: Model<PortfolioProject>,
		@InjectModel('CreatorService') private readonly services: Model<CreatorService>,
		@InjectModel('ProjectComment') private readonly comments: Model<ProjectComment>,
		@InjectModel('SiteContent') private readonly content: Model<SiteContent>,
		private readonly auth: AuthService,
		private readonly categories: CategoriesService,
		private readonly media: MediaPolicy,
		private readonly activity: ActivityService,
		private readonly visibility: VisibilityService,
	) {}

	private authorize(user: User) {
		requireActive(user);
		requireAdmin(user);
	}

	private model(kind: AdminKind) {
		const names = {
			USERS: 'User',
			CREATORS: 'CreatorProfile',
			PROJECTS: 'PortfolioProject',
			SERVICES: 'CreatorService',
			COMMENTS: 'ProjectComment',
		};
		return this.connection.model(names[kind]);
	}

	async directory(user: User, kind: AdminKind, input: AdminDirectoryInput) {
		this.authorize(user);
		const statuses = {
			USERS: UserStatus,
			CREATORS: ProfileStatus,
			PROJECTS: ProjectStatus,
			SERVICES: ServiceStatus,
			COMMENTS: CommentStatus,
		};
		if (input.status) check(Object.values(statuses[kind]).includes(input.status as never), 'Invalid status filter');
		check(!input.role || kind === AdminKind.USERS, 'Role filtering is available for users');
		const filter: Record<string, unknown> = {};
		if (input.status) filter.status = input.status;
		if (input.role) filter.role = input.role;
		if (input.removed !== undefined) filter.deletedAt = { $exists: input.removed };
		if (input.id) filter._id = shapeIntoMongooseObjectId(input.id);
		if (input.search?.trim()) {
			const escaped = input.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const fields = {
				USERS: ['displayName'],
				CREATORS: ['slug', 'headline', 'city'],
				PROJECTS: ['title', 'slug'],
				SERVICES: ['title'],
				COMMENTS: ['content'],
			};
			filter.$or = fields[kind].map((field) => ({ [field]: { $regex: escaped, $options: 'i' } }));
		}
		const model = this.model(kind),
			{ offset, limit } = page(input);
		const [rows, total] = await Promise.all([
			model.find(filter).sort({ updatedAt: -1, _id: -1 }).skip(offset).limit(limit).lean(),
			model.countDocuments(filter),
		]);
		const list = await Promise.all(
			rows.map(async (record) => {
				const r = record as unknown as Omit<User, 'status'> &
					Partial<
						Omit<CreatorProfile, 'status'> &
							Omit<PortfolioProject, 'status'> &
							Omit<CreatorService, 'status'> &
							Omit<ProjectComment, 'status'>
					> & { status: string };
				const profile = r.creatorId ? await this.creators.findById(r.creatorId) : undefined;
				const ownerId = r.userId || profile?.userId;
				const owner = ownerId ? await this.users.findById(ownerId).select('displayName') : undefined;
				const project = r.projectId ? await this.projects.findById(r.projectId).select('title') : undefined;
				const key = {
					USERS: 'user',
					CREATORS: 'creator',
					PROJECTS: 'project',
					SERVICES: 'service',
					COMMENTS: 'comment',
				}[kind];
				return {
					_id: r._id,
					title: r.displayName || r.title || r.headline || r.slug || r.content,
					status: r.status,
					updatedAt: r.updatedAt,
					deletedAt: r.deletedAt,
					ownerName: owner?.displayName,
					projectTitle: project?.title,
					[key]: r,
				};
			}),
		);
		return { list, metaCounter: [{ total }] };
	}

	async overview(user: User) {
		this.authorize(user);
		const names = {
			users: 'User',
			creators: 'CreatorProfile',
			projects: 'PortfolioProject',
			services: 'CreatorService',
			comments: 'ProjectComment',
			categories: 'Category',
			events: 'CreativeEvent',
		};
		return Object.fromEntries(
			await Promise.all(
				Object.entries(names).map(async ([key, name]) => [
					key,
					await this.connection.model(name).countDocuments({ deletedAt: { $exists: false } }),
				]),
			),
		);
	}

	async siteContent() {
		return { ...siteDefaults, ...(await this.content.findOne({ key: 'public' }).lean()) };
	}

	async updateSiteContent(user: User, input: SiteContentInput) {
		this.authorize(user);
		check(
			input.homeHeading.trim() && input.homeSubheading.trim() && input.aboutText.trim() && input.footerCopy.trim(),
			'Headings, About text and footer copy cannot be empty',
		);
		return this.content.findOneAndUpdate(
			{ key: 'public' },
			{ $set: input },
			{ upsert: true, new: true, runValidators: true },
		);
	}

	// Serialize administrator account edits against the acting administrator's live role.
	private async lockAdmin(user: User, session: ClientSession) {
		const result = await this.users.updateOne(
			{ _id: user._id, status: UserStatus.ACTIVE, role: UserRole.ADMIN },
			{ $currentDate: { updatedAt: true } },
			{ session },
		);
		check(result.matchedCount, 'Administrator account unavailable');
	}

	async updateUser(user: User, id: string, input: AdminUserUpdateInput) {
		this.authorize(user);
		check(
			!sameId(user._id, id) || !input.role || input.role === UserRole.ADMIN,
			'You cannot remove your own administrator role',
		);
		return this.connection.transaction(async (session) => {
			await this.lockAdmin(user, session);
			const target = requireRecord(await this.users.findById(shapeIntoMongooseObjectId(id)).session(session));
			if (input.avatarUrl && input.avatarUrl !== target.avatarUrl)
				this.media.validate(input.avatarUrl, String(target._id));
			Object.assign(target, defined(input));
			return saveRevision(this.users, target, session);
		});
	}

	async userStatus(user: User, id: string, status: UserStatus) {
		this.authorize(user);
		check(!sameId(user._id, id), 'You cannot change your own account status');
		return this.connection.transaction(async (session) => {
			await this.lockAdmin(user, session);
			const target = requireRecord(await this.users.findById(shapeIntoMongooseObjectId(id)).session(session));
			target.status = status;
			target.deletedAt = status === UserStatus.DELETED ? new Date() : undefined;
			const saved = await saveRevision(this.users, target, session);
			if (status !== UserStatus.ACTIVE) await this.auth.revokeAll(target._id, session);
			return saved;
		});
	}

	async updateCreator(user: User, id: string, input: UpdateCreatorInput, status?: ProfileStatus) {
		this.authorize(user);
		return this.connection.transaction(async (session) => {
			const target = requireRecord(await this.creators.findById(shapeIntoMongooseObjectId(id)).session(session));
			Object.assign(target, defined(input));
			if (target.city)
				check(
					CITIES.some((c) => c.key === target.city),
					'Select a supported city',
				);
			await this.categories.validate(target.categoryIds, true);
			check(
				new Set(target.socialLinks.map((l) => new URL(l.url).href)).size === target.socialLinks.length,
				'Social links must be distinct',
			);
			if (status) {
				check(
					status !== ProfileStatus.DRAFT || target.status === ProfileStatus.DRAFT,
					'Published profiles cannot return to draft',
				);
				check(
					status !== ProfileStatus.HIDDEN || target.status !== ProfileStatus.DRAFT,
					'Publish the profile before hiding it',
				);
				target.status = status;
			}
			if (target.status === ProfileStatus.PUBLISHED) {
				check(
					!target.deletedAt && target.headline && target.city && target.categoryIds.length,
					'Publishing requires a retained profile, headline, city and category',
				);
				const owner = await this.users.updateOne(
					{ _id: target.userId, status: UserStatus.ACTIVE },
					{ $currentDate: { updatedAt: true } },
					{ session },
				);
				check(owner.matchedCount, 'Creator account unavailable');
				await this.users.updateOne(
					{ _id: target.userId, role: UserRole.USER },
					{ $set: { role: UserRole.CREATOR } },
					{ session },
				);
				target.publishedAt ??= new Date();
			}
			return saveRevision(this.creators, target, session);
		});
	}

	private async validateProject(target: PortfolioProject, original?: PortfolioProject) {
		const creator = requireRecord(await this.creators.findById(target.creatorId));
		if (target.categoryId) await this.categories.validate([target.categoryId], false);
		// Existing seeded media is retained. Every new URL must belong to the actual creator account.
		if (target.coverImageUrl && target.coverImageUrl !== original?.coverImageUrl)
			this.media.validate(target.coverImageUrl, String(creator.userId));
		check(
			new Set(target.media.map((m) => m.sortOrder)).size === target.media.length,
			'Media sort orders must be distinct',
		);
		for (const item of target.media) {
			if (!original?.media.some((m) => m.url === item.url && m.type === item.type))
				this.media.validate(item.url, String(creator.userId), item.type);
		}
		if (target.status === ProjectStatus.PUBLISHED) {
			check(
				!target.deletedAt && target.categoryId && target.description && target.coverImageUrl && target.media.length,
				'Publishing requires a category, description, cover image and media',
			);
			await this.categories.validate([target.categoryId]);
			await this.visibility.profile(target.creatorId);
		}
	}

	async createProject(user: User, creatorId: string, input: CreateProjectInput) {
		this.authorize(user);
		const creator = requireRecord(
			await this.creators.findOne({ _id: shapeIntoMongooseObjectId(creatorId), deletedAt: { $exists: false } }),
		);
		const target = new this.projects({ ...defined(input), creatorId: creator._id });
		await this.validateProject(target);
		return target.save();
	}

	async updateProject(user: User, id: string, input: AdminProjectUpdateInput, status?: ProjectStatus) {
		this.authorize(user);
		return this.connection.transaction(async (session) => {
			const target = requireRecord(await this.projects.findById(shapeIntoMongooseObjectId(id)).session(session));
			const original = target.toObject();
			Object.assign(target, defined(input));
			const first = status === ProjectStatus.PUBLISHED && !target.publishedAt;
			if (status) {
				check(
					status !== ProjectStatus.DRAFT || target.status === ProjectStatus.DRAFT,
					'Published projects cannot return to draft',
				);
				check(
					status !== ProjectStatus.ARCHIVED || target.status !== ProjectStatus.DRAFT,
					'Publish a project before archiving it',
				);
				target.status = status;
			}
			await this.validateProject(target, original);
			if (target.status === ProjectStatus.PUBLISHED) target.publishedAt ??= new Date();
			const saved = await saveRevision(this.projects, target, session);
			if (first) {
				await this.visibility.profile(target.creatorId, session);
				await this.activity.record(
					{
						performedById: user._id,
						creatorId: target.creatorId,
						projectId: target._id,
						type: ActivityEventType.PROJECT_PUBLISHED,
					},
					session,
				);
			}
			return saved;
		});
	}

	private async validateService(target: CreatorService) {
		if (target.categoryId) await this.categories.validate([target.categoryId], false);
		if (target.pricingType === PricingType.STARTING_AT)
			check(target.startingPrice !== undefined, 'A starting price is required');
		else check(target.startingPrice === undefined, 'Custom quotes cannot have a starting price');
		if (target.status === ServiceStatus.ACTIVE) {
			check(
				!target.deletedAt && target.categoryId && target.description && target.deliverables.length,
				'Activation requires a category, description and deliverables',
			);
			await this.categories.validate([target.categoryId]);
			await this.visibility.profile(target.creatorId);
		}
	}

	async createService(user: User, creatorId: string, input: CreateServiceInput) {
		this.authorize(user);
		const creator = requireRecord(
			await this.creators.findOne({ _id: shapeIntoMongooseObjectId(creatorId), deletedAt: { $exists: false } }),
		);
		const target = new this.services({ ...defined(input), creatorId: creator._id });
		await this.validateService(target);
		return target.save();
	}

	async updateService(user: User, id: string, input: UpdateServiceInput, status?: ServiceStatus) {
		this.authorize(user);
		const target = requireRecord(await this.services.findById(shapeIntoMongooseObjectId(id)));
		Object.assign(target, defined(input));
		if (input.pricingType === PricingType.CUSTOM_QUOTE && input.startingPrice === undefined)
			target.startingPrice = undefined;
		if (status) {
			const transitions = {
				DRAFT: ['DRAFT', 'ACTIVE'],
				ACTIVE: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
				PAUSED: ['PAUSED', 'ACTIVE', 'ARCHIVED'],
				ARCHIVED: ['ARCHIVED', 'ACTIVE'],
			};
			check(transitions[target.status].includes(status), 'Invalid service status transition');
			target.status = status;
		}
		await this.validateService(target);
		return saveRevision(this.services, target);
	}

	async removed(user: User, kind: AdminKind, id: string, removed: boolean) {
		this.authorize(user);
		check(
			[AdminKind.CREATORS, AdminKind.PROJECTS, AdminKind.SERVICES].includes(kind),
			'Use account status or comment moderation for this record',
		);
		const model = this.model(kind),
			record = requireRecord(await model.findById(shapeIntoMongooseObjectId(id)));
		record.deletedAt = removed ? new Date() : undefined;
		// Restoring never republishes previously removed content automatically.
		if (!removed)
			record.status =
				kind === AdminKind.CREATORS
					? record.publishedAt
						? ProfileStatus.HIDDEN
						: ProfileStatus.DRAFT
					: kind === AdminKind.PROJECTS
						? record.publishedAt
							? ProjectStatus.ARCHIVED
							: ProjectStatus.DRAFT
						: record.status === ServiceStatus.DRAFT
							? ServiceStatus.DRAFT
							: ServiceStatus.ARCHIVED;
		await saveRevision(model, record);
		return true;
	}
}
