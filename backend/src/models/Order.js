import mongoose from 'mongoose';

export const OrderStatus = Object.freeze({
	PENDING: 'pending',
	PAID: 'paid',
	SHIPPED: 'shipped',
	DELIVERED: 'delivered',
	CANCELLED: 'cancelled',
});

const orderItemSchema = new mongoose.Schema(
	{
		product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
		name: { type: String, required: true },
		quantity: { type: Number, required: true, min: 1 },
		price: { type: Number, required: true, min: 0 },
	},
	{ _id: false }
);

const orderSchema = new mongoose.Schema(
	{
		buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
		items: { type: [orderItemSchema], required: true },
		subtotal: { type: Number, required: true, min: 0 },
		total: { type: Number, required: true, min: 0 },
		currency: { type: String, default: 'USD' },
		paymentId: { type: String },
		paymentStatus: { type: String, default: 'unpaid' },
		status: { type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING, index: true },
		shippingAddress: {
			name: String,
			line1: String,
			line2: String,
			city: String,
			state: String,
			postalCode: String,
			country: String,
			phone: String,
		},
	},
	{ timestamps: true }
);

export const Order = mongoose.model('Order', orderSchema);