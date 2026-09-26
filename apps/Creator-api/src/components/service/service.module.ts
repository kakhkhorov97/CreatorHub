import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CreatorServiceSchema from '../../schemas/service/CreatorService.model';
import { AuthModule } from '../auth/auth.module';
import { CategoryModule } from '../category/category.module';
import { CreatorModule } from '../creator/creator.module';
import { ServiceResolver } from './service.resolver';
import { ServiceService } from './service.service';

@Module({
	imports: [
		AuthModule,
		CreatorModule,
		CategoryModule,
		MongooseModule.forFeature([{ name: 'CreatorService', schema: CreatorServiceSchema }]),
	],
	providers: [ServiceService, ServiceResolver],
	exports: [ServiceService],
})
export class ServiceModule {}
