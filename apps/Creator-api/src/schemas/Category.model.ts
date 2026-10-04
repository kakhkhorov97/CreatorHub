import { Schema } from 'mongoose';

const CategorySchema = new Schema(
	{
		slug: {
			type: String,
			required: true,
			trim: true,
			minlength: 2,
			maxlength: 80,
		},

		name: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 80,
		},

		description: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 500,
		},

		sortOrder: {
			type: Number,
			required: true,
			min: 0,
			max: 10000,
			validate: Number.isInteger,
			default: 0,
		},

		isActive: {
			type: Boolean,
			required: true,
			default: true,
		},
	},
	{ collection: 'categories', timestamps: true, strict: 'throw', versionKey: false },
);

CategorySchema.index({ slug: 1 }, { name: 'uq_categories_slug', unique: true });

CategorySchema.index({ isActive: 1, sortOrder: 1, _id: 1 }, { name: 'ix_categories_active_order' });

export default CategorySchema;
