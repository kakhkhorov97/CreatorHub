import { Schema } from 'mongoose';
import { AuthTokenPurpose } from '../libs/enums/auth-token-purpose.enum';

const AuthTokenSchema = new Schema(
	{
		authIdentityId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'AuthIdentity',
			immutable: true,
		},

		purpose: {
			type: String,
			required: true,
			enum: Object.values(AuthTokenPurpose),
		},

		tokenHash: {
			type: String,
			required: true,
			select: false,
		},

		previousEmail: {
			type: String,
			maxlength: 254,
			select: false,
		},

		replacementEmail: {
			type: String,
			maxlength: 254,
			select: false,
		},

		expiresAt: {
			type: Date,
			required: true,
		},

		revokedAt: {
			type: Date,
			required: false,
		},

		consumedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'authTokens', timestamps: { createdAt: true, updatedAt: false }, strict: 'throw', versionKey: false },
);

AuthTokenSchema.index({ tokenHash: 1 }, { name: 'uq_tokens_hash', unique: true });

AuthTokenSchema.index({ expiresAt: 1 }, { name: 'ttl_tokens_expiry', expireAfterSeconds: 0 });

AuthTokenSchema.index({ authIdentityId: 1, purpose: 1 }, { name: 'ix_tokens_user_purpose' });

export default AuthTokenSchema;
