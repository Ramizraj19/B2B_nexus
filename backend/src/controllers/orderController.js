import { Order, OrderStatus } from '../models/Order.js';
import { Product } from '../models/Product.js';

export async function createOrder(req, res) {
	try {
		const buyerId = req.user._id;
		const { items, sellerId, shippingAddress } = req.body;
		if (!items?.length || !sellerId) return res.status(400).json({ message: 'Missing items or sellerId' });

		const productIds = items.map(i => i.product);
		const products = await Product.find({ _id: { $in: productIds }, seller: sellerId, isActive: true });
		const productMap = new Map(products.map(p => [String(p._id), p]));

		let subtotal = 0;
		const orderItems = [];
		for (const item of items) {
			const prod = productMap.get(String(item.product));
			if (!prod) return res.status(400).json({ message: `Product not available: ${item.product}` });
			if (prod.stock < item.quantity) return res.status(400).json({ message: `Insufficient stock for ${prod.name}` });
			subtotal += prod.price * item.quantity;
			orderItems.push({ product: prod._id, name: prod.name, quantity: item.quantity, price: prod.price });
		}
		const total = subtotal;

		const order = await Order.create({
			buyer: buyerId,
			seller: sellerId,
			items: orderItems,
			subtotal,
			total,
			shippingAddress,
		});
		res.status(201).json(order);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function listMyOrders(req, res) {
	try {
		const filter = { buyer: req.user._id };
		const orders = await Order.find(filter).sort({ createdAt: -1 });
		res.json(orders);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function listSellerOrders(req, res) {
	try {
		const filter = { seller: req.user._id };
		const orders = await Order.find(filter).sort({ createdAt: -1 });
		res.json(orders);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function updateOrderStatus(req, res) {
	try {
		const { id } = req.params;
		const { status } = req.body;
		if (!Object.values(OrderStatus).includes(status)) return res.status(400).json({ message: 'Invalid status' });
		const order = await Order.findOneAndUpdate({ _id: id, seller: req.user._id }, { status }, { new: true });
		if (!order) return res.status(404).json({ message: 'Order not found' });
		res.json(order);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}