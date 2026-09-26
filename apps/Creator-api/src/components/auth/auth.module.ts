import AuthIdentitySchema from '../../schemas/auth/AuthIdentity.model';
import { SocialAuthService } from './social-auth.service';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import AuthSessionSchema from '../../schemas/auth/AuthSession.model';
import AuthTokenSchema from '../../schemas/auth/AuthToken.model';
import UserSchema from '../../schemas/user/User.model';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { MailService } from './mail.service';

@Module({
	imports: [
		MongooseModule.forFeature([
			{ name: 'AuthIdentity', schema: AuthIdentitySchema },
			{ name: 'User', schema: UserSchema },
			{ name: 'AuthSession', schema: AuthSessionSchema },
			{ name: 'AuthToken', schema: AuthTokenSchema },
		]),
		JwtModule.registerAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				secret: config.getOrThrow<string>('JWT_SECRET'),
				signOptions: { expiresIn: '15m', issuer: 'creatorhub', audience: 'creatorhub-web', algorithm: 'HS256' },
				verifyOptions: { issuer: 'creatorhub', audience: 'creatorhub-web', algorithms: ['HS256'] },
			}),
		}),
	],
	providers: [SocialAuthService, AuthService, AuthGuard, AuthResolver, MailService],
	exports: [AuthService, AuthGuard],
})
export class AuthModule {}
