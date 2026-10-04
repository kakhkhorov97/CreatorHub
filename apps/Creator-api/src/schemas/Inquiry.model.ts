import { Schema } from 'mongoose';
import { Currency } from '../libs/enums/currency.enum';
import { InquiryOutcome } from '../libs/enums/inquiry-outcome.enum';
import { InquiryStatus } from '../libs/enums/inquiry-status.enum';
import InquiryServiceSnapshotSchema from './InquiryServiceSnapshot.model';

const InquirySchema = new Schema(
	{
		clientId: {
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

		serviceId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'CreatorService',
		},

		subject: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 150,
		},

		brief: {
			type: String,
			required: false,
			trim: true,
			minlength: 20,
			maxlength: 10000,
		},

		budgetMin: {
			type: Number,
			required: false,
			min: 0,
			max: 1000000000,
			validate: Number.isInteger,
		},

		budgetMax: {
			type: Number,
			required: false,
			min: 0,
			max: 1000000000,
			validate: Number.isInteger,
		},

		currency: {
			type: String,
			required: true,
			enum: Object.values(Currency),
			default: Currency.KRW,
		},

		desiredDeadline: {
			type: Date,
			required: false,
		},

		serviceSnapshot: {
			type: InquiryServiceSnapshotSchema,
			required: false,
		},

		status: {
			type: String,
			required: true,
			enum: Object.values(InquiryStatus),
			default: InquiryStatus.DRAFT,
		},

		outcome: {
			type: String,
			required: false,
			enum: Object.values(InquiryOutcome),
		},

		closedById: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'User',
		},

		closedAt: {
			type: Date,
			required: false,
		},

		submittedAt: {
			type: Date,
			required: false,
		},

		lastMessageAt: {
			type: Date,
			required: false,
		},

		version: {
			type: Number,
			required: true,
			min: 0,
			max: 9007199254740991,
			validate: Number.isInteger,
			default: 0,
		},
	},
	{ collection: 'inquiries', timestamps: true, strict: 'throw', versionKey: false },
);

InquirySchema.index({ clientId: 1, updatedAt: -1, _id: -1 }, { name: 'ix_inquiries_client' });

InquirySchema.index({ creatorId: 1, status: 1, updatedAt: -1, _id: -1 }, { name: 'ix_inquiries_creator' });

export default InquirySchema;
