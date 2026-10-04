import { Schema } from 'mongoose';

const SocialLinkSchema = new Schema(
	{
		label: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 40,
		},

		url: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 2048,
		},
	},
	{ _id: false, strict: 'throw' },
);

export default SocialLinkSchema;
