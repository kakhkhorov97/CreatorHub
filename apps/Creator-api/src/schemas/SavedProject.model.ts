import { Schema } from 'mongoose';

const SavedProjectSchema = new Schema(
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
	{
		collection: 'savedProjects',
		timestamps: {
			createdAt: true,
			updatedAt: false,
		},

		strict: 'throw',
		versionKey: false,
	},
);

SavedProjectSchema.index({ userId: 1, projectId: 1 }, { name: 'uq_saves_user_project', unique: true });

SavedProjectSchema.index({ userId: 1, createdAt: -1, _id: -1 }, { name: 'ix_saves_user_recent' });

export default SavedProjectSchema;
