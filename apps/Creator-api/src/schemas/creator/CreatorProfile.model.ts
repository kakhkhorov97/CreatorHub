import { Schema } from 'mongoose';
import { CreatorAvailability, ProfileStatus } from '../../libs/enums/creatorhub.enum';
import SocialLinkSchema from './embedded/SocialLink.model';

const CreatorProfileSchema = new Schema(
	{
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		slug: {
			type: String,
			required: true,
			trim: true,
			minlength: 3,
			maxlength: 80,
		},

		headline: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 120,
		},

		bio: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 3000,
		},

		city: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 80,
		},

		remoteAvailable: {
			type: Boolean,
			required: true,
			default: false,
		},

		availability: {
			type: String,
			required: true,
			enum: Object.values(CreatorAvailability),
			default: CreatorAvailability.AVAILABLE,
		},

		categoryIds: {
			type: [Schema.Types.ObjectId],
			required: true,
			default: [],
			ref: 'Category',
		},

		skills: {
			type: [String],
			required: true,
			default: [],
		},

		socialLinks: {
			type: [SocialLinkSchema],
			required: true,
			default: [],
		},

		status: {
			type: String,
			required: true,
			enum: Object.values(ProfileStatus),
			default: ProfileStatus.DRAFT,
		},

		publishedAt: {
			type: Date,
			required: false,
		},

		deletedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'creatorProfiles', timestamps: true, strict: 'throw', versionKey: false },
);

CreatorProfileSchema.index({ userId: 1 }, { name: 'uq_profiles_user', unique: true });
CreatorProfileSchema.index({ slug: 1 }, { name: 'uq_profiles_slug', unique: true });
CreatorProfileSchema.index(
	{ status: 1, categoryIds: 1, city: 1, remoteAvailable: 1 },
	{ name: 'ix_profiles_discovery' },
);
CreatorProfileSchema.index({ status: 1, city: 1, remoteAvailable: 1 }, { name: 'ix_profiles_city' });

export default CreatorProfileSchema;
