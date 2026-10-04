import { CITIES } from '../../libs/dto/common/locations';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, PipelineStage, Types } from 'mongoose';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { User } from '../../libs/dto/user/user';
import { ProfileStatus } from '../../libs/enums/profile-status.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';

@Injectable()
export class VisibilityService {
	constructor(
		@InjectModel(CreatorProfile.name) private readonly profiles: Model<CreatorProfile>,
		@InjectModel(User.name) private readonly users: Model<User>,
	) {}

	async profile(id: Types.ObjectId, session: ClientSession | null = null) {
		const profile = await this.profiles
			.findOne({
				_id: id,
				city: { $in: CITIES.map((city) => city.key) },
				status: ProfileStatus.PUBLISHED,
				deletedAt: { $exists: false },
			})
			.session(session);
		if (!profile || !(await this.users.exists({ _id: profile.userId, status: UserStatus.ACTIVE }).session(session)))
			throw new NotFoundException('Creator not found');
		return profile;
	}

	// Apply before pagination so hidden owners never consume a public result slot.
	static ownerPipeline(profilePath?: string): PipelineStage[] {
		const stages: PipelineStage[] = profilePath ? [] : [{ $match: { city: { $in: CITIES.map((city) => city.key) } } }];
		if (profilePath)
			stages.push(
				{ $lookup: { from: 'creatorProfiles', localField: profilePath, foreignField: '_id', as: '_creator' } },
				{ $unwind: '$_creator' },
				{
					$match: {
						'_creator.city': { $in: CITIES.map((city) => city.key) },
						'_creator.status': ProfileStatus.PUBLISHED,
						'_creator.deletedAt': { $exists: false },
					},
				},
			);
		stages.push(
			{
				$lookup: {
					from: 'users',
					localField: profilePath ? '_creator.userId' : 'userId',
					foreignField: '_id',
					as: '_owner',
					pipeline: [{ $match: { status: UserStatus.ACTIVE } }, { $project: { _id: 1 } }],
				},
			},
			{ $match: { '_owner.0': { $exists: true } } },
		);
		return stages;
	}
}
