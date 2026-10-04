import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { MutableEntity } from '../common/entity';
import { AuthProvider } from '../../enums/auth-provider.enum';

@ObjectType()
export class AuthIdentity extends MutableEntity {
	@Field(() => ID)
	userId!: Types.ObjectId;

	@Field(() => AuthProvider)
	provider!: AuthProvider;

	@Field(() => String)
	providerSubject!: string;

	passwordHash?: string;

	@Field(() => Date, { nullable: true })
	verifiedAt?: Date;

	@Field(() => Date, { nullable: true })
	revokedAt?: Date;

	@Field(() => Date, { nullable: true })
	lastLoginAt?: Date;
}
