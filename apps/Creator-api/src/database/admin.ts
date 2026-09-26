import { ConfigModule } from '@nestjs/config';
import { createConnection } from 'mongoose';
import { validateEnvironment } from '../libs/config';
import { User } from '../libs/dto/user/user';
import { AuthProvider, UserRole, UserStatus } from '../libs/enums/creatorhub.enum';
import AuthIdentitySchema from '../schemas/auth/AuthIdentity.model';
import UserSchema from '../schemas/user/User.model';

// An explicit operator command, never a public registration parameter.
async function grantAdmin() {
	const email = process.argv[2]?.trim().toLowerCase();
	if (!email || process.argv.length !== 3) throw new Error('Usage: npm run db:admin -- registered-email@example.com');
	await ConfigModule.forRoot();
	const environment = validateEnvironment(process.env);
	const connection = await createConnection(
		String(environment.NODE_ENV === 'production' ? environment.MONGO_PROD : environment.MONGO_DEV),
		{ autoIndex: false },
	).asPromise();
	try {
		const users = connection.model<User>('User', UserSchema);
		const identities = connection.model('AuthIdentity', AuthIdentitySchema);
		const identity = await identities.findOne({
			provider: AuthProvider.EMAIL,
			providerSubject: email,
			verifiedAt: { $exists: true },
			revokedAt: { $exists: false },
		});
		if (!identity) throw new Error('Register and verify an active email account first');
		const result = await users.updateOne(
			{ _id: identity.userId, status: UserStatus.ACTIVE },
			{ $set: { role: UserRole.ADMIN } },
		);
		if (!result.matchedCount)
			throw new Error('Register and verify an active account before granting administrator access');
		console.log('Administrator access granted.');
	} finally {
		await connection.close();
	}
}
grantAdmin().catch((error) => {
	console.error(error instanceof Error ? error.message : 'Administrator setup failed');
	process.exitCode = 1;
});
