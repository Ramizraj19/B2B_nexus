import { Product } from '../models/Product.js';

export async function createProduct(req, res) {
	try {
		const sellerId = req.user._id;
		const { name, altNames, description, price, stock, images, category, tags, filters } = req.body;
		const product = await Product.create({
			seller: sellerId,
			name,
			altNames: altNames || [],
			description,
			price,
			stock,
			images: images || [],
			category,
			tags: tags || [],
			filters: filters || {},
		});
		res.status(201).json(product);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function updateProduct(req, res) {
	try {
		const { id } = req.params;
		const updated = await Product.findOneAndUpdate({ _id: id, seller: req.user._id }, req.body, { new: true });
		if (!updated) return res.status(404).json({ message: 'Product not found' });
		res.json(updated);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function deleteProduct(req, res) {
	try {
		const { id } = req.params;
		const deleted = await Product.findOneAndDelete({ _id: id, seller: req.user._id });
		if (!deleted) return res.status(404).json({ message: 'Product not found' });
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function getProduct(req, res) {
	try {
		const { id } = req.params;
		const product = await Product.findById(id).populate('seller', 'name storeName');
		if (!product) return res.status(404).json({ message: 'Not found' });
		res.json(product);
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}

export async function listProducts(req, res) {
	try {
		const {
			q,
			category,
			tags,
			minPrice,
			maxPrice,
			page = 1,
			limit = 20,
		} = req.query;

		const filter = { isActive: true };
		if (category) filter.category = category;
		if (tags) filter.tags = { $in: (Array.isArray(tags) ? tags : String(tags).split(',')) };
		if (minPrice || maxPrice) filter.price = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };
		if (q) filter.$text = { $search: q };

		const pageNum = Number(page) || 1;
		const limitNum = Math.min(Number(limit) || 20, 100);
		const skip = (pageNum - 1) * limitNum;

		const [items, total] = await Promise.all([
			Product.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
			Product.countDocuments(filter),
		]);

		res.json({ items, total, page: pageNum, pages: Math.ceil(total / limitNum) });
	} catch (err) {
		res.status(500).json({ message: err.message });
	}
}