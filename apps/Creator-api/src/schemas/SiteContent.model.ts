import { Schema } from 'mongoose';

const SiteContentSchema = new Schema(
	{
		key: {
			type: String,
			required: true,
			enum: ['public'],
			default: 'public',
		},
		homeHeading: {
			type: String,
			required: false,
			maxlength: 160,
			default: 'Find your next creative collaborator.',
		},
		homeSubheading: {
			type: String,
			required: false,
			maxlength: 300,
			default: 'Explore independent talent, creative work, and services across Korea.',
		},
		aboutText: {
			type: String,
			required: false,
			maxlength: 5000,
			default:
				'CreatorHub brings portfolios, creator profiles, and creative services together. It helps people discover work they connect with and reach the creator behind it.\n\nWe connect creators and collaborators within South Korea. Discover local talent and discuss your next project.',
		},
		contactEmail: {
			type: String,
			required: false,
			maxlength: 254,
			default: '',
		},
		contactText: {
			type: String,
			required: false,
			maxlength: 2000,
			default:
				'Our public contact details have not been set yet. A team contact address will appear here when it is available.',
		},
		footerCopy: {
			type: String,
			required: false,
			maxlength: 500,
			default: 'Independent creativity. Connections across Korea.',
		},
	},
	{ collection: 'siteContent', timestamps: true, strict: 'throw', versionKey: false },
);

SiteContentSchema.index({ key: 1 }, { unique: true, name: 'uq_site_content_key' });

export default SiteContentSchema;
