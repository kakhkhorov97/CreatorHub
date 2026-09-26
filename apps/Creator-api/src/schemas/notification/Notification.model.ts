import { Schema } from 'mongoose';

const NotificationSchema = new Schema(
	{
		recipientId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		inquiryEventId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'InquiryEvent',
			immutable: true,
		},

		activityEventId: {
			type: Schema.Types.ObjectId,
			ref: 'ActivityEvent',
			immutable: true,
		},

		readAt: {
			type: Date,
			required: false,
		},
	},
	{
		collection: 'notifications',
		timestamps: {
			createdAt: true,
			updatedAt: false,
		},

		strict: 'throw',
		versionKey: false,
	},
);

NotificationSchema.index(
	{ inquiryEventId: 1 },
	{ unique: true, name: 'uq_notification_inquiry', partialFilterExpression: { inquiryEventId: { $type: 'objectId' } } },
);
NotificationSchema.index(
	{ recipientId: 1, activityEventId: 1 },
	{
		unique: true,
		name: 'uq_notification_activity',
		partialFilterExpression: { activityEventId: { $type: 'objectId' } },
	},
);
NotificationSchema.pre('validate', function () {
	if (Boolean(this.inquiryEventId) === Boolean(this.activityEventId))
		this.invalidate('inquiryEventId', 'Choose exactly one notification source');
});
NotificationSchema.index({ recipientId: 1, createdAt: -1, _id: -1 }, { name: 'ix_notifications_inbox' });
NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1, _id: -1 }, { name: 'ix_notifications_unread' });

export default NotificationSchema;
