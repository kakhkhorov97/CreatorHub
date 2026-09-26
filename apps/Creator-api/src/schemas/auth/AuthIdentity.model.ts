import { Schema } from 'mongoose';
import { AuthProvider } from '../../libs/enums/creatorhub.enum';

const AuthIdentitySchema = new Schema(
	{
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
			immutable: true,
		},

		provider: {
			type: String,
			required: true,
			enum: Object.values(AuthProvider),
		},

		providerSubject: {
			type: String,
			required: true,
			trim: true,
			maxlength: 254,
		},

		passwordHash: {
			type: String,
			select: false,
			required: function () {
				return ['EMAIL', 'PHONE'].includes(this.provider);
			},
		},
		verifiedAt: {
			type: Date,
			required: false,
		},

		revokedAt: {
			type: Date,
			required: false,
		},

		lastLoginAt: {
			type: Date,
			required: false,
		},
	},
	{ collection: 'authIdentities', timestamps: true, strict: 'throw', versionKey: false },
);

AuthIdentitySchema.index({ provider: 1, providerSubject: 1 }, { unique: true, name: 'uq_identity_subject' });
AuthIdentitySchema.index({ userId: 1, provider: 1 }, { unique: true, name: 'uq_identity_user_provider' });

AuthIdentitySchema.pre('validate', function () {
	if (this.provider === AuthProvider.PHONE && this.verifiedAt)
		this.invalidate('verifiedAt', 'Phone registration does not verify ownership');
	if (![AuthProvider.EMAIL, AuthProvider.PHONE].includes(this.provider) && this.passwordHash)
		this.invalidate('passwordHash', 'Social identities have no local password');
});

export default AuthIdentitySchema;
