import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class CreatorFollow extends MutableEntity {
	@Field(() => ID)
	followerId!: Types.ObjectId;

	@Field(() => ID)
	creatorId!: Types.ObjectId;

	@Field(() => Boolean)
	isActive!: boolean;

	@Field(() => Date)
	followedAt!: Date;
}
