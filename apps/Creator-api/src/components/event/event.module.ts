import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import CreativeEventSchema from '../../schemas/CreativeEvent.model';
import { AuthModule } from '../auth/auth.module';
import { EventsResolver } from './event.resolver';
import { EventsService } from './event.service';
@Module({
	imports: [AuthModule, MongooseModule.forFeature([{ name: 'CreativeEvent', schema: CreativeEventSchema }])],
	providers: [EventsResolver, EventsService],
})
export class EventModule {}
