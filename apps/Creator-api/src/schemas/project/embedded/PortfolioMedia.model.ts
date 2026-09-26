import { Schema } from 'mongoose';
import { MediaType } from '../../../libs/enums/creatorhub.enum';

const PortfolioMediaSchema = new Schema(
	{
		type: {
			type: String,
			required: true,
			enum: Object.values(MediaType),
		},

		url: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 2048,
		},

		altText: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 300,
		},

		sortOrder: {
			type: Number,
			required: true,
			min: 0,
			max: 19,
			validate: Number.isInteger,
		},
	},
	{ _id: false, strict: 'throw' },
);

export default PortfolioMediaSchema;
