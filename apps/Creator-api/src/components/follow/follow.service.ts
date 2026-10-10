import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { CreatorFollow } from '../../libs/dto/follow/creator-follow';
import { ActivityService } from '../activity/activity.service';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';

import { User } from '../../libs/dto/user/user';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';

import { check, duplicateKey, shapeIntoMongooseObjectId, page, requireActive, sameId } from '../../libs/helpers/policy';

import { VisibilityService } from '../creator/visibility.service';

@Injectable()
export class FollowService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		private readonly activity: ActivityService,
		@InjectModel('CreatorFollow') private readonly follows: Model<CreatorFollow>,
		private readonly visibility: VisibilityService,
		@InjectModel('User') private readonly users: Model<User>,
		@InjectModel('CreatorProfile') private readonly profiles: Model<CreatorProfile>,
	) {}

	public async setFollow(currentUser: User, id: string, following: boolean) {
		requireActive(currentUser);
		const key = { followerId: currentUser._id, creatorId: shapeIntoMongooseObjectId(id) };
		if (!following) {
			await this.follows.updateOne(key, { $set: { isActive: false } });
			return false;
		}
		const creator = await this.visibility.profile(key.creatorId);
		check(!sameId(creator.userId, currentUser._id), 'You cannot follow yourself');
		try {
			await this.connection.transaction(async (session) => {
				let follow = await this.follows.findOne(key).session(session);
				if (follow?.isActive) return;
				if (follow) {
					follow.isActive = true;
					follow.followedAt = new Date();
					await follow.save({ session });
				} else {
					[follow] = await this.follows.create([key], { session });
				}
				await this.activity.record(
					{ performedById: currentUser._id, creatorId: creator._id, type: ActivityEventType.CREATOR_FOLLOWED },
					session,
				);
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
		}
		return true;
	}

	public async getMyFollows(currentUser: User, input: PageInput) {
		const { offset, limit } = page(input);
		const query = this.follows.find({ followerId: currentUser._id, isActive: true });
		const [list, total] = await Promise.all([
			query.clone().sort({ followedAt: -1, _id: -1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list, metaCounter: total ? [{ total }] : [] };
	}

	public async getMyFollowers(currentUser: User, input: PageInput) {
		requireActive(currentUser);
		const profile = await this.profiles.findOne({ userId: currentUser._id, deletedAt: null }).select('_id');
		if (!profile) return { list: [], metaCounter: [] };
		const { offset, limit } = page(input);
		// Identity projection deliberately excludes private account fields and auth identities.
		const [result] = await this.follows.aggregate([
			{ $match: { creatorId: profile._id, isActive: true } },
			{ $sort: { followedAt: -1, _id: -1 } },
			{ $lookup: { from: this.users.collection.name, localField: 'followerId', foreignField: '_id', as: 'member' } },
			{ $unwind: '$member' },
			{ $match: { 'member.status': 'ACTIVE', 'member.deletedAt': null } },
			{
				$facet: {
					list: [
						{ $skip: offset },
						{ $limit: limit },
						{ $project: { _id: '$member._id', displayName: '$member.displayName', avatarUrl: '$member.avatarUrl' } },
					],
					metaCounter: [{ $count: 'total' }],
				},
			},
		]);
		return result || { list: [], metaCounter: [] };
	}
}
