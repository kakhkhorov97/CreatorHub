import { Schema } from 'mongoose';
import { Currency, PricingType, ServiceStatus } from '../../libs/enums/creatorhub.enum';

const CreatorServiceSchema = new Schema(
	{
		creatorId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'CreatorProfile',
			immutable: true,
		},

		categoryId: {
			type: Schema.Types.ObjectId,
			required: false,
			ref: 'Category',
		},

		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 150,
		},

		description: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 10000,
		},

		pricingType: {
			type: String,
			required: true,
			enum: Object.values(PricingType),
			default: PricingType.CUSTOM_QUOTE,
		},

		startingPrice: {
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

		estimatedDays: {
			type: Number,
			required: false,
			min: 1,
			max: 365,
			validate: Number.isInteger,
		},

		deliverables: {
			type: [String],
			required: true,
			default: [],
		},

		status: {
			type: String,
			required: true,
			enum: Object.values(ServiceStatus),
			default: ServiceStatus.DRAFT,
		},

		deletedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'services', timestamps: true, strict: 'throw', versionKey: false },
);

CreatorServiceSchema.index({ creatorId: 1, status: 1, _id: 1 }, { name: 'ix_services_creator' });
CreatorServiceSchema.index({ categoryId: 1, status: 1, _id: 1 }, { name: 'ix_services_category' });

export default CreatorServiceSchema;
