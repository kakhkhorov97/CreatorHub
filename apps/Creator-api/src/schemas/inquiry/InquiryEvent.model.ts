import { Schema } from 'mongoose';
import { InquiryEventType, InquiryStatus } from '../../libs/enums/creatorhub.enum';

const InquiryEventSchema = new Schema(
	{
		inquiryId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Inquiry',
			immutable: true,
		},

		performedById: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		type: {
			type: String,
			required: true,
			enum: Object.values(InquiryEventType),
		},

		fromStatus: {
			type: String,
			required: true,
			enum: Object.values(InquiryStatus),
		},

		toStatus: {
			type: String,
			required: true,
			enum: Object.values(InquiryStatus),
		},

		messageId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'InquiryMessage',
			immutable: true,
		},

		version: {
			type: Number,
			required: true,
			min: 1,
			max: 9007199254740991,
			validate: Number.isInteger,
		},
	},
	{
		collection: 'inquiryEvents',
		timestamps: {
			createdAt: true,
			updatedAt: false,
		},

		strict: 'throw',
		versionKey: false,
	},
);

InquiryEventSchema.index({ inquiryId: 1, version: 1 }, { name: 'uq_events_inquiry_version', unique: true });
InquiryEventSchema.index(
	{ messageId: 1 },
	{ name: 'uq_events_message', unique: true, partialFilterExpression: { messageId: { $type: 'objectId' } } },
);

export default InquiryEventSchema;
