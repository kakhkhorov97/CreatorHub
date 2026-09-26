import { ClientSession, HydratedDocument, Model } from 'mongoose';
import { MutableEntity } from '../dto/common/entity';
import { versionConflict } from './policy';

// Publication checks and content changes use the same observed revision.
export async function saveRevision<T extends MutableEntity>(
	model: Model<T>,
	document: HydratedDocument<T>,
	session?: ClientSession,
) {
	await document.validate();
	const previous = document.updatedAt;
	document.updatedAt = new Date(Math.max(Date.now(), previous.getTime() + 1));
	const result = await model.findOneAndReplace({ _id: document._id, updatedAt: previous }, document.toObject(), {
		new: true,
		runValidators: true,
		timestamps: false,
		session,
	});
	return result ?? versionConflict();
}
