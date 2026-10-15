import { Types } from 'mongoose';
import { CreatorsService } from '../src/components/creator/creator.service';
import { CreatorProfile } from '../src/libs/dto/creator/creator-profile';

describe('Creator identity', () => {
	function service(owner: unknown) {
		const users = { findById: () => ({ select: async () => owner }) };
		return new CreatorsService(
			undefined as never,
			undefined as never,
			undefined as never,
			users as never,
			undefined as never,
			undefined as never,
		);
	}
	const profile = { userId: new Types.ObjectId() } as unknown as CreatorProfile;

	it('returns the owner name and avatar', async () => {
		const owner = { displayName: 'Mina Park', avatarUrl: '/uploads/mina.webp' };
		await expect(service(owner).displayOwner(profile)).resolves.toBe(owner);
	});

	it('returns a placeholder when the owner record is missing', async () => {
		await expect(service(null).displayOwner(profile)).resolves.toEqual({ displayName: 'Unknown user' });
	});
});
