import { Schema } from 'mongoose';

export default new Schema(
	{
		kind: {
			type: String,
			enum: ['PROFILE', 'PROJECT', 'SERVICE'],
			required: true,
		},
		targetId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
		ownerId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		title: {
			type: String,
			required: true,
		},
		snapshot: {
			type: Schema.Types.Mixed,
			required: true,
		},
		baseUpdatedAt: {
			type: Date,
			required: true,
		},
		status: {
			type: String,
			enum: ['PENDING', 'APPROVED', 'REJECTED'],
			default: 'PENDING',
		},
		reason: {
			type: String,
			maxlength: 1000,
		},
		reviewedById: {
			type: Schema.Types.ObjectId,
			ref: 'User',
		},
	},
	{ collection: 'contentReviews', timestamps: true, versionKey: false },
).index({ kind: 1, targetId: 1 }, { unique: true, name: 'uq_review_target' });
