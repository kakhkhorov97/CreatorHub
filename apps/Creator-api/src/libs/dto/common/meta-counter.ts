import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MetaCounter {
	@Field(() => Int)
	total!: number;
}
