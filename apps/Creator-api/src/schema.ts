import { AdminResolver, SiteContentResolver } from './components/admin/admin.resolver';
import { EventsResolver } from './components/event/event.resolver';
import { UploadResolver } from './components/upload/upload.resolver';
import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { printSchema } from 'graphql';
import { mkdir, writeFile } from 'node:fs/promises';
import { AppResolver } from './app.resolver';
import { AuthResolver } from './components/auth/auth.resolver';
import { CategoriesResolver } from './components/category/category.resolver';
import { CreatorsResolver } from './components/creator/creator.resolver';
import { DiscoveryResolver } from './components/discovery/discovery.resolver';
import { LikeResolver } from './components/like/like.resolver';
import { FollowResolver } from './components/follow/follow.resolver';
import { SaveResolver } from './components/save/save.resolver';
import { CommentResolver } from './components/comment/comment.resolver';
import { InquiryResolver } from './components/inquiry/inquiry.resolver';
import { NotificationResolver } from './components/notification/notification.resolver';
import { ProjectResolver } from './components/project/project.resolver';
import { ServiceResolver } from './components/service/service.resolver';
import { UsersResolver } from './components/user/user.resolver';

async function exportSchema() {
	const app = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
	try {
		const factory = app.get(GraphQLSchemaFactory);
		const schema = await factory.create([
			AdminResolver,
			SiteContentResolver,
			UploadResolver,
			EventsResolver,
			AppResolver,
			AuthResolver,
			CategoriesResolver,
			CreatorsResolver,
			DiscoveryResolver,
			LikeResolver,
			FollowResolver,
			SaveResolver,
			CommentResolver,
			InquiryResolver,
			NotificationResolver,
			ProjectResolver,
			ServiceResolver,
			UsersResolver,
		]);
		await mkdir('docs', { recursive: true });
		await writeFile('docs/schema.graphql', printSchema(schema) + '\n');
		console.log('Exported docs/schema.graphql');
	} finally {
		await app.close();
	}
}

exportSchema().catch((error) => {
	console.error(error instanceof Error ? error.message : 'Schema export failed');
	process.exitCode = 1;
});
