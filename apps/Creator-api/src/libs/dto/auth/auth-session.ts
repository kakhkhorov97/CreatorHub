import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class AuthSession extends MutableEntity {
	@Field(() => ID)
	userId!: Types.ObjectId;

	@Field(() => ID)
	authIdentityId!: Types.ObjectId;

	refreshTokenHash!: string;

	@Field(() => Date)
	expiresAt!: Date;

	@Field(() => Date, { nullable: true })
	revokedAt?: Date;

	@Field(() => Date, { nullable: true })
	lastUsedAt?: Date;
}
