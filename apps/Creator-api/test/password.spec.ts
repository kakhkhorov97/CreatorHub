import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
	RegisterInput,
	PhoneRegisterInput,
	ResetPasswordInput,
	LinkEmailInput,
	LinkPhoneInput,
	ChangePasswordInput,
	ChangePhonePasswordInput,
	LoginInput,
	PhoneLoginInput,
} from '../src/libs/dto/auth/auth.input';
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

describe('New password policy', () => {
	const credentialInputs = [
		RegisterInput,
		PhoneRegisterInput,
		ResetPasswordInput,
		LinkEmailInput,
		LinkPhoneInput,
		ChangePasswordInput,
		ChangePhonePasswordInput,
	];
	function passwordErrors(type: any, password: string) {
		return validateSync(plainToInstance(type, { password })).filter((error) => error.property === 'password');
	}
	it.each(credentialInputs.map((type) => [type.name, type] as const))(
		'%s requires every character class',
		(_name, type) => {
			for (const password of ['LettersOnly', 'Letters123', 'Letters!Only', '123456!', 'Letters123 ', 'Letters123\t']) {
				expect(passwordErrors(type, password)).not.toHaveLength(0);
			}
		},
	);
	it.each(credentialInputs.map((type) => [type.name, type] as const))(
		'%s accepts symbols and Unicode letters within the length bounds',
		(_name, type) => {
			for (const password of ['River7!Cloud', 'abc1!x', '한'.repeat(28) + '1!', 'alpha7-omega', 'alpha7🙂']) {
				expect(passwordErrors(type, password)).toHaveLength(0);
			}
			for (const password of ['Ab1!x', 'a'.repeat(29) + '1!']) {
				expect(passwordErrors(type, password)).not.toHaveLength(0);
			}
		},
	);
	it.each([LoginInput, PhoneLoginInput])('keeps existing passwords usable for %p', (type) => {
		expect(passwordErrors(type, 'abcdef')).toHaveLength(0);
	});
});
