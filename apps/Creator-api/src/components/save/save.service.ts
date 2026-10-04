import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';

import { SavedProject } from '../../libs/dto/save/saved-project';
import { User } from '../../libs/dto/user/user';

import { duplicateKey, shapeIntoMongooseObjectId, page, requireActive } from '../../libs/helpers/policy';

import { ProjectService } from '../project/project.service';

@Injectable()
export class SaveService {
	constructor(
		@InjectModel('SavedProject') private readonly saveModel: Model<SavedProject>,
		private readonly projects: ProjectService,
	) {}

	public async setSave(currentUser: User, projectId: string, saved: boolean) {
		requireActive(currentUser);
		const key = { userId: currentUser._id, projectId: shapeIntoMongooseObjectId(projectId) };
		if (!saved) {
			await this.saveModel.deleteOne(key);
			return false;
		}
		await this.projects.getProject(projectId);
		try {
			await this.saveModel.updateOne(key, { $setOnInsert: key }, { upsert: true });
		} catch (error) {
			if (!duplicateKey(error)) throw error;
		}
		return true;
	}

	public async getSavedProjects(currentUser: User, input: PageInput) {
		const { offset, limit } = page(input);
		const saved = await this.saveModel
			.find({ userId: currentUser._id })
			.sort({ createdAt: -1, _id: -1 })
			.skip(offset)
			.limit(limit);
		const list = await Promise.all(
			saved.map(async (item) => {
				try {
					return {
						savedAt: item.createdAt,
						projectId: item.projectId,
						project: await this.projects.getProject(String(item.projectId)),
						available: true,
					};
				} catch (error) {
					if (!(error instanceof NotFoundException)) throw error;
					return { savedAt: item.createdAt, projectId: item.projectId, available: false };
				}
			}),
		);
		const total = await this.saveModel.countDocuments({ userId: currentUser._id });
		return { list, metaCounter: total ? [{ total }] : [] };
	}
}
