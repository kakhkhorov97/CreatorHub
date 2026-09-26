import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CreatorProfileSchema from '../../schemas/creator/CreatorProfile.model';
import CreatorServiceSchema from '../../schemas/service/CreatorService.model';
import PortfolioProjectSchema from '../../schemas/project/PortfolioProject.model';
import { CategoryModule } from '../category/category.module';
import { AssistantService } from './assistant.service';
import { DiscoveryResolver } from './discovery.resolver';
import { DiscoveryService } from './discovery.service';

@Module({
	imports: [
		CategoryModule,
		MongooseModule.forFeature([
			{ name: 'CreatorProfile', schema: CreatorProfileSchema },
			{ name: 'PortfolioProject', schema: PortfolioProjectSchema },
			{ name: 'CreatorService', schema: CreatorServiceSchema },
		]),
	],
	providers: [DiscoveryService, DiscoveryResolver, AssistantService],
	exports: [DiscoveryService],
})
export class DiscoveryModule {}
