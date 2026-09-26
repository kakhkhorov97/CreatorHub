import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { ProjectStatus } from '../../enums/creatorhub.enum';
import { MutableEntity } from '../common/entity';
import { PortfolioMedia } from '../common/portfolio-media';

@ObjectType()
export class PortfolioProject extends MutableEntity {
	@Field(() => ID)
	creatorId!: Types.ObjectId;

	@Field(() => ID, { nullable: true })
	categoryId?: Types.ObjectId;

	@Field(() => String)
	title!: string;

	@Field(() => String)
	slug!: string;

	@Field(() => String, { nullable: true })
	summary?: string;

	@Field(() => String, { nullable: true })
	description?: string;

	@Field(() => String, { nullable: true })
	coverImageUrl?: string;

	@Field(() => [PortfolioMedia])
	media!: PortfolioMedia[];

	@Field(() => [String])
	tags!: string[];

	@Field(() => String, { nullable: true })
	externalUrl?: string;

	@Field(() => ProjectStatus)
	status!: ProjectStatus;

	@Field(() => Date, { nullable: true })
	publishedAt?: Date;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;
}
