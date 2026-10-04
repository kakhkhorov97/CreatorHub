import { Schema } from 'mongoose';
import { EventStatus } from '../libs/enums/event-status.enum';

const CreativeEventSchema = new Schema(
	{
		title: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 160,
		},

		description: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 3000,
		},

		startsAt: {
			type: Date,
			required: true,
		},

		endsAt: {
			type: Date,
			required: true,
		},

		location: {
			type: String,
			required: true,
			trim: true,
			minlength: 1,
			maxlength: 200,
		},

		eventUrl: {
			type: String,
			trim: true,
			maxlength: 2000,
		},

		status: {
			type: String,
			enum: Object.values(EventStatus),
			required: true,
			default: EventStatus.DRAFT,
		},

		isDemo: {
			type: Boolean,
			required: true,
			default: false,
		},
	},
	{ collection: 'creativeEvents', timestamps: true, strict: 'throw', versionKey: false },
);

CreativeEventSchema.index({ status: 1, endsAt: 1, startsAt: 1 }, { name: 'ix_events_public_dates' });

export default CreativeEventSchema;
