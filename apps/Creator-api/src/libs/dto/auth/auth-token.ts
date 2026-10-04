import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { AuthTokenPurpose } from '../../enums/auth-token-purpose.enum';
import { Entity } from '../common/entity';

@ObjectType()
export class AuthToken extends Entity {
	@Field(() => ID)
	authIdentityId!: Types.ObjectId;

	@Field(() => AuthTokenPurpose)
	purpose!: AuthTokenPurpose;

	tokenHash!: string;

	@Field(() => Date)
	expiresAt!: Date;

	@Field(() => Date, { nullable: true })
	revokedAt?: Date;

	@Field(() => Date, { nullable: true })
	consumedAt?: Date;
}
