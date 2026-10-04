import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../user/user';
import { CreatorProfile } from '../creator/creator-profile';
import { PortfolioProject } from '../project/portfolio-project';
import { CreatorService } from '../service/creator-service';
import { ProjectComment } from '../comment/project-comment';
import { MetaCounter } from '../common/meta-counter';
@ObjectType()
export class AdminEntry {
	@Field(() => ID) _id!: string;
	@Field(() => String) title!: string;
	@Field(() => String) status!: string;
	@Field(() => Date) updatedAt!: Date;
	@Field(() => Date, { nullable: true }) deletedAt?: Date;
	@Field(() => String, { nullable: true }) ownerName?: string;
	@Field(() => String, { nullable: true }) projectTitle?: string;
	@Field(() => User, { nullable: true }) user?: User;
	@Field(() => CreatorProfile, { nullable: true }) creator?: CreatorProfile;
	@Field(() => PortfolioProject, { nullable: true }) project?: PortfolioProject;
	@Field(() => CreatorService, { nullable: true }) service?: CreatorService;
	@Field(() => ProjectComment, { nullable: true }) comment?: ProjectComment;
}
@ObjectType()
export class AdminDirectory {
	@Field(() => [AdminEntry]) list!: AdminEntry[];
	@Field(() => [MetaCounter]) metaCounter!: MetaCounter[];
}
@ObjectType()
export class AdminOverview {
	@Field(() => Int) users!: number;
	@Field(() => Int) creators!: number;
	@Field(() => Int) projects!: number;
	@Field(() => Int) services!: number;
	@Field(() => Int) comments!: number;
	@Field(() => Int) categories!: number;
	@Field(() => Int) events!: number;
}
