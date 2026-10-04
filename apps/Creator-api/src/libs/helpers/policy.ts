import { Message } from '../enums/common.enum';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { User } from '../dto/user/user';
import { UserRole } from '../enums/user-role.enum';

export function shapeIntoMongooseObjectId(value: string): Types.ObjectId {
	if (!/^[a-f\d]{24}$/i.test(value)) throw new BadRequestException(Message.INVALID_IDENTIFIER);
	return new Types.ObjectId(value);
}

export function sameId(a: Types.ObjectId | string, b: Types.ObjectId | string): boolean {
	return String(a) === String(b);
}

export function requireRecord<T>(value: T): NonNullable<T> {
	if (!value) throw new NotFoundException(Message.NO_DATA_FOUND);
	return value as NonNullable<T>;
}

export function requireOwner(owner: Types.ObjectId | string, currentUser: User): void {
	if (!sameId(owner, currentUser._id)) throw new ForbiddenException(Message.NOT_OWNER);
}

export function requireAdmin(currentUser: User): void {
	if (currentUser.role !== UserRole.ADMIN) throw new ForbiddenException(Message.ADMIN_ACCESS_REQUIRED);
}

export function requireCreator(currentUser: User): void {
	requireActive(currentUser);
	if (![UserRole.CREATOR, UserRole.ADMIN].includes(currentUser.role))
		throw new ForbiddenException(Message.CREATOR_ACCESS_REQUIRED);
}
// AuthGuard checks the usable identity; services also check the current account state.

export function requireActive(currentUser: User): void {
	if (currentUser.status !== 'ACTIVE') throw new ForbiddenException(Message.ACCOUNT_UNAVAILABLE);
}

export function check(condition: unknown, message: string): asserts condition {
	if (!condition) throw new BadRequestException(message);
}

export function duplicateKey(error: unknown): boolean {
	return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

export function versionConflict(): never {
	throw new ConflictException(Message.VERSION_CONFLICT);
}

export function page(input: { page?: number; limit?: number } = {}) {
	return { offset: ((input.page ?? 1) - 1) * (input.limit ?? 20), limit: input.limit ?? 20 };
}

export function defined<T extends object>(input: T): Partial<T> {
	return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}
