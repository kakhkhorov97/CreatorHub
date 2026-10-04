import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'node:crypto';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { ActivityEvent } from '../../libs/dto/notification/activity-event';
import { CreatorFollow } from '../../libs/dto/follow/creator-follow';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { PortfolioProject } from '../../libs/dto/project/portfolio-project';
import { ProjectComment } from '../../libs/dto/comment/project-comment';
import { ProjectLike } from '../../libs/dto/like/project-like';
import { Notification } from '../../libs/dto/notification/notification';
import { User } from '../../libs/dto/user/user';
import { ActivityDeliveryStatus } from '../../libs/enums/activity-delivery-status.enum';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';
import { CommentStatus } from '../../libs/enums/comment-status.enum';
import { ProfileStatus } from '../../libs/enums/profile-status.enum';
import { ProjectStatus } from '../../libs/enums/project-status.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';

@Injectable()
export class ActivityService {
	private readonly logger = new Logger(ActivityService.name);

	private running = false;

	constructor(
		@InjectConnection() private readonly connection: Connection,
		@InjectModel('ProjectLike') private readonly likes: Model<ProjectLike>,
		@InjectModel('ActivityEvent') private readonly events: Model<ActivityEvent>,
		@InjectModel('CreatorFollow') private readonly follows: Model<CreatorFollow>,
		@InjectModel('CreatorProfile') private readonly creators: Model<CreatorProfile>,
		@InjectModel('PortfolioProject') private readonly projects: Model<PortfolioProject>,
		@InjectModel('ProjectComment') private readonly comments: Model<ProjectComment>,
		@InjectModel('Notification') private readonly notifications: Model<Notification>,
		@InjectModel('User') private readonly users: Model<User>,
	) {}

	public async record(
		input: {
			performedById: Types.ObjectId;
			creatorId: Types.ObjectId;
			type: ActivityEventType;
			projectId?: Types.ObjectId;
			commentId?: Types.ObjectId;
			actionKey?: string;
		},
		session: ClientSession,
	) {
		const [event] = await this.events.create([{ ...input, actionKey: input.actionKey ?? randomUUID() }], { session });
		return event;
	}

	public async visible(event: ActivityEvent, session: ClientSession | null = null) {
		const creator = await this.creators
			.findOne({
				_id: event.creatorId,
				status: ProfileStatus.PUBLISHED,
				deletedAt: { $exists: false },
			})
			.session(session);
		if (!creator || !(await this.users.exists({ _id: creator.userId, status: UserStatus.ACTIVE }).session(session)))
			return null;
		if (event.type !== ActivityEventType.CREATOR_FOLLOWED) {
			if (
				!(await this.projects
					.exists({
						_id: event.projectId,
						creatorId: creator._id,
						status: ProjectStatus.PUBLISHED,
						deletedAt: { $exists: false },
					})
					.session(session))
			)
				return null;
		}
		if (
			event.type === ActivityEventType.PROJECT_COMMENTED &&
			!(await this.comments
				.exists({ _id: event.commentId, projectId: event.projectId, status: CommentStatus.ACTIVE })
				.session(session))
		)
			return null;
		return creator;
	}

	public async deliverPending() {
		if (this.running) return;
		this.running = true;
		try {
			// Bound each polling pass. Progress and leases remain in MongoDB after a restart.
			for (let count = 0; count < 20; count++) {
				const now = new Date();
				const leaseUntil = new Date(now.getTime() + 60000);
				const event = await this.events.findOneAndUpdate(
					{
						deliveryStatus: { $ne: ActivityDeliveryStatus.COMPLETE },
						nextAttemptAt: { $lte: now },
						$or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }],
					},
					{ $set: { deliveryStatus: ActivityDeliveryStatus.PROCESSING, leaseUntil }, $inc: { attempts: 1 } },
					{ new: true, sort: { createdAt: 1, _id: 1 } },
				);
				if (!event) break;
				try {
					const previousCursor = event.deliveryCursor;
					await this.connection.transaction(async (session) => {
						event.deliveryCursor = previousCursor;
						// Fence this batch before writes. A competing lease must cause a retry, not stale delivery.
						const renewed = new Date(Date.now() + 60000);
						const owned = await this.events.updateOne(
							{ _id: event._id, leaseUntil },
							{ $set: { leaseUntil: renewed } },
							{ session },
						);
						if (!owned.matchedCount) return;
						const complete = await this.deliver(event, session);
						await this.events.updateOne(
							{ _id: event._id, leaseUntil: renewed },
							{
								$set: complete
									? { deliveryStatus: ActivityDeliveryStatus.COMPLETE, completedAt: new Date() }
									: { deliveryStatus: ActivityDeliveryStatus.PENDING, deliveryCursor: event.deliveryCursor },
								$unset: { leaseUntil: 1 },
							},
							{ session },
						);
					});
				} catch {
					await this.events.updateOne(
						{ _id: event._id, leaseUntil },
						{
							$set: { deliveryStatus: ActivityDeliveryStatus.PENDING, nextAttemptAt: new Date(Date.now() + 30000) },
							$unset: { leaseUntil: 1 },
						},
					);
					this.logger.warn('An activity notification will be retried');
				}
			}
		} finally {
			this.running = false;
		}
	}

	private async notify(event: ActivityEvent, recipientId: Types.ObjectId, session: ClientSession) {
		if (
			String(recipientId) === String(event.performedById) ||
			!(await this.users.exists({ _id: recipientId, status: UserStatus.ACTIVE }).session(session)) ||
			!(await this.visible(event, session))
		)
			return;
		await this.notifications.updateOne(
			{ recipientId, activityEventId: event._id },
			{ $setOnInsert: { recipientId, activityEventId: event._id } },
			{ upsert: true, session },
		);
	}

	private async deliver(event: ActivityEvent, session: ClientSession) {
		const creator = await this.visible(event, session);
		if (!creator) return true;
		if (event.type !== ActivityEventType.PROJECT_PUBLISHED) {
			if (
				event.type === ActivityEventType.PROJECT_LIKED &&
				!(await this.likes.exists({ userId: event.performedById, projectId: event.projectId }).session(session))
			)
				return true;
			if (
				event.type === ActivityEventType.CREATOR_FOLLOWED &&
				!(await this.follows
					.exists({
						followerId: event.performedById,
						creatorId: event.creatorId,
						isActive: true,
						followedAt: { $lte: event.createdAt },
					})
					.session(session))
			)
				return true;
			await this.notify(event, creator.userId, session);
			return true;
		}
		const followers = await this.follows
			.find({
				creatorId: event.creatorId,
				isActive: true,
				followedAt: { $lt: event.createdAt },
				...(event.deliveryCursor ? { followerId: { $gt: new Types.ObjectId(event.deliveryCursor) } } : {}),
			})
			.sort({ followerId: 1 })
			.limit(100)
			.session(session);
		for (const follow of followers) {
			// Recheck an unfollow or re-follow that happened during this delivery pass.
			if (
				await this.follows
					.exists({ _id: follow._id, isActive: true, followedAt: { $lt: event.createdAt } })
					.session(session)
			)
				await this.notify(event, follow.followerId, session);
		}
		if (followers.length) event.deliveryCursor = String(followers[followers.length - 1].followerId);
		return followers.length < 100;
	}
}
