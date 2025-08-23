import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
	{
		seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		name: { type: String, required: true, trim: true },
		altNames: { type: [String], default: [] },
		description: { type: String, trim: true },
		price: { type: Number, required: true, min: 0 },
		stock: { type: Number, required: true, min: 0 },
		images: { type: [String], default: [] },
		category: { type: String, index: true },
		tags: { type: [String], default: [], index: true },
		filters: { type: Map, of: String, default: {} },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', altNames: 'text', tags: 'text' });

export const Product = mongoose.model('Product', productSchema);