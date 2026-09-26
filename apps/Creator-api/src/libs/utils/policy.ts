import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { User } from '../dto/user/user';
import { UserRole } from '../enums/creatorhub.enum';

export function objectId(value: string): Types.ObjectId {
	if (!/^[a-f\d]{24}$/i.test(value)) throw new BadRequestException('Invalid identifier');
	return new Types.ObjectId(value);
}
export function sameId(a: Types.ObjectId | string, b: Types.ObjectId | string): boolean {
	return String(a) === String(b);
}
export function requireRecord<T>(value: T): NonNullable<T> {
	if (!value) throw new NotFoundException('Record not found');
	return value as NonNullable<T>;
}
export function requireOwner(owner: Types.ObjectId | string, currentUser: User): void {
	if (!sameId(owner, currentUser._id)) throw new ForbiddenException('You do not own this record');
}
export function requireAdmin(currentUser: User): void {
	if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException('Administrator access required');
}
// AuthGuard checks the usable identity; services also check the current account state.
export function requireActive(currentUser: User): void {
	if (currentUser.status !== 'ACTIVE') throw new ForbiddenException('Account unavailable');
}
export function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new BadRequestException(message);
}
export function duplicateKey(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}
export function versionConflict(): never {
	throw new ConflictException('This record changed. Reload it before trying again.');
}
export function page(input: { offset?: number; limit?: number } = {}) {
	return { offset: input.offset ?? 0, limit: input.limit ?? 20 };
}
export function defined<T extends object>(input: T): Partial<T> {
	return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}
