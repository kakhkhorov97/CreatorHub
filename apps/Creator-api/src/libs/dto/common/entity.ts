import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';

@ObjectType({ isAbstract: true })
export abstract class Entity {
	@Field(() => ID)
	_id!: Types.ObjectId;

	@Field()
	createdAt!: Date;
}

@ObjectType({ isAbstract: true })
export abstract class MutableEntity extends Entity {
	@Field()
	updatedAt!: Date;
}
