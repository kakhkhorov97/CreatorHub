import { Injectable } from '@nestjs/common';
@Injectable()
export class BatchService {
	public getHello(): string {
		return 'CreatorHub batch entry point: no scheduled jobs in version 1';
	}
}
