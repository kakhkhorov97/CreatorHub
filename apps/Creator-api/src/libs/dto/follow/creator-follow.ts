import { MetaCounter } from '../common/meta-counter';
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

@ObjectType()
export class Followings {
	@Field(() => [CreatorFollow])
	list!: CreatorFollow[];

	@Field(() => [MetaCounter])
	metaCounter!: MetaCounter[];
}

@ObjectType()
export class FollowerIdentity {
	@Field(() => ID)
	_id!: Types.ObjectId;

	@Field(() => String)
	displayName!: string;

	@Field(() => String, { nullable: true })
	avatarUrl?: string;
}

@ObjectType()
export class Followers {
	@Field(() => [FollowerIdentity])
	list!: FollowerIdentity[];

	@Field(() => [MetaCounter])
	metaCounter!: MetaCounter[];
}
