import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Module({
	imports: [
		MongooseModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				uri: config.getOrThrow<string>(config.get('NODE_ENV') === 'production' ? 'MONGO_PROD' : 'MONGO_DEV'),
				autoIndex: false,
				serverSelectionTimeoutMS: 10000,
			}),
		}),
	],
	exports: [MongooseModule],
})
export class DatabaseModule implements OnModuleInit {
	constructor(@InjectConnection() private readonly connection: Connection) {}

	public async onModuleInit() {
		const topology = await this.connection.db!.admin().command({ hello: 1 });
		if (!topology.setName && topology.msg !== 'isdbgrid')
			throw new Error('CreatorHub requires a transaction-capable MongoDB replica set or sharded cluster');
	}
}
