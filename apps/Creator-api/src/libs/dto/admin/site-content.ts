import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsString, MaxLength, ValidateIf } from 'class-validator';

export const siteDefaults = {
	homeHeading: 'Find your next creative collaborator.',
	homeSubheading: 'Discover creators, creative work, and services across Korea.',
	aboutText:
		'CreatorHub brings portfolios, creator profiles, and creative services together. It helps people discover work they connect with and reach the creator behind it.\n\nWe welcome creators and collaborators across Korea. A project can start close to home or with someone in another Korean city.',
	contactEmail: '',
	contactText:
		'Our public contact details have not been set yet. A team contact address will appear here when it is available.',
	footerCopy: 'Independent creativity. Connections across Korea.',
};

@ObjectType()
export class SiteContent {
	@Field(() => String)
	homeHeading!: string;

	@Field(() => String)
	homeSubheading!: string;

	@Field(() => String)
	aboutText!: string;

	@Field(() => String)
	contactEmail!: string;

	@Field(() => String)
	contactText!: string;

	@Field(() => String)
	footerCopy!: string;
}

@InputType()
export class SiteContentInput {
	@Field(() => String)
	@IsString()
	@MaxLength(160)
	homeHeading!: string;

	@Field(() => String)
	@IsString()
	@MaxLength(300)
	homeSubheading!: string;

	@Field(() => String)
	@IsString()
	@MaxLength(5000)
	aboutText!: string;

	@Field(() => String)
	@IsString()
	@MaxLength(254)
	@ValidateIf((_o, v) => v !== '')
	@IsEmail()
	contactEmail!: string;

	@Field(() => String)
	@IsString()
	@MaxLength(2000)
	contactText!: string;

	@Field(() => String)
	@IsString()
	@MaxLength(500)
	footerCopy!: string;
}
