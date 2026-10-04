import { Schema } from 'mongoose';

const InquiryMessageSchema = new Schema(
	{
		inquiryId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Inquiry',
			immutable: true,
		},

		senderId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		clientMessageKey: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 36,
		},

		body: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 5000,
		},

		readAt: {
			type: Date,
			required: false,
		},
	},
	{
		collection: 'inquiryMessages',
		timestamps: {
			createdAt: true,
			updatedAt: false,
		},

		strict: 'throw',
		versionKey: false,
	},
);

InquiryMessageSchema.index({ senderId: 1, clientMessageKey: 1 }, { name: 'uq_messages_sender_key', unique: true });

InquiryMessageSchema.index({ inquiryId: 1, createdAt: 1, _id: 1 }, { name: 'ix_messages_timeline' });

InquiryMessageSchema.index({ inquiryId: 1, readAt: 1, senderId: 1 }, { name: 'ix_messages_unread' });

export default InquiryMessageSchema;
