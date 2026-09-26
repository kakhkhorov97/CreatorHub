import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsUUID, IsMongoId, IsString, Length } from 'class-validator';

@InputType()
export class CommentInput {
	@IsUUID(4)
	@Field(() => String)
	clientCommentKey!: string;

	@Field(() => ID)
	@IsMongoId()
	projectId!: string;

	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 2000)
	content!: string;
}

@InputType()
export class EditCommentInput {
	@Field(() => String)
	@Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
	@IsString()
	@Length(1, 2000)
	content!: string;
}
