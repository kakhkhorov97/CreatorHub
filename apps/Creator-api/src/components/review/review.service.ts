import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { ContentReview } from '../../libs/dto/review/content-review';
import { User } from '../../libs/dto/user/user';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { CreatorService } from '../../libs/dto/service/creator-service';
import { MutableEntity } from '../../libs/dto/common/entity';
import { CITIES } from '../../libs/dto/common/locations';
import { UserRole } from '../../libs/enums/user-role.enum';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';
import { MediaPolicy } from '../../libs/helpers/media-policy.service';
import { saveRevision } from '../../libs/helpers/save-revision';
import {
	check,
	requireActive,
	requireAdmin,
	requireRecord,
	shapeIntoMongooseObjectId,
	versionConflict,
} from '../../libs/helpers/policy';
import { CategoriesService } from '../category/category.service';
import { ActivityService } from '../activity/activity.service';

type Kind = 'PROFILE' | 'PROJECT' | 'SERVICE';

type ReviewTarget = Omit<CreatorProfile, 'status'> &
	Omit<PortfolioProject, 'status'> &
	Omit<CreatorService, 'status'> & { status: string };

const fields: Record<Kind, string[]> = {
	PROFILE: [
		'slug',
		'headline',
		'bio',
		'city',
		'remoteAvailable',
		'availability',
		'categoryIds',
		'skills',
		'socialLinks',
	],
	PROJECT: ['title', 'slug', 'summary', 'description', 'coverImageUrl', 'media', 'tags', 'externalUrl', 'categoryId'],
	SERVICE: [
		'title',
		'description',
		'pricingType',
		'startingPrice',
		'currency',
		'estimatedDays',
		'deliverables',
		'categoryId',
	],
};

@Injectable()
export class ReviewService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		@InjectModel('ContentReview') private readonly reviews: Model<ContentReview>,
		@InjectModel('CreatorProfile') private readonly profiles: Model<CreatorProfile>,
		@InjectModel('PortfolioProject') private readonly projects: Model<PortfolioProject>,
		@InjectModel('CreatorService') private readonly services: Model<CreatorService>,
		@InjectModel('User') private readonly users: Model<User>,
		private readonly categories: CategoriesService,
		private readonly media: MediaPolicy,
		private readonly activity: ActivityService,
	) {}

	async submit<T extends MutableEntity>(user: User, kind: Kind, original: T, candidate: T) {
		requireActive(user);
		const content = candidate as unknown as Record<string, unknown>;
		const snapshot = Object.fromEntries(fields[kind].map((key) => [key, content[key] ?? null]));
		// Serialize resubmissions with decisions and advance the revision even within one millisecond.
		await this.connection.transaction(async (session) => {
			const values = {
				kind,
				targetId: original._id,
				ownerId: user._id,
				title: content.title || content.headline || content.slug,
				snapshot,
				baseUpdatedAt: original.updatedAt,
				status: 'PENDING',
			};
			const review = await this.reviews.findOne({ kind, targetId: original._id }).session(session);
			if (review) {
				review.set(values);
				review.reason = undefined;
				review.set('reviewedById', undefined);
				await saveRevision(this.reviews, review, session);
			} else await this.reviews.create([values], { session });
		});
		return original;
	}

	async list(user: User, status?: string) {
		requireActive(user);
		if (status !== undefined) {
			requireAdmin(user);
			check(['PENDING', 'APPROVED', 'REJECTED'].includes(status), 'Unknown review status');
		}
		return this.reviews
			.find(status !== undefined ? { status } : { ownerId: user._id })
			.sort({ updatedAt: -1 })
			.limit(100);
	}

	async pendingCount(user: User) {
		requireActive(user);
		requireAdmin(user);
		return this.reviews.countDocuments({ status: 'PENDING' });
	}

	async decide(user: User, id: string, approve: boolean, revision: Date, reason?: string) {
		requireActive(user);
		requireAdmin(user);
		check(approve || !!reason?.trim(), 'Give the creator a reason for rejection');
		check(!reason || reason.length <= 1000, 'Keep the reason under 1000 characters');
		return this.connection.transaction(async (session) => {
			const review = requireRecord(
				await this.reviews.findOne({ _id: shapeIntoMongooseObjectId(id), status: 'PENDING' }).session(session),
			);
			if (review.updatedAt.getTime() !== revision.getTime()) versionConflict();
			if (approve) {
				const model =
					review.kind === 'PROFILE' ? this.profiles : review.kind === 'PROJECT' ? this.projects : this.services;
				const target = requireRecord(
					await (model as Model<ReviewTarget>)
						.findOne({ _id: review.targetId, deletedAt: { $exists: false } })
						.session(session),
				);
				if (target.updatedAt.getTime() !== review.baseUpdatedAt.getTime()) versionConflict();
				const owner = requireRecord(
					await this.users.findOne({ _id: review.ownerId, status: 'ACTIVE' }).session(session),
				);
				let profile: Pick<CreatorProfile, 'city'> = target;
				if (review.kind !== 'PROFILE') {
					profile = requireRecord(
						await this.profiles
							.findOne({ _id: target.creatorId, userId: owner._id, status: 'PUBLISHED', deletedAt: { $exists: false } })
							.session(session),
					);
				} else check(String(target.userId) === String(owner._id), 'Owner changed');
				const kind = review.kind as Kind;
				for (const key of fields[kind]) target.set(key, review.snapshot[key] ?? undefined);
				check(
					CITIES.some((city) => city.key === profile.city),
					'Choose a city in South Korea',
				);
				if (kind === 'PROFILE') {
					check(
						target.headline && target.city && target.categoryIds.length,
						'A headline, city and category are required',
					);
					await this.categories.validate(target.categoryIds);
					target.status = 'PUBLISHED';
					target.publishedAt ??= new Date();
					await this.users.updateOne(
						{ _id: owner._id, role: UserRole.USER },
						{ $set: { role: UserRole.CREATOR } },
						{ session },
					);
				} else {
					check(target.categoryId && target.description, 'A category and description are required');
					await this.categories.validate([target.categoryId]);
					if (kind === 'PROJECT') {
						check(target.coverImageUrl && target.media.length, 'A cover and media are required');
						this.media.validate(target.coverImageUrl, String(owner._id));
						this.media.portfolio(target.media, String(owner._id));
						target.status = 'PUBLISHED';
						const first = !target.publishedAt;
						target.publishedAt ??= new Date();
						if (first)
							await this.activity.record(
								{
									performedById: owner._id,
									creatorId: target.creatorId,
									projectId: target._id,
									type: ActivityEventType.PROJECT_PUBLISHED,
								},
								session,
							);
					} else {
						check(target.deliverables.length, 'Deliverables are required');
						check(target.pricingType !== 'STARTING_AT' || target.startingPrice != null, 'A starting price is required');
						check(
							target.pricingType !== 'CUSTOM_QUOTE' || target.startingPrice == null,
							'Custom quotes cannot have a starting price',
						);
						target.status = 'ACTIVE';
					}
				}
				await saveRevision(model as Model<ReviewTarget>, target, session);
			}
			review.status = approve ? 'APPROVED' : 'REJECTED';
			review.reason = approve ? undefined : reason?.trim();
			review.set('reviewedById', user._id);
			return saveRevision(this.reviews, review, session);
		});
	}
}
