import { Schema } from 'mongoose';

const CreatorFollowSchema = new Schema(
	{
		followerId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		creatorId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'CreatorProfile',
			immutable: true,
		},

		isActive: {
			type: Boolean,
			required: true,
			default: true,
		},

		followedAt: {
			type: Date,
			required: true,
			default: Date.now,
		},
	},
	{ collection: 'creatorFollows', timestamps: true, strict: 'throw', versionKey: false },
);

CreatorFollowSchema.index({ followerId: 1, creatorId: 1 }, { unique: true, name: 'uq_creator_follow' });
CreatorFollowSchema.index({ creatorId: 1, isActive: 1, followerId: 1 }, { name: 'ix_creator_followers' });

CreatorFollowSchema.index({ followerId: 1, isActive: 1, followedAt: -1, _id: -1 }, { name: 'ix_follows_user_recent' });

export default CreatorFollowSchema;
