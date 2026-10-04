import { Schema } from 'mongoose';
import { ProjectStatus } from '../libs/enums/project-status.enum';
import PortfolioMediaSchema from './PortfolioMedia.model';

const PortfolioProjectSchema = new Schema(
	{
		creatorId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'CreatorProfile',
			immutable: true,
		},

		categoryId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'Category',
		},

		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 150,
		},

		slug: {
			type: String,
			required: true,
			trim: true,
			minlength: 3,
			maxlength: 100,
		},

		summary: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 300,
		},

		description: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 20000,
		},

		coverImageUrl: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 2048,
		},

		media: {
			type: [PortfolioMediaSchema],
			required: true,
			default: [],
		},

		tags: {
			type: [String],
			required: true,
			default: [],
		},

		externalUrl: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 2048,
		},

		status: {
			type: String,
			required: true,
			enum: Object.values(ProjectStatus),
			default: ProjectStatus.DRAFT,
		},

		publishedAt: {
			type: Date,
			required: false,
		},

		deletedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'portfolioProjects', timestamps: true, strict: 'throw', versionKey: false },
);

PortfolioProjectSchema.index({ creatorId: 1, slug: 1 }, { name: 'uq_projects_creator_slug', unique: true });

PortfolioProjectSchema.index({ status: 1, publishedAt: -1, _id: -1 }, { name: 'ix_projects_feed' });

PortfolioProjectSchema.index({ creatorId: 1, status: 1, publishedAt: -1, _id: -1 }, { name: 'ix_projects_creator' });

PortfolioProjectSchema.index({ categoryId: 1, status: 1, publishedAt: -1, _id: -1 }, { name: 'ix_projects_category' });

export default PortfolioProjectSchema;
