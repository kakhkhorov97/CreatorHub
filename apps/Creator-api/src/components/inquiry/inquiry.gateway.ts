import { BadRequestException, HttpException, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	OnGatewayInit,
	SubscribeMessage,
	WebSocketGateway,
} from '@nestjs/websockets';
import { plainToInstance } from 'class-transformer';
import { IsMongoId, validate } from 'class-validator';
import { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import { SendMessageInput } from '../../libs/dto/inquiry/inquiry.input';
import { InquiryRealtimeService } from './inquiry-realtime.service';
import { InquiryService } from './inquiry.service';

class InquiryRoomInput {
	@IsMongoId()
	inquiryId!: string;
}

@WebSocketGateway({
	namespace: '/messaging',
	transports: ['websocket'],
	maxHttpBufferSize: 32768,
	allowRequest: (request, callback) =>
		callback(null, !request.headers.origin || request.headers.origin === process.env.FRONTEND_URL),
})
export class InquiryGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
	private readonly expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

	private readonly limits = new Map<string, { count: number; expires: number }>();

	constructor(
		private readonly auth: AuthService,
		private readonly inquiries: InquiryService,
		private readonly realtime: InquiryRealtimeService,
	) {}

	public afterInit(server: Namespace) {
		this.realtime.bind(server);
		server.use(async (socket, next) => {
			try {
				const token: unknown = socket.handshake.auth?.token;
				if (typeof token !== 'string' || token.length > 4096) throw new UnauthorizedException();
				const { user, expiresAt } = await this.auth.authenticate(token);
				socket.data.token = token;
				socket.data.userId = String(user._id);
				socket.data.expiresAt = expiresAt;
				next();
			} catch {
				const error = new Error('Sign in again to connect to messages.') as Error & { data: { code: string } };
				error.data = { code: 'UNAUTHENTICATED' };
				next(error);
			}
		});
	}

	public async handleConnection(socket: Socket) {
		await socket.join(`account:${socket.data.userId}`);
		this.expiryTimers.set(
			socket.id,
			setTimeout(
				() => {
					socket.emit('session:expired');
					socket.disconnect(true);
				},
				Math.max(0, socket.data.expiresAt - Date.now()),
			),
		);
		socket.emit('messaging:ready');
	}

	public handleDisconnect(socket: Socket) {
		clearTimeout(this.expiryTimers.get(socket.id));
		this.expiryTimers.delete(socket.id);
	}

	public onModuleDestroy() {
		for (const timer of this.expiryTimers.values()) clearTimeout(timer);
		this.expiryTimers.clear();
		this.limits.clear();
	}

	private async validate<T extends object>(type: new () => T, payload: unknown) {
		if (!payload || typeof payload !== 'object' || Array.isArray(payload))
			throw new BadRequestException('Invalid message request.');
		const input = plainToInstance(type, payload);
		if ((await validate(input, { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true })).length)
			throw new BadRequestException('Invalid message request.');
		return input;
	}

	private async perform(
		socket: Socket,
		action: (user: Awaited<ReturnType<AuthService['authenticate']>>['user']) => Promise<unknown>,
	) {
		try {
			const { user } = await this.auth.authenticate(socket.data.token);
			const now = Date.now();
			for (const [key, window] of this.limits) if (window.expires <= now) this.limits.delete(key);
			let window = this.limits.get(socket.data.userId);
			if (!window) {
				window = { count: 0, expires: now + 60000 };
				this.limits.set(socket.data.userId, window);
			}
			if (++window.count > 120) throw new HttpException('Too many requests. Try again shortly.', 429);
			return { ok: true, data: await action(user) };
		} catch (cause) {
			const status = cause instanceof HttpException ? cause.getStatus() : 500;
			const error = {
				code: status === 401 ? 'UNAUTHENTICATED' : String(status),
				message: cause instanceof HttpException ? cause.message : 'Could not complete the message request. Try again.',
			};
			if (status === 401) {
				socket.emit(Date.now() >= socket.data.expiresAt ? 'session:expired' : 'session:invalid');
				socket.disconnect(true);
			}
			return { ok: false, error };
		}
	}

	@SubscribeMessage('inquiry:join')
	public join(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) {
		return this.perform(socket, async (user) => {
			const input = await this.validate(InquiryRoomInput, payload);
			await this.inquiries.authorizeRoom(user, input.inquiryId);
			for (const room of socket.rooms) if (room.startsWith('inquiry:')) await socket.leave(room);
			await socket.join(`inquiry:${input.inquiryId}`);
			return { inquiryId: input.inquiryId };
		});
	}

	@SubscribeMessage('inquiry:leave')
	public leave(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) {
		return this.perform(socket, async () => {
			const input = await this.validate(InquiryRoomInput, payload);
			await socket.leave(`inquiry:${input.inquiryId}`);
			return { inquiryId: input.inquiryId };
		});
	}

	@SubscribeMessage('message:send')
	public send(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) {
		return this.perform(socket, async (user) =>
			this.inquiries.sendMessage(user, await this.validate(SendMessageInput, payload)),
		);
	}
}
