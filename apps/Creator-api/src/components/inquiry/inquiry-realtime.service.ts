import { Injectable, Logger } from '@nestjs/common';
import { Namespace } from 'socket.io';
import { AuthService } from '../auth/auth.service';

export type InquiryChange = {
	inquiryId: string;
	kind: 'message' | 'inquiry' | 'read';
	version: number;
	message?: unknown;
};

@Injectable()
export class InquiryRealtimeService {
	private server?: Namespace;

	private readonly logger = new Logger(InquiryRealtimeService.name);

	constructor(private readonly auth: AuthService) {}

	public bind(server: Namespace) {
		this.server = server;
	}

	public async publish(change: InquiryChange, userIds: string[]) {
		const server = this.server;
		if (!server) return;
		const targets = Array.from(server.sockets.values()).filter((socket) => userIds.includes(socket.data.userId));
		const valid = await Promise.all(
			targets.map(async (socket) => {
				try {
					const { user } = await this.auth.authenticate(socket.data.token);
					if (String(user._id) !== socket.data.userId || !socket.connected) return null;
					return socket;
				} catch {
					socket.emit(Date.now() >= socket.data.expiresAt ? 'session:expired' : 'session:invalid');
					socket.disconnect(true);
					return null;
				}
			}),
		);
		const sockets = valid.filter((socket) => socket !== null);
		const inboxIds = sockets
			.filter((socket) => socket.rooms.has(`account:${socket.data.userId}`))
			.map((socket) => socket.id);
		const conversationIds = sockets
			.filter((socket) => socket.rooms.has(`inquiry:${change.inquiryId}`))
			.map((socket) => socket.id);
		if (inboxIds.length)
			server
				.to(inboxIds)
				.emit('inbox:changed', { inquiryId: change.inquiryId, kind: change.kind, version: change.version });
		if (conversationIds.length) server.to(conversationIds).emit('inquiry:changed', change);
	}

	public failedToPublish() {
		// The database commit is authoritative. A failed live delivery is recovered by reloading on reconnect.
		this.logger.warn('A saved inquiry update could not be delivered live.');
	}
}
