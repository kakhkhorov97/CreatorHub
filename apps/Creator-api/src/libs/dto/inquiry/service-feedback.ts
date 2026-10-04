import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { MutableEntity } from '../common/entity';
import { MetaCounter } from '../common/meta-counter';

@ObjectType()
export class ServiceFeedback extends MutableEntity {
	inquiryId!: Types.ObjectId;

	clientId!: Types.ObjectId;

	@Field(() => ID)
	creatorId!: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	serviceId?: Types.ObjectId;

	@Field(() => Int)
	rating!: number;

	@Field(() => String)
	feedback!: string;

	@Field(() => String)
	authorName!: string;
}

@ObjectType()
export class ServiceFeedbacks {
	@Field(() => [ServiceFeedback])
	list!: ServiceFeedback[];

	@Field(() => [MetaCounter])
	metaCounter!: MetaCounter[];
}
