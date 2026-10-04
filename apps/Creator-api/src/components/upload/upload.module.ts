import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadResolver } from './upload.resolver';
import { UploadService } from './upload.service';

@Module({ imports: [AuthModule], providers: [UploadResolver, UploadService] })
export class UploadModule {}
