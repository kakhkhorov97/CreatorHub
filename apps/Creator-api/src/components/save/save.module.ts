import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ActivityModule } from '../activity/activity.module';
import { CreatorModule } from '../creator/creator.module';
import { ProjectModule } from '../project/project.module';
import SavedProjectSchema from '../../schemas/SavedProject.model';
import { SaveService } from './save.service';
import { SaveResolver } from './save.resolver';

@Module({
	imports: [
		AuthModule,
		ActivityModule,
		CreatorModule,
		ProjectModule,
		MongooseModule.forFeature([{ name: 'SavedProject', schema: SavedProjectSchema }]),
	],
	providers: [SaveService, SaveResolver],
	exports: [SaveService],
})
export class SaveModule {}
