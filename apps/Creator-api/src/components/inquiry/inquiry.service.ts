import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { PageInput } from '../../libs/dto/common/pagination.input';
import { CreatorProfile } from '../../libs/dto/creator/creator-profile';
import { Inquiry } from '../../libs/dto/inquiry/inquiry';
import { InquiryEvent } from '../../libs/dto/inquiry/inquiry-event';
import { InquiryMessage } from '../../libs/dto/inquiry/inquiry-message';
import {
	CloseInquiryInput,
	CreateInquiryInput,
	InquiryVersionInput,
	SendMessageInput,
} from '../../libs/dto/inquiry/inquiry.input';
import { UpdateInquiryInput } from '../../libs/dto/inquiry/inquiry.update';
import { Notification } from '../../libs/dto/notification/notification';
import { User } from '../../libs/dto/user/user';
import { CreatorAvailability } from '../../libs/enums/creator-availability.enum';
import { InquiryEventType } from '../../libs/enums/inquiry-event-type.enum';
import { InquiryStatus } from '../../libs/enums/inquiry-status.enum';
import { UserStatus } from '../../libs/enums/user-status.enum';
import {
	check,
	defined,
	duplicateKey,
	shapeIntoMongooseObjectId,
	page,
	requireRecord,
	requireActive,
	sameId,
	versionConflict,
} from '../../libs/helpers/policy';
import { VisibilityService } from '../creator/visibility.service';
import { ServiceService } from '../service/service.service';
import { nextInquiryStatus } from './inquiry.policy';

@Injectable()
export class InquiryService {
	constructor(
		@InjectModel('Inquiry') private readonly inquiryModel: Model<Inquiry>,
		@InjectModel('InquiryMessage') private readonly messageModel: Model<InquiryMessage>,
		@InjectModel('InquiryEvent') private readonly eventModel: Model<InquiryEvent>,
		@InjectModel('Notification') private readonly notificationModel: Model<Notification>,
		@InjectModel('CreatorProfile') private readonly profileModel: Model<CreatorProfile>,
		@InjectModel('User') private readonly userModel: Model<User>,
		@InjectConnection() private readonly connection: Connection,
		private readonly visibility: VisibilityService,
		private readonly services: ServiceService,
	) {}

	private async participant(currentUser: User, id: string, session: ClientSession | null = null) {
		const current = requireRecord(
			await this.userModel.findOne({ _id: currentUser._id, status: UserStatus.ACTIVE }).session(session),
		);
		requireActive(current);
		const inquiry = requireRecord(await this.inquiryModel.findById(shapeIntoMongooseObjectId(id)).session(session));
		const creator = requireRecord(await this.profileModel.findById(inquiry.creatorId).session(session));
		const isClient = sameId(inquiry.clientId, currentUser._id);
		if (!isClient && (!sameId(creator.userId, currentUser._id) || inquiry.status === InquiryStatus.DRAFT))
			throw new ForbiddenException('This inquiry is private');
		return { inquiry, creator, isClient, otherId: isClient ? creator.userId : inquiry.clientId };
	}

	private validateBudget(input: Pick<Inquiry, 'budgetMin' | 'budgetMax'>) {
		check(
			input.budgetMin === undefined || input.budgetMax === undefined || input.budgetMax >= input.budgetMin,
			'Maximum budget must not be below minimum budget',
		);
	}

	public async createInquiry(currentUser: User, input: CreateInquiryInput) {
		requireActive(currentUser);
		const creator = await this.visibility.profile(shapeIntoMongooseObjectId(input.creatorId));
		check(!sameId(creator.userId, currentUser._id), 'You cannot inquire about your own work');
		this.validateBudget(input);
		// Service ownership and availability are rechecked at submission, even for saved drafts.
		return this.inquiryModel.create({ ...defined(input), clientId: currentUser._id });
	}

	public async updateInquiry(currentUser: User, input: UpdateInquiryInput) {
		const { inquiry, isClient } = await this.participant(currentUser, input.inquiryId);
		check(isClient && inquiry.status === InquiryStatus.DRAFT, 'Only the client can edit an inquiry draft');
		check(!input.clearService || input.serviceId === undefined, 'Choose a service or clear it, not both');
		const { inquiryId: _inquiryId, expectedVersion, clearService, ...fields } = input;
		const patch = defined(fields);
		this.validateBudget({
			budgetMin: patch.budgetMin ?? inquiry.budgetMin,
			budgetMax: patch.budgetMax ?? inquiry.budgetMax,
		});
		const result = await this.inquiryModel.findOneAndUpdate(
			{ _id: inquiry._id, clientId: currentUser._id, status: InquiryStatus.DRAFT, version: expectedVersion },
			{ $set: patch, $inc: { version: 1 }, ...(clearService ? { $unset: { serviceId: 1 } } : {}) },
			{ new: true, runValidators: true },
		);
		return result ?? versionConflict();
	}

