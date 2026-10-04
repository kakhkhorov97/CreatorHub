import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class ContentReview extends MutableEntity {
	@Field() kind!: string;

	@Field(() => ID) targetId!: Types.ObjectId;

	@Field(() => ID) ownerId!: Types.ObjectId;

	@Field() title!: string;

	@Field() status!: string;

	@Field({ nullable: true }) reason?: string;

	@Field() baseUpdatedAt!: Date;

	snapshot!: Record<string, unknown>;

	// Available only through authenticated owner/admin review queries.
	@Field() preview!: string;
}
