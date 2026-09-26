import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { User } from '../../libs/dto/user/user';
import { UpdateUserInput } from '../../libs/dto/user/user.input';
import { UserStatus } from '../../libs/enums/creatorhub.enum';
import { MediaPolicy } from '../../libs/utils/media-policy.service';
import { check, defined, objectId, requireAdmin, requireRecord, sameId } from '../../libs/utils/policy';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
	constructor(
		@InjectModel(User.name) private readonly users: Model<User>,
		@InjectConnection() private readonly connection: Connection,
		private readonly auth: AuthService,
		private readonly media: MediaPolicy,
	) {}

	async update(currentUser: User, input: UpdateUserInput) {
		if (input.avatarUrl) this.media.validate(input.avatarUrl, String(currentUser._id));
		return requireRecord(
			await this.users.findOneAndUpdate(
				{ _id: currentUser._id, status: UserStatus.ACTIVE },
				{ $set: defined(input) },
				{ new: true, runValidators: true },
			),
		);
	}

	async delete(currentUser: User) {
		await this.connection.transaction(async (session) => {
			await this.users.updateOne(
				{ _id: currentUser._id, status: UserStatus.ACTIVE },
				{ $set: { status: UserStatus.DELETED, deletedAt: new Date() } },
				{ session },
			);
			await this.auth.revokeAll(currentUser._id, session);
		});
		return true;
	}

	async setSuspended(currentUser: User, id: string, suspended: boolean) {
		requireAdmin(currentUser);
		check(!sameId(currentUser._id, id), 'You cannot suspend yourself');
		return this.connection.transaction(async (session) => {
			const user = requireRecord(
				await this.users.findOneAndUpdate(
					{ _id: objectId(id), status: { $ne: UserStatus.DELETED } },
					{ $set: { status: suspended ? UserStatus.SUSPENDED : UserStatus.ACTIVE } },
					{ new: true, session },
				),
			);
			if (suspended) await this.auth.revokeAll(user._id, session);
			return user;
		});
	}
}
