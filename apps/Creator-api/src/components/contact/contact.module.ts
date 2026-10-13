import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ContactController } from './contact.controller';
@Module({ imports: [AuthModule], controllers: [ContactController] })
export class ContactModule {}