	public async deleteDraft(currentUser: User, input: InquiryVersionInput) {
		const { inquiry, isClient } = await this.participant(currentUser, input.inquiryId);
		check(isClient && inquiry.status === InquiryStatus.DRAFT, 'Only draft inquiries can be deleted');
		const result = await this.inquiryModel.deleteOne({
			_id: inquiry._id,
			version: input.expectedVersion,
			status: InquiryStatus.DRAFT,
		});
		if (!result.deletedCount) versionConflict();
		return true;
	}

	public async getInquiry(currentUser: User, id: string) {
		return (await this.participant(currentUser, id)).inquiry;
	}

	public async getInquiries(currentUser: User, creatorInbox: boolean, input: PageInput) {
		requireActive(currentUser);
		const { offset, limit } = page(input);
		const creator = creatorInbox ? await this.profileModel.findOne({ userId: currentUser._id }) : null;
		if (creatorInbox && !creator) return { list: [], metaCounter: [] };
		const query = this.inquiryModel.find(
			creatorInbox ? { creatorId: creator!._id, status: { $ne: InquiryStatus.DRAFT } } : { clientId: currentUser._id },
		);
		const [list, total] = await Promise.all([
			query.clone().sort({ updatedAt: -1, _id: -1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list, metaCounter: total ? [{ total }] : [] };
	}

	public async getMessages(currentUser: User, id: string, input: PageInput) {
		const { inquiry } = await this.participant(currentUser, id);
		const { offset, limit } = page(input);
		const query = this.messageModel.find({ inquiryId: inquiry._id });
		const [list, total] = await Promise.all([
			query.clone().sort({ createdAt: 1, _id: 1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list, metaCounter: total ? [{ total }] : [] };
	}

	public async getEvents(currentUser: User, id: string, input: PageInput) {
		const { inquiry } = await this.participant(currentUser, id);
		const { offset, limit } = page(input);
		const query = this.eventModel.find({ inquiryId: inquiry._id });
		const [list, total] = await Promise.all([
			query.clone().sort({ version: 1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list, metaCounter: total ? [{ total }] : [] };
	}

	public async markMessageRead(currentUser: User, id: string) {
		const message = requireRecord(await this.messageModel.findById(shapeIntoMongooseObjectId(id)));
		await this.participant(currentUser, String(message.inquiryId));
		check(!sameId(message.senderId, currentUser._id), 'You cannot mark your own message as read');
		await this.messageModel.updateOne(
			{ _id: message._id, readAt: { $exists: false } },
			{ $set: { readAt: new Date() } },
		);
		return true;
	}

	private async recordEvent(
		inquiry: Inquiry,
		currentUser: User,
		otherId: Types.ObjectId,
		fromStatus: InquiryStatus,
		type: InquiryEventType,
		session: ClientSession,
		messageId?: Types.ObjectId,
	) {
		const [event] = await this.eventModel.create(
			[
				{
					inquiryId: inquiry._id,
					performedById: currentUser._id,
					type,
					fromStatus,
					toStatus: inquiry.status,
					version: inquiry.version,
					...(messageId ? { messageId } : {}),
				},
			],
			{ session },
		);
		await this.notificationModel.create([{ recipientId: otherId, inquiryEventId: event._id }], { session });
	}

	public async submitInquiry(currentUser: User, input: InquiryVersionInput) {
		return this.connection.transaction(async (session) => {
			const { inquiry, isClient, otherId } = await this.participant(currentUser, input.inquiryId, session);
			check(isClient, 'Only the client can submit the inquiry');
			if (inquiry.status !== InquiryStatus.DRAFT) return inquiry;
			const status = nextInquiryStatus(inquiry.status, 'SUBMIT', isClient);
			check(
				inquiry.subject && inquiry.brief && inquiry.brief.length >= 20,
				'Add a subject and a brief of at least 20 characters',
			);
			check(
				!inquiry.desiredDeadline || inquiry.desiredDeadline.getTime() > Date.now(),
				'The desired deadline must be in the future',
			);
			this.validateBudget(inquiry);
			const creator = await this.visibility.profile(inquiry.creatorId, session);
			check(
				!sameId(creator.userId, currentUser._id) && creator.availability !== CreatorAvailability.UNAVAILABLE,
				'This creator is not accepting inquiries',
			);
			let serviceSnapshot;
			if (inquiry.serviceId) {
				const service = await this.services.forSubmission(inquiry.serviceId, inquiry.creatorId, session);
				serviceSnapshot = defined({
					title: service.title,
					pricingType: service.pricingType,
					startingPrice: service.startingPrice,
					currency: service.currency,
					estimatedDays: service.estimatedDays,
					deliverables: [...service.deliverables],
				});
			}
			const updated = await this.inquiryModel.findOneAndUpdate(
				{ _id: inquiry._id, version: input.expectedVersion, status: InquiryStatus.DRAFT },
				{
					$set: { status, submittedAt: new Date(), ...(serviceSnapshot ? { serviceSnapshot } : {}) },
					$inc: { version: 1 },
				},
				{ new: true, session, runValidators: true },
			);
			if (!updated) versionConflict();
			await this.recordEvent(updated, currentUser, otherId, inquiry.status, InquiryEventType.SUBMITTED, session);
			return updated;
		});
	}

	private matchRetry(message: InquiryMessage, input: SendMessageInput) {
		if (!sameId(message.inquiryId, input.inquiryId) || message.body !== input.body)
			throw new ConflictException('This message key was already used for different content');
		return message;
	}

	public async sendMessage(currentUser: User, input: SendMessageInput) {
		try {
			return await this.connection.transaction(async (session) => {
				const { inquiry, isClient, otherId } = await this.participant(currentUser, input.inquiryId, session);
				const previous = await this.messageModel
					.findOne({ senderId: currentUser._id, clientMessageKey: input.clientMessageKey })
					.session(session);
				if (previous) return this.matchRetry(previous, input);
				const status = nextInquiryStatus(inquiry.status, 'MESSAGE', isClient);
				const [message] = await this.messageModel.create(
					[
						{
							inquiryId: inquiry._id,
							senderId: currentUser._id,
							clientMessageKey: input.clientMessageKey,
							body: input.body,
						},
					],
					{ session },
				);
				const updated = await this.inquiryModel.findOneAndUpdate(
					{ _id: inquiry._id, version: input.expectedVersion, status: inquiry.status },
					{ $set: { status, lastMessageAt: message.createdAt }, $inc: { version: 1 } },
					{ new: true, session },
				);
				if (!updated) versionConflict();
				await this.recordEvent(
					updated,
					currentUser,
					otherId,
					inquiry.status,
					InquiryEventType.MESSAGE_SENT,
					session,
					message._id,
				);
				return message;
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
			await this.participant(currentUser, input.inquiryId);
			const previous = await this.messageModel.findOne({
				senderId: currentUser._id,
				clientMessageKey: input.clientMessageKey,
			});
			if (!previous) throw error;
			return this.matchRetry(previous, input);
		}
	}

	public async finishInquiry(
		currentUser: User,
		input: InquiryVersionInput | CloseInquiryInput,
		action: 'DECLINE' | 'CANCEL' | 'CLOSE',
	) {
		return this.connection.transaction(async (session) => {
			const { inquiry, isClient, otherId } = await this.participant(currentUser, input.inquiryId, session);
			const outcome = 'outcome' in input ? input.outcome : undefined;
			const status = nextInquiryStatus(inquiry.status, action, isClient, outcome, inquiry.submittedAt);
			const updated = await this.inquiryModel.findOneAndUpdate(
				{ _id: inquiry._id, version: input.expectedVersion, status: inquiry.status },
				{
					$set: { status, closedAt: new Date(), closedById: currentUser._id, ...(outcome ? { outcome } : {}) },
					$inc: { version: 1 },
				},
				{ new: true, session, runValidators: true },
			);
			if (!updated) versionConflict();
			const event =
				action === 'CLOSE'
					? InquiryEventType.CLOSED
					: action === 'CANCEL'
						? InquiryEventType.CANCELLED
						: InquiryEventType.DECLINED;
			await this.recordEvent(updated, currentUser, otherId, inquiry.status, event, session);
			return updated;
		});
	}
}
