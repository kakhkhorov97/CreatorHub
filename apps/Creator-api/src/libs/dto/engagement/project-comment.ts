import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { CommentStatus } from '../../enums/creatorhub.enum';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class ProjectComment extends MutableEntity {
	@Field(() => String)
	clientCommentKey!: string;
	@Field(() => ID)
	userId!: Types.ObjectId;

	@Field(() => ID)
	projectId!: Types.ObjectId;

	@Field(() => String)
	content!: string;

	@Field(() => CommentStatus)
	status!: CommentStatus;

	@Field(() => Date, { nullable: true })
	editedAt?: Date;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;
}
