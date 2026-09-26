import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CreatorIdentity {
	@Field()
	displayName!: string;

	@Field({ nullable: true })
	avatarUrl?: string;
}
