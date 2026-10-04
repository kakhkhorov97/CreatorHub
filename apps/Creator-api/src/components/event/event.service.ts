import { CITIES } from '../../libs/dto/common/locations';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreativeEvent } from '../../libs/dto/event/creative-event';
import { EventInput, EventsInput } from '../../libs/dto/event/event.input';
import { User } from '../../libs/dto/user/user';
import { EventStatus } from '../../libs/enums/event-status.enum';
import {
	check,
	page,
	requireActive,
	requireAdmin,
	requireRecord,
	shapeIntoMongooseObjectId,
} from '../../libs/helpers/policy';

const koreanLocation = new RegExp(
	[
		...CITIES.map((city) => city.nameEn),
		...CITIES.map((city) => city.nameKo),
		'South Korea',
		'한국',
		'대한민국',
		'Online',
		'온라인',
	].join('|'),
	'i',
);

@Injectable()
export class EventsService {
	constructor(@InjectModel('CreativeEvent') private readonly events: Model<CreativeEvent>) {}

	list(input: EventsInput = {}, admin = false) {
		const { offset, limit } = page(input);
		return this.events
			.find({
				...(!admin ? { status: EventStatus.PUBLISHED, location: { $regex: koreanLocation } } : {}),
				...((input.upcoming ?? !admin) ? { endsAt: { $gte: new Date() } } : {}),
			})
			.sort({ startsAt: 1, _id: 1 })
			.skip(offset)
			.limit(limit);
	}

	async get(id: string) {
		return requireRecord(
			await this.events.findOne({
				_id: shapeIntoMongooseObjectId(id),
				status: EventStatus.PUBLISHED,
				location: { $regex: koreanLocation },
			}),
		);
	}

	private validate(user: User, input: EventInput) {
		requireActive(user);
		requireAdmin(user);
		check(koreanLocation.test(input.location), 'Choose a Korean city or an online event');
		check(input.endsAt >= input.startsAt, 'The event must end at or after its start time');
		if (input.eventUrl) {
			let url: URL;
			try {
				url = new URL(input.eventUrl);
			} catch {
				check(false, 'Use a valid HTTPS event link');
			}
			check(url!.protocol === 'https:' && !url!.username && !url!.password, 'Use a valid HTTPS event link');
		}
	}

	create(user: User, input: EventInput) {
		this.validate(user, input);
		return this.events.create(input);
	}

	async update(user: User, id: string, input: EventInput) {
		this.validate(user, input);
		return requireRecord(
			await this.events.findByIdAndUpdate(
				shapeIntoMongooseObjectId(id),
				{ $set: { ...input, eventUrl: input.eventUrl || '' } },
				{ new: true, runValidators: true },
			),
		);
	}
}
