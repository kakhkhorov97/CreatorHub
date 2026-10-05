import { InquiryOutcome } from '../../libs/enums/inquiry-outcome.enum';
import { ServiceFeedback } from '../../libs/dto/inquiry/service-feedback';
import { SendInquiryInput, CreateServiceFeedbackInput } from '../../libs/dto/inquiry/inquiry.input';
import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, FilterQuery, HydratedDocument, Model, Types } from 'mongoose';
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
		@InjectModel('ServiceFeedback') private readonly feedbackModel: Model<ServiceFeedback>,
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
		const { inquiry } = await this.participant(currentUser, id);
		return (await this.inboxOutput(currentUser, [inquiry]))[0];
	}

	public async getInquiries(currentUser: User, creatorInbox: boolean, input: PageInput, allConversations = false) {
		requireActive(currentUser);
		const { offset, limit } = page(input);
		const creator =
			creatorInbox || allConversations ? await this.profileModel.findOne({ userId: currentUser._id }) : null;
		if (creatorInbox && !allConversations && !creator) return { list: [], metaCounter: [] };
		const received: FilterQuery<Inquiry> = { creatorId: creator?._id, status: { $ne: InquiryStatus.DRAFT } };
		const sent: FilterQuery<Inquiry> = { clientId: currentUser._id };
		const filter: FilterQuery<Inquiry> = allConversations
			? { $or: creator ? [sent, received] : [sent] }
			: creatorInbox
				? received
				: sent;
		const query = this.inquiryModel.find(filter);
		const [list, total] = await Promise.all([
			query.clone().sort({ updatedAt: -1, _id: -1 }).skip(offset).limit(limit),
			query.countDocuments(),
		]);
		return { list: await this.inboxOutput(currentUser, list), metaCounter: total ? [{ total }] : [] };
	}

	private async unreadByInquiry(currentUser: User) {
		requireActive(currentUser);
		return this.notificationModel.aggregate<{ _id: Types.ObjectId; count: number }>([
			{ $match: { recipientId: currentUser._id, inboxReadAt: { $exists: false }, inquiryEventId: { $exists: true } } },
			{
				$lookup: {
					from: this.eventModel.collection.name,
					localField: 'inquiryEventId',
					foreignField: '_id',
					as: 'event',
				},
			},
			{ $unwind: '$event' },
			{ $match: { 'event.type': { $in: [InquiryEventType.SUBMITTED, InquiryEventType.MESSAGE_SENT] } } },
			{ $group: { _id: '$event.inquiryId', count: { $sum: 1 } } },
		]);
	}

	public async unreadCount(currentUser: User) {
		return (await this.unreadByInquiry(currentUser)).length;
	}

	private async inboxOutput(currentUser: User, rows: HydratedDocument<Inquiry>[]) {
		const profiles = await this.profileModel.find({ _id: { $in: rows.map((row) => row.creatorId) } });
		const owners = new Map(profiles.map((profile) => [String(profile._id), profile.userId]));
		const ids = rows.map((row) =>
			sameId(row.clientId, currentUser._id) ? owners.get(String(row.creatorId)) : row.clientId,
		);
		const [users, unread] = await Promise.all([
			this.userModel.find({ _id: { $in: ids.filter(Boolean) } }),
			this.unreadByInquiry(currentUser),
		]);
		return rows.map((row, index) => {
			const user = users.find((candidate) => ids[index] && sameId(candidate._id, ids[index]!));
			return {
				...row.toObject(),
				counterpartyName: user?.displayName || 'Former member',
				counterpartyAvatarUrl: user?.avatarUrl,
				unreadCount: unread.find((item) => sameId(item._id, row._id))?.count || 0,
			};
		});
	}

	public async markInquiryRead(currentUser: User, input: InquiryVersionInput) {
		const { inquiry } = await this.participant(currentUser, input.inquiryId);
		check(input.expectedVersion <= inquiry.version, 'Cannot read a future inquiry version');
		// Bound the acknowledgement to the version rendered by the viewer. Later replies stay unread.
		const events = await this.eventModel.find({
			inquiryId: inquiry._id,
			version: { $lte: input.expectedVersion },
			performedById: { $ne: currentUser._id },
		});
		const now = new Date();
		await this.notificationModel.updateMany(
			{
				recipientId: currentUser._id,
				inquiryEventId: { $in: events.map((event) => event._id) },
				inboxReadAt: { $exists: false },
			},
			{ $set: { inboxReadAt: now, readAt: now } },
		);
		await this.messageModel.updateMany(
			{
				inquiryId: inquiry._id,
				senderId: { $ne: currentUser._id },
				_id: { $in: events.map((event) => event.messageId).filter(Boolean) },
				readAt: { $exists: false },
			},
			{ $set: { readAt: now } },
		);
		return true;
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
		return this.connection.transaction((session) => this.submitInSession(currentUser, input, session));
	}

	private async submitInSession(currentUser: User, input: InquiryVersionInput, session: ClientSession) {
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
	}

	public async sendInquiry(currentUser: User, input: SendInquiryInput) {
		requireActive(currentUser);
		try {
			return await this.connection.transaction(async (session) => {
				const existing = await this.inquiryModel
					.findOne({ clientId: currentUser._id, clientRequestKey: input.clientRequestKey })
					.session(session);
				if (existing) return existing;
				const [inquiry] = await this.inquiryModel.create([{ ...defined(input), clientId: currentUser._id }], {
					session,
				});
				return this.submitInSession(currentUser, { inquiryId: String(inquiry._id), expectedVersion: 0 }, session);
			});
		} catch (error) {
			if (!duplicateKey(error)) throw error;
			return requireRecord(
				await this.inquiryModel.findOne({ clientId: currentUser._id, clientRequestKey: input.clientRequestKey }),
			);
		}
	}

	public async completeInquiry(currentUser: User, input: InquiryVersionInput) {
		return this.connection.transaction(async (session) => {
			const { inquiry, isClient, otherId } = await this.participant(currentUser, input.inquiryId, session);
			check(
				isClient && inquiry.status === InquiryStatus.CLOSED && inquiry.outcome === InquiryOutcome.AGREED_TO_PROCEED,
				'Only the customer can mark agreed work completed',
			);
			const updated = await this.inquiryModel.findOneAndUpdate(
				{ _id: inquiry._id, version: input.expectedVersion, outcome: InquiryOutcome.AGREED_TO_PROCEED },
				{ $set: { outcome: InquiryOutcome.COMPLETED }, $inc: { version: 1 } },
				{ new: true, session, runValidators: true },
			);
			if (!updated) versionConflict();
			await this.recordEvent(updated, currentUser, otherId, inquiry.status, InquiryEventType.COMPLETED, session);
			return updated;
		});
	}

	private async feedbackOutput(feedback: HydratedDocument<ServiceFeedback>) {
		const author = await this.userModel.findById(feedback.clientId);
		return {
			...feedback.toObject(),
			authorName: author?.status === UserStatus.ACTIVE ? author.displayName : 'Former customer',
		};
	}

	public async createFeedback(currentUser: User, input: CreateServiceFeedbackInput) {
		return this.connection.transaction(async (session) => {
			const { inquiry, isClient } = await this.participant(currentUser, input.inquiryId, session);
			check(
				isClient && inquiry.status === InquiryStatus.CLOSED && inquiry.outcome === InquiryOutcome.COMPLETED,
				'Only the customer can review completed work',
			);
			check(
				!(await this.feedbackModel.exists({ inquiryId: inquiry._id }).session(session)),
				'You already reviewed this work',
			);
			// Lock this engagement against concurrent review submissions.
			const locked = await this.inquiryModel.updateOne(
				{ _id: inquiry._id, version: inquiry.version },
				{ $inc: { version: 1 } },
				{ session },
			);
			if (!locked.modifiedCount) versionConflict();
			const [feedback] = await this.feedbackModel.create(
				[
					{
						inquiryId: inquiry._id,
						clientId: currentUser._id,
						creatorId: inquiry.creatorId,
						serviceId: inquiry.serviceId,
						rating: input.rating,
						feedback: input.feedback,
					},
				],
				{ session },
			);
			return { ...feedback.toObject(), authorName: currentUser.displayName };
		});
	}

	public async myFeedback(currentUser: User, inquiryId: string) {
		const { inquiry } = await this.participant(currentUser, inquiryId);
		const feedback = await this.feedbackModel.findOne({ inquiryId: inquiry._id });
		return feedback ? this.feedbackOutput(feedback) : null;
	}

	public async creatorFeedback(creatorId: string, input: PageInput) {
		await this.visibility.profile(shapeIntoMongooseObjectId(creatorId));
		const { offset, limit } = page(input);
		const filter = { creatorId: shapeIntoMongooseObjectId(creatorId) };
		const rows = await this.feedbackModel.find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit);
		return {
			list: await Promise.all(rows.map((row) => this.feedbackOutput(row))),
			metaCounter: [{ total: await this.feedbackModel.countDocuments(filter) }],
		};
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
