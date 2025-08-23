import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
	{
		participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
		sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		content: { type: String, required: true },
		order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
		readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
	},
	{ timestamps: true }
);

messageSchema.index({ participants: 1, createdAt: -1 });

export const Message = mongoose.model('Message', messageSchema);