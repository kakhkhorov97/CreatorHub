import { Schema } from 'mongoose';
import { Currency } from '../libs/enums/currency.enum';
import { PricingType } from '../libs/enums/pricing-type.enum';

const InquiryServiceSnapshotSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 150,
		},

		pricingType: {
			type: String,
			required: true,
			enum: Object.values(PricingType),
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
	},
	{ _id: false, strict: 'throw' },
);

export default InquiryServiceSnapshotSchema;
