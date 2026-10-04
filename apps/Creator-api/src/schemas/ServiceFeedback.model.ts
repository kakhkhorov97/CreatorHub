import { Schema } from 'mongoose';

const ServiceFeedbackSchema = new Schema(
	{
		inquiryId: { type: Schema.Types.ObjectId, ref: 'Inquiry', required: true, immutable: true },
		clientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
		creatorId: { type: Schema.Types.ObjectId, ref: 'CreatorProfile', required: true, immutable: true },
		serviceId: { type: Schema.Types.ObjectId, ref: 'CreatorService', required: false, immutable: true },
		rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
		feedback: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
	},
	{ collection: 'serviceFeedback', timestamps: true, strict: 'throw', versionKey: false },
);

ServiceFeedbackSchema.index({ inquiryId: 1 }, { unique: true, name: 'uq_feedback_inquiry' });
ServiceFeedbackSchema.index({ creatorId: 1, createdAt: -1, _id: -1 }, { name: 'ix_feedback_creator' });

export default ServiceFeedbackSchema;
