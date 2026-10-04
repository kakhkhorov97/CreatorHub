import { Schema } from 'mongoose';
import { CommentStatus } from '../libs/enums/comment-status.enum';

const ProjectCommentSchema = new Schema(
	{
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		projectId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'PortfolioProject',
			immutable: true,
		},

		clientCommentKey: {
			type: String,
			required: true,
			immutable: true,
			maxlength: 36,
		},

		content: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 2000,
		},

		status: {
			type: String,
			required: true,
			enum: Object.values(CommentStatus),
			default: CommentStatus.ACTIVE,
		},

		editedAt: {
			type: Date,
			required: false,
		},

		deletedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'projectComments', timestamps: true, strict: 'throw', versionKey: false },
);

ProjectCommentSchema.index({ projectId: 1, status: 1, createdAt: -1, _id: -1 }, { name: 'ix_comments_project' });

ProjectCommentSchema.index({ userId: 1, clientCommentKey: 1 }, { unique: true, name: 'uq_comment_request' });

export default ProjectCommentSchema;
