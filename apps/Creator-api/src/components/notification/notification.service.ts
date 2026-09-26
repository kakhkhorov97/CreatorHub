import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { ActivityEvent } from '../../libs/dto/notification/activity-event';
import { ActivityService } from '../activity/activity.service';
import { InquiryEvent } from '../../libs/dto/inquiry/inquiry-event';
import { Notification } from '../../libs/dto/notification/notification';
import { User } from '../../libs/dto/user/user';
import { objectId, page, requireRecord } from '../../libs/utils/policy';

@Injectable()
export class NotificationService {
	constructor(
		@InjectModel('Notification') private readonly notificationModel: Model<Notification>,
		@InjectModel('InquiryEvent') private readonly eventModel: Model<InquiryEvent>,
		@InjectModel('ActivityEvent') private readonly activityModel: Model<ActivityEvent>,
		private readonly activityService: ActivityService,
	) {}

	public async getNotifications(currentUser: User, input: PageInput, unreadOnly: boolean) {
		const { offset, limit } = page(input);
		const notifications = await this.notificationModel
			.find({ recipientId: currentUser._id, ...(unreadOnly ? { readAt: { $exists: false } } : {}) })
			.sort({ createdAt: -1, _id: -1 })
			.skip(offset)
			.limit(limit)
			.lean();
		const events = await this.eventModel.find({ _id: { $in: notifications.map((item) => item.inquiryEventId) } });
		const byId = new Map(events.map((event) => [String(event._id), event]));
		const activities = await this.activityModel.find({
			_id: { $in: notifications.map((item) => item.activityEventId).filter(Boolean) },
		});
		const activityById = new Map(activities.map((event) => [String(event._id), event]));
		return Promise.all(
			notifications.map(async (item) => {
				const activity = activityById.get(String(item.activityEventId));
				const activityEvent = activity && (await this.activityService.visible(activity)) ? activity : null;
				const event = byId.get(String(item.inquiryEventId)) ?? null;
				return { ...item, event, activityEvent, unavailable: !event && !activityEvent };
			}),
		);
	}

	public getUnreadCount(currentUser: User) {
		return this.notificationModel.countDocuments({ recipientId: currentUser._id, readAt: { $exists: false } });
	}

	public async markRead(currentUser: User, id: string) {
		requireRecord(await this.notificationModel.findOne({ _id: objectId(id), recipientId: currentUser._id }));
		await this.notificationModel.updateOne(
			{ _id: objectId(id), recipientId: currentUser._id, readAt: { $exists: false } },
			{ $set: { readAt: new Date() } },
		);
		return true;
	}
}
