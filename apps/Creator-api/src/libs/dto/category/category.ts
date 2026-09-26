import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MutableEntity } from '../common/entity';

@ObjectType()
export class Category extends MutableEntity {
	@Field(() => String)
	slug!: string;

	@Field(() => String)
	name!: string;

	@Field(() => String, { nullable: true })
	description?: string;

	@Field(() => Int)
	sortOrder!: number;

	@Field(() => Boolean)
	isActive!: boolean;
}
