import { scryptSync } from 'node:crypto';
import { AuthService } from '../src/components/auth/auth.service';

describe('Password compatibility', () => {
	const auth = Object.create(AuthService.prototype) as AuthService;
	const password = 'Compatibility-password-123';
	it('accepts an existing native bcrypt hash using bcryptjs', async () => {
		const legacy = '$2b$12$7/0tvqV1smdYFNsU4wkRFuTvsPH3d5xtjvt6SRj2a0OSV/JdlReJu';
		expect(await auth.comparePasswords(password, legacy)).toBe(true);
		expect(await auth.comparePasswords('incorrect', legacy)).toBe(false);
	});
	it('preserves scrypt accounts and writes bcrypt hashes for new passwords', async () => {
		const salt = '0123456789abcdef0123456789abcdef';
		const legacy = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
		expect(await auth.comparePasswords(password, legacy)).toBe(true);
		const hash = await auth.hashPassword(password);
		expect(hash).toMatch(/^\$2[ab]\$12\$/);
		expect(await auth.comparePasswords(password, hash)).toBe(true);
	});
	it('accepts 30-character Unicode passwords without bcrypt truncation', async () => {
		const unicode = '한'.repeat(30);
		const hash = await auth.hashPassword(unicode);
		expect(await auth.comparePasswords(unicode, hash)).toBe(true);
		expect(await auth.comparePasswords('한'.repeat(29) + '글', hash)).toBe(false);
		expect(
			await auth.comparePasswords('한'.repeat(25), '$2b$12$7/0tvqV1smdYFNsU4wkRFuTvsPH3d5xtjvt6SRj2a0OSV/JdlReJu'),
		).toBe(false);
	});
});
