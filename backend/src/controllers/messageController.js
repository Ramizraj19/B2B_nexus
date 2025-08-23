import { Message } from '../models/Message.js';

export async function fetchConversation(req, res) {
	try {
		const { withUserId } = req.params;
		const myId = String(req.user._id);
		const otherId = String(withUserId);
		const messages = await Message.find({ participants: { $all: [myId, otherId] } })
			.sort({ createdAt: 1 })
			.limit(200);
		res.json(messages);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function sendMessage(req, res) {
	try {
		const { toUserId, content } = req.body;
		if (!toUserId || !content) return res.status(400).json({ message: 'toUserId and content required' });
		const message = await Message.create({
			participants: [req.user._id, toUserId],
			sender: req.user._id,
			content,
		});
		res.status(201).json(message);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}