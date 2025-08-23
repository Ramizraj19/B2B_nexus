import { Server } from 'socket.io';
import { Message } from '../models/Message.js';

export function createSocketServer(httpServer, corsOrigins) {
	const io = new Server(httpServer, {
		cors: { origin: corsOrigins || '*' },
	});

	const userIdToSocketIds = new Map();

	io.on('connection', socket => {
		const { userId } = socket.handshake.query;
		if (userId) {
			const list = userIdToSocketIds.get(userId) || new Set();
			list.add(socket.id);
			userIdToSocketIds.set(userId, list);
		}

		socket.on('send_message', async ({ toUserId, content }) => {
			if (!userId || !toUserId || !content) return;
			const message = await Message.create({ participants: [userId, toUserId], sender: userId, content });
			const targets = [toUserId, userId];
			targets.forEach(uid => {
				const ids = userIdToSocketIds.get(uid);
				if (ids) ids.forEach(id => io.to(id).emit('new_message', message));
			});
		});

		socket.on('disconnect', () => {
			if (userId) {
				const list = userIdToSocketIds.get(userId);
				if (list) {
					list.delete(socket.id);
					if (list.size === 0) userIdToSocketIds.delete(userId);
				}
			}
		});
	});

	return io;
}