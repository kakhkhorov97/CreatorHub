import { Field, Int, ObjectType } from '@nestjs/graphql';
import { MediaType } from '../../enums/creatorhub.enum';

@ObjectType()
export class PortfolioMedia {
	@Field(() => MediaType)
	type!: MediaType;

	@Field(() => String)
	url!: string;

	@Field(() => String)
	altText!: string;

	@Field(() => Int)
	sortOrder!: number;
}
