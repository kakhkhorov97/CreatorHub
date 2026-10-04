import { ActivityService } from '../activity/activity.service';
import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { ProjectLike } from '../../libs/dto/like/project-like';

import { User } from '../../libs/dto/user/user';
import { ActivityEventType } from '../../libs/enums/activity-event-type.enum';

import { check, duplicateKey, shapeIntoMongooseObjectId, requireActive, sameId } from '../../libs/helpers/policy';

import { VisibilityService } from '../creator/visibility.service';
import { ProjectService } from '../project/project.service';

@Injectable()
export class LikeService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		private readonly activity: ActivityService,
		@InjectModel('ProjectLike') private readonly likeModel: Model<ProjectLike>,
		private readonly projects: ProjectService,
		private readonly visibility: VisibilityService,
	) {}

	public async setLike(currentUser: User, projectId: string, liked: boolean) {
		requireActive(currentUser);
		const key = { userId: currentUser._id, projectId: shapeIntoMongooseObjectId(projectId) };
		if (!liked) {
			await this.likeModel.deleteOne(key);
			return false;
		}
		const project = await this.projects.getProject(projectId);
		const creator = await this.visibility.profile(project.creatorId);
		check(!sameId(creator.userId, currentUser._id), 'You cannot like your own project');
		try {
			await this.connection.transaction(async (session) => {
				const result = await this.likeModel.updateOne(key, { $setOnInsert: key }, { upsert: true, session });
				if (result.upsertedCount)
					await this.activity.record(
						{
							performedById: currentUser._id,
							creatorId: creator._id,
							projectId: project._id,
							type: ActivityEventType.PROJECT_LIKED,
						},
						session,
					);
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
		}
		return true;
	}

	public async getMyLike(currentUser: User, projectId: string) {
		requireActive(currentUser);
		await this.projects.getProject(projectId);
		return Boolean(
			await this.likeModel.exists({ userId: currentUser._id, projectId: shapeIntoMongooseObjectId(projectId) }),
		);
	}

	public async getLikeCount(projectId: string) {
		await this.projects.getProject(projectId);
		return this.likeModel.countDocuments({ projectId: shapeIntoMongooseObjectId(projectId) });
	}
}
