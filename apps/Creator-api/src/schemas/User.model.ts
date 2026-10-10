import { Schema } from 'mongoose';
import { Locale } from '../libs/enums/locale.enum';
import { UserRole } from '../libs/enums/user-role.enum';
import { UserStatus } from '../libs/enums/user-status.enum';

const UserSchema = new Schema(
	{
		displayName: {
			type: String,
			required: true,
			trim: true,
			minlength: 2,
			maxlength: 60,
		},

		phoneNumber: {
			type: String,
			required: false,
			select: false,
		},

		avatarUrl: {
			type: String,
			required: false,
			trim: true,
			minlength: 1,
			maxlength: 2048,
		},

		role: {
			type: String,
			required: true,
			enum: Object.values(UserRole),
			default: UserRole.USER,
		},

		status: {
			type: String,
			required: true,
			enum: Object.values(UserStatus),
			default: UserStatus.ACTIVE,
		},

		preferredLocale: {
			type: String,
			required: true,
			enum: Object.values(Locale),
			default: Locale.en,
		},

		lastLoginAt: {
			type: Date,
			required: false,
		},

		deletedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'users', timestamps: true, strict: 'throw', versionKey: false },
);

export default UserSchema;
