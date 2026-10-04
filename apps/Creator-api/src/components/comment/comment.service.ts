import { ActivityService } from '../activity/activity.service';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CommentInput } from '../../libs/dto/comment/comment.input';
import { EditCommentInput } from '../../libs/dto/comment/comment.update';
import { ProjectComment } from '../../libs/dto/comment/project-comment';

import { User } from '../../libs/dto/user/user';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';
import { CommentStatus } from '../../libs/enums/comment-status.enum';
import {
	check,
	duplicateKey,
	shapeIntoMongooseObjectId,
	page,
	requireAdmin,
	requireRecord,
	requireActive,
	sameId,
} from '../../libs/helpers/policy';
import { saveRevision } from '../../libs/helpers/save-revision';

import { ProjectService } from '../project/project.service';

@Injectable()
export class CommentService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		private readonly activity: ActivityService,
		@InjectModel('ProjectComment') private readonly commentModel: Model<ProjectComment>,
		private readonly projects: ProjectService,
	) {}

	public async getComments(projectId: string, input: PageInput) {
		await this.projects.getProject(projectId);
		const { offset, limit } = page(input);
		const query = this.commentModel.find({
			projectId: shapeIntoMongooseObjectId(projectId),
			status: CommentStatus.ACTIVE,
		});
		const [list, total] = await Promise.all([
			query.clone().sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list, metaCounter: total ? [{ total }] : [] };
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
				_id: shapeIntoMongooseObjectId(id),
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
		const comment = requireRecord(
			await this.commentModel.findOne({ _id: shapeIntoMongooseObjectId(id), userId: currentUser._id }),
		);
		if (comment.status === CommentStatus.DELETED) return true;
		comment.status = CommentStatus.DELETED;
		comment.deletedAt = new Date();
		await saveRevision(this.commentModel, comment);
		return true;
	}

	public async moderateComment(currentUser: User, id: string, hidden: boolean) {
		requireAdmin(currentUser);
		const comment = requireRecord(
			await this.commentModel.findOne({ _id: shapeIntoMongooseObjectId(id), status: { $ne: CommentStatus.DELETED } }),
		);
		comment.status = hidden ? CommentStatus.HIDDEN : CommentStatus.ACTIVE;
		return saveRevision(this.commentModel, comment);
	}
}
