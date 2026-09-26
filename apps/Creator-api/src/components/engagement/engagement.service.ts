import { CreatorFollow } from '../../libs/dto/engagement/creator-follow';
import { ActivityService } from '../activity/activity.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CommentInput, EditCommentInput } from '../../libs/dto/engagement/engagement.input';
import { ProjectComment } from '../../libs/dto/engagement/project-comment';
import { ProjectLike } from '../../libs/dto/engagement/project-like';
import { SavedProject } from '../../libs/dto/engagement/saved-project';
import { User } from '../../libs/dto/user/user';
import { ActivityEventType, CommentStatus } from '../../libs/enums/creatorhub.enum';
import {
	check,
	duplicateKey,
	objectId,
	page,
	requireAdmin,
	requireRecord,
	requireActive,
	sameId,
} from '../../libs/utils/policy';
import { saveRevision } from '../../libs/utils/save-revision';
import { VisibilityService } from '../creator/visibility.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class EngagementService {
	constructor(
		@InjectModel('CreatorFollow') private readonly follows: Model<CreatorFollow>,
		@InjectConnection() private readonly connection: Connection,
		private readonly activity: ActivityService,
		@InjectModel('ProjectLike') private readonly likeModel: Model<ProjectLike>,
		@InjectModel('SavedProject') private readonly saveModel: Model<SavedProject>,
		@InjectModel('ProjectComment') private readonly commentModel: Model<ProjectComment>,
		private readonly projects: ProjectService,
		private readonly visibility: VisibilityService,
	) {}

	public async setLike(currentUser: User, projectId: string, liked: boolean) {
		requireActive(currentUser);
		const key = { userId: currentUser._id, projectId: objectId(projectId) };
		if (!liked) {
			await this.likeModel.deleteOne(key);
			return false;
		}
		const project = await this.projects.getProject(projectId);
		const creator = await this.visibility.profile(project.creatorId);
		check(!sameId(creator.userId, currentUser._id), 'You cannot like your own project');
		try {
			await this.connection.transaction(async (session) => {
				const result = await this.likeModel.updateOne(key, { $setOnInsert: key }, { upsert: true, session });
				if (result.upsertedCount)
					await this.activity.record(
						{
							performedById: currentUser._id,
							creatorId: creator._id,
							projectId: project._id,
							type: ActivityEventType.PROJECT_LIKED,
						},
						session,
					);
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
		}
		return true;
	}

	public async setFollow(currentUser: User, id: string, following: boolean) {
		requireActive(currentUser);
		const key = { followerId: currentUser._id, creatorId: objectId(id) };
		if (!following) {
			await this.follows.updateOne(key, { $set: { isActive: false } });
			return false;
		}
		const creator = await this.visibility.profile(key.creatorId);
		check(!sameId(creator.userId, currentUser._id), 'You cannot follow yourself');
		try {
			await this.connection.transaction(async (session) => {
				let follow = await this.follows.findOne(key).session(session);
				if (follow?.isActive) return;
				if (follow) {
					follow.isActive = true;
					follow.followedAt = new Date();
					await follow.save({ session });
				} else {
					[follow] = await this.follows.create([key], { session });
				}
				await this.activity.record(
					{ performedById: currentUser._id, creatorId: creator._id, type: ActivityEventType.CREATOR_FOLLOWED },
					session,
				);
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
		}
		return true;
	}

	public async getMyFollows(currentUser: User, input: PageInput) {
		const { offset, limit } = page(input);
		return this.follows
			.find({ followerId: currentUser._id, isActive: true })
			.sort({ followedAt: -1, _id: -1 })
			.skip(offset)
			.limit(limit);
	}

	public async setSave(currentUser: User, projectId: string, saved: boolean) {
		requireActive(currentUser);
		const key = { userId: currentUser._id, projectId: objectId(projectId) };
		if (!saved) {
			await this.saveModel.deleteOne(key);
			return false;
		}
		await this.projects.getProject(projectId);
		try {
			await this.saveModel.updateOne(key, { $setOnInsert: key }, { upsert: true });
		} catch (error) {
			if (!duplicateKey(error)) throw error;
		}
		return true;
	}

	public async getSavedProjects(currentUser: User, input: PageInput) {
		const { offset, limit } = page(input);
		const saved = await this.saveModel
			.find({ userId: currentUser._id })
			.sort({ createdAt: -1, _id: -1 })
			.skip(offset)
			.limit(limit);
		return Promise.all(
			saved.map(async (item) => {
				try {
					return {
						savedAt: item.createdAt,
						projectId: item.projectId,
						project: await this.projects.getProject(String(item.projectId)),
						available: true,
					};
				} catch (error) {
					if (!(error instanceof NotFoundException)) throw error;
					return { savedAt: item.createdAt, projectId: item.projectId, available: false };
				}
			}),
		);
	}

	public async getComments(projectId: string, input: PageInput) {
		await this.projects.getProject(projectId);
		const { offset, limit } = page(input);
		return this.commentModel
			.find({ projectId: objectId(projectId), status: CommentStatus.ACTIVE })
			.sort({ createdAt: -1, _id: -1 })
			.skip(offset)
			.limit(limit);
	}

	public async getLikeCount(projectId: string) {
		await this.projects.getProject(projectId);
		return this.likeModel.countDocuments({ projectId: objectId(projectId) });
	}

	private matchComment(comment: ProjectComment & { clientCommentKey: string }, input: CommentInput) {
		check(
			sameId(comment.projectId, input.projectId) && comment.content === input.content,
			'This comment key was used for different content',
		);
		return comment;
	}

	public async createComment(currentUser: User, input: CommentInput) {
		requireActive(currentUser);
		const project = await this.projects.getProject(input.projectId);
		const key = { userId: currentUser._id, clientCommentKey: input.clientCommentKey };
		try {
			return await this.connection.transaction(async (session) => {
				const previous = await this.commentModel.findOne(key).session(session);
				if (previous) return this.matchComment(previous, input);
				const [comment] = await this.commentModel.create([{ ...key, projectId: project._id, content: input.content }], {
					session,
				});
				await this.activity.record(
					{
						performedById: currentUser._id,
						creatorId: project.creatorId,
						projectId: project._id,
						commentId: comment._id,
						type: ActivityEventType.PROJECT_COMMENTED,
						actionKey: input.clientCommentKey,
					},
					session,
				);
				return comment;
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
			return this.matchComment(requireRecord(await this.commentModel.findOne(key)), input);
		}
	}

	public async editComment(currentUser: User, id: string, input: EditCommentInput) {
		requireActive(currentUser);
		const comment = requireRecord(
			await this.commentModel.findOne({
				_id: objectId(id),
				userId: currentUser._id,
				status: { $ne: CommentStatus.DELETED },
			}),
		);
		comment.content = input.content;
		comment.editedAt = new Date();
		return saveRevision(this.commentModel, comment);
	}

	public async deleteComment(currentUser: User, id: string) {
		requireActive(currentUser);
		const comment = requireRecord(await this.commentModel.findOne({ _id: objectId(id), userId: currentUser._id }));
		if (comment.status === CommentStatus.DELETED) return true;
		comment.status = CommentStatus.DELETED;
		comment.deletedAt = new Date();
		await saveRevision(this.commentModel, comment);
		return true;
	}

	public async moderateComment(currentUser: User, id: string, hidden: boolean) {
		requireAdmin(currentUser);
		const comment = requireRecord(
			await this.commentModel.findOne({ _id: objectId(id), status: { $ne: CommentStatus.DELETED } }),
		);
		comment.status = hidden ? CommentStatus.HIDDEN : CommentStatus.ACTIVE;
		return saveRevision(this.commentModel, comment);
	}
}
