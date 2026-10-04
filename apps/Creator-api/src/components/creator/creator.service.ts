import { Message } from '../../libs/enums/common.enum';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { CITIES } from '../../libs/dto/common/locations';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { CreateCreatorInput } from '../../libs/dto/creator/creator.input';
import { UpdateCreatorInput } from '../../libs/dto/creator/creator.update';
import { User } from '../../libs/dto/user/user';
import { ProfileStatus } from '../../libs/enums/profile-status.enum';
import { UserRole } from '../../libs/enums/user-role.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';
import { check, duplicateKey, defined, requireRecord, requireActive } from '../../libs/helpers/policy';
import { saveRevision } from '../../libs/helpers/save-revision';
import { CategoriesService } from '../category/category.service';
import { VisibilityService } from './visibility.service';

@Injectable()
export class CreatorsService {
	constructor(
		@InjectConnection() private readonly connection: Connection,
		@InjectModel(CreatorProfile.name) private readonly profiles: Model<CreatorProfile>,
		@InjectModel(User.name) private readonly users: Model<User>,
		private readonly categories: CategoriesService,
		private readonly visibility: VisibilityService,
	) {}

	async own(currentUser: User) {
		return requireRecord(await this.profiles.findOne({ userId: currentUser._id, deletedAt: { $exists: false } }));
	}

	async public(slug: string) {
		const profile = requireRecord(await this.profiles.findOne({ slug }));
		return this.visibility.profile(profile._id);
	}

	async displayOwner(profile: CreatorProfile) {
		return requireRecord(await this.users.findById(profile.userId).select('displayName avatarUrl'));
	}

	async create(currentUser: User, input: CreateCreatorInput) {
		requireActive(currentUser);
		const existing = await this.profiles.findOne({ userId: currentUser._id });
		if (existing) return this.onboardingProfile(existing);
		await this.validate(input);
		try {
			return await this.profiles.create({ ...defined(input), userId: currentUser._id });
		} catch (error) {
			if (!duplicateKey(error)) throw error;
			const existing = await this.profiles.findOne({ userId: currentUser._id });
			if (!existing) throw error;
			return this.onboardingProfile(existing);
		}
	}

	private onboardingProfile(profile: CreatorProfile) {
		if (profile.deletedAt) throw new ConflictException(Message.PROFILE_DELETED);
		return profile;
	}

	async update(currentUser: User, input: UpdateCreatorInput) {
		requireActive(currentUser);
		const profile = await this.own(currentUser);
		Object.assign(profile, defined(input));
		await this.validate(profile);
		if (profile.status === ProfileStatus.PUBLISHED) await this.publication(profile);
		return saveRevision(this.profiles, profile);
	}

	private async validate(profile: UpdateCreatorInput | CreatorProfile) {
		if (profile.city !== undefined)
			check(
				CITIES.some((city) => city.key === profile.city),
				'Select a supported city',
			);
		if (profile.categoryIds) await this.categories.validate(profile.categoryIds, true);
		if (profile.socialLinks)
			check(
				new Set(profile.socialLinks.map((link) => new URL(link.url).href)).size === profile.socialLinks.length,
				'Social links must be distinct',
			);
	}

	private async publication(profile: CreatorProfile) {
		check(
			profile.headline && profile.city && profile.categoryIds.length,
			'Publishing requires a headline, city, and category',
		);
		await this.categories.validate(profile.categoryIds);
	}

	async setStatus(currentUser: User, status: ProfileStatus) {
		requireActive(currentUser);
		return this.connection.transaction(async (session) => {
			const profile = await this.own(currentUser);
			check(
				status !== ProfileStatus.DRAFT || profile.status === ProfileStatus.DRAFT,
				'Published profiles cannot return to draft',
			);
			check(
				status !== ProfileStatus.HIDDEN || profile.status !== ProfileStatus.DRAFT,
				'Publish the profile before hiding it',
			);
			if (status === ProfileStatus.PUBLISHED) {
				await this.publication(profile);
				profile.publishedAt ??= new Date();
			}
			profile.status = status;
			const updated = await saveRevision(this.profiles, profile, session);
			if (status === ProfileStatus.PUBLISHED) {
				const account = await this.users.updateOne(
					{ _id: currentUser._id, status: UserStatus.ACTIVE },
					{ $currentDate: { updatedAt: true } },
					{ session },
				);
				check(account.matchedCount, 'Account unavailable');
				await this.users.updateOne(
					{ _id: currentUser._id, role: UserRole.USER },
					{ $set: { role: UserRole.CREATOR } },
					{ session },
				);
			}
			return updated;
		});
	}

	async delete(currentUser: User) {
		requireActive(currentUser);
		const profile = await this.own(currentUser);
		profile.deletedAt = new Date();
		await saveRevision(this.profiles, profile);
		return true;
	}
}
