import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Types } from 'mongoose';
import { CreatorAvailability, ProfileStatus } from '../../enums/creatorhub.enum';
import { MutableEntity } from '../common/entity';
import { SocialLink } from '../common/social-link';

@ObjectType()
export class CreatorProfile extends MutableEntity {
	@Field(() => ID)
	userId!: Types.ObjectId;

	@Field(() => String)
	slug!: string;

	@Field(() => String, { nullable: true })
	headline?: string;

	@Field(() => String, { nullable: true })
	bio?: string;

	@Field(() => String, { nullable: true })
	city?: string;

	@Field(() => Boolean)
	remoteAvailable!: boolean;

	@Field(() => CreatorAvailability)
	availability!: CreatorAvailability;

	@Field(() => [ID])
	categoryIds!: Types.ObjectId[];

	@Field(() => [String])
	skills!: string[];

	@Field(() => [SocialLink])
	socialLinks!: SocialLink[];

	@Field(() => ProfileStatus)
	status!: ProfileStatus;

	@Field(() => Date, { nullable: true })
	publishedAt?: Date;

	@Field(() => Date, { nullable: true })
	deletedAt?: Date;
}
