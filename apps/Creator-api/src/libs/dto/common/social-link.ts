import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SocialLink {
	@Field(() => String)
	label!: string;

	@Field(() => String)
	url!: string;
}
