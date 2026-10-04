import { Injectable } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ActivityService } from '../../Creator-api/src/components/activity/activity.service';

@Injectable()
export class BatchService {
	constructor(private readonly activityService: ActivityService) {}

	public getHello(): string {
		return 'CreatorHub batch notification worker';
	}

	@Interval(5000)
	public async deliverActivityNotifications(): Promise<void> {
		await this.activityService.deliverPending();
	}
}
