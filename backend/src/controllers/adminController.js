import { User } from '../models/User.js';
import { Product } from '../models/Product.js';
import { Order } from '../models/Order.js';

export async function adminStats(req, res) {
	try {
		const [totalUsers, totalProducts, totalOrders] = await Promise.all([
			User.countDocuments({}),
			Product.countDocuments({}),
			Order.countDocuments({}),
		]);
		res.json({ totalUsers, totalProducts, totalOrders });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function listUsers(req, res) {
	const users = await User.find({}).sort({ createdAt: -1 }).limit(200);
	res.json(users);
}

export async function listProductsAdmin(req, res) {
	const products = await Product.find({}).sort({ createdAt: -1 }).limit(200);
	res.json(products);
}

export async function listOrdersAdmin(req, res) {
	const orders = await Order.find({}).sort({ createdAt: -1 }).limit(200);
	res.json(orders);
}