import { Schema } from 'mongoose';

const AuthSessionSchema = new Schema(
	{
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		authIdentityId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'AuthIdentity',
			immutable: true,
		},

		refreshTokenHash: {
			type: String,
			required: true,
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

		lastUsedAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'authSessions', timestamps: true, strict: 'throw', versionKey: false },
);

AuthSessionSchema.index({ refreshTokenHash: 1 }, { name: 'uq_sessions_token', unique: true });

AuthSessionSchema.index({ expiresAt: 1 }, { name: 'ttl_sessions_expiry', expireAfterSeconds: 0 });

AuthSessionSchema.index({ userId: 1, revokedAt: 1 }, { name: 'ix_sessions_user' });

AuthSessionSchema.index({ authIdentityId: 1, revokedAt: 1 }, { name: 'ix_sessions_identity' });

export default AuthSessionSchema;
