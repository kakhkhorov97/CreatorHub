import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { Entity } from '../common/entity';

@ObjectType()
export class SavedProject extends Entity {
	@Field(() => ID)
	userId!: Types.ObjectId;

	@Field(() => ID)
	projectId!: Types.ObjectId;
}
