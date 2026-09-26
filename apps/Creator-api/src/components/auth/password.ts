import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16).toString('hex');
	const key = (await scrypt(password, salt, 64)) as Buffer;
	return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [algorithm, salt, encoded] = stored.split(':');
	if (algorithm !== 'scrypt' || !salt || !encoded) return false;
	const key = (await scrypt(password, salt, 64)) as Buffer;
	const expected = Buffer.from(encoded, 'hex');
	return expected.length === key.length && timingSafeEqual(expected, key);
}
export const newToken = () => randomBytes(32).toString('hex');
export const tokenHash = (raw: string) => createHash('sha256').update(raw).digest('hex');
