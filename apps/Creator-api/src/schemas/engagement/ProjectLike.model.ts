import { Schema } from 'mongoose';

const ProjectLikeSchema = new Schema(
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
	},
	{ collection: 'projectLikes', timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false },
);

ProjectLikeSchema.index({ userId: 1, projectId: 1 }, { name: 'uq_likes_user_project', unique: true });
ProjectLikeSchema.index({ projectId: 1 }, { name: 'ix_likes_project' });

export default ProjectLikeSchema;
