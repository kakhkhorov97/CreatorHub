import { Schema } from 'mongoose';
import { ActivityEventType, ActivityDeliveryStatus } from '../../libs/enums/creatorhub.enum';

const ActivityEventSchema = new Schema(
	{
		performedById: {
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

		type: {
			immutable: true,
			type: String,
			required: true,
			enum: Object.values(ActivityEventType),
		},

		projectId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'PortfolioProject',
			immutable: true,
		},

		commentId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'ProjectComment',
			immutable: true,
		},

		actionKey: {
			immutable: true,
			type: String,
			required: true,
			maxlength: 36,
		},

		deliveryStatus: {
			type: String,
			required: true,
			enum: Object.values(ActivityDeliveryStatus),
			default: ActivityDeliveryStatus.PENDING,
		},
		deliveryCursor: {
			type: String,
			required: false,
		},

		leaseUntil: {
			type: Date,
			required: false,
		},

		nextAttemptAt: {
			type: Date,
			required: true,
			default: Date.now,
		},

		attempts: {
			type: Number,
			required: true,
			default: 0,
			min: 0,
		},

		completedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'activityEvents', timestamps: true, strict: 'throw', versionKey: false },
);

ActivityEventSchema.index({ performedById: 1, actionKey: 1 }, { unique: true, name: 'uq_activity_performer_key' });
ActivityEventSchema.index(
	{ projectId: 1 },
	{ unique: true, partialFilterExpression: { type: 'PROJECT_PUBLISHED' }, name: 'uq_activity_publication' },
);
ActivityEventSchema.index(
	{ commentId: 1 },
	{ unique: true, partialFilterExpression: { type: 'PROJECT_COMMENTED' }, name: 'uq_activity_comment' },
);
ActivityEventSchema.index(
	{ deliveryStatus: 1, nextAttemptAt: 1, createdAt: 1, _id: 1 },
	{ name: 'ix_activity_delivery' },
);

ActivityEventSchema.index({ deliveryStatus: 1, leaseUntil: 1 }, { name: 'ix_activity_expired_lease' });

ActivityEventSchema.pre('validate', function () {
	if (this.type === ActivityEventType.CREATOR_FOLLOWED) {
		if (this.projectId || this.commentId) this.invalidate('projectId', 'Follow events have no project or comment');
	} else if (!this.projectId) this.invalidate('projectId', 'Project activity requires a project');
	if ((this.type === ActivityEventType.PROJECT_COMMENTED) !== Boolean(this.commentId))
		this.invalidate('commentId', 'Only comment activity has a comment');
	if ((this.deliveryStatus === ActivityDeliveryStatus.COMPLETE) !== Boolean(this.completedAt))
		this.invalidate('completedAt', 'Completion requires its timestamp');
});

export default ActivityEventSchema;
