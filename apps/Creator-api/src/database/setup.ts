import { ConfigModule } from '@nestjs/config';
import { createConnection } from 'mongoose';
import { validateEnvironment } from '../libs/config';
import { Category } from '../libs/dto/category/category';
import { registerModels } from './models';

const categories = [
	{ slug: 'graphic-design', name: 'Graphic design' },
	{ slug: 'photography', name: 'Photography' },
	{ slug: 'video-production', name: 'Video production' },
	{ slug: 'illustration', name: 'Illustration' },
	{ slug: 'web-development', name: 'Web development' },
	{ slug: 'ui-ux-design', name: 'UI/UX design' },
];

async function setup() {
	await ConfigModule.forRoot();
	const environment = validateEnvironment(process.env);
	const connection = await createConnection(
		String(environment.NODE_ENV === 'production' ? environment.MONGO_PROD : environment.MONGO_DEV),
		{ autoIndex: false },
	).asPromise();
	try {
		const topology = await connection.db!.admin().command({ hello: 1 });
		if (!topology.setName && topology.msg !== 'isdbgrid') throw new Error('A MongoDB replica set is required');
		registerModels(connection);
		for (const model of Object.values(connection.models)) await model.createIndexes();
		const categoryModel = connection.model<Category>('Category');
		for (const [sortOrder, category] of categories.entries()) {
			// Rerunning setup preserves administrator edits and inactive categories.
			await categoryModel.updateOne(
				{ slug: category.slug },
				{ $setOnInsert: { ...category, sortOrder, isActive: true, createdAt: new Date(), updatedAt: new Date() } },
				{ upsert: true, timestamps: false },
			);
		}
		console.log('CreatorHub indexes and six category seeds are ready.');
	} finally {
		await connection.close();
	}
}

setup().catch((error) => {
	console.error(error instanceof Error ? error.message : 'Database setup failed');
	process.exitCode = 1;
});
