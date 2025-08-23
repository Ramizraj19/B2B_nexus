import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

export async function hashPassword(plain) {
	const salt = await bcrypt.genSalt(10);
	return bcrypt.hash(plain, salt);
}

export async function comparePassword(plain, hash) {
	return bcrypt.compare(plain, hash);
}

export function generateJwtToken(userId, role) {
	const secret = process.env.JWT_SECRET;
	return jwt.sign({ sub: userId, role }, secret, { expiresIn: '7d' });
}

export async function requireAuth(req, res, next) {
	try {
		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (!token) {
			return res.status(401).json({ message: 'Authentication required' });
		}
		const payload = jwt.verify(token, process.env.JWT_SECRET);
		req.user = await User.findById(payload.sub).select('-passwordHash');
		if (!req.user) {
			return res.status(401).json({ message: 'Invalid token user' });
		}
		next();
	} catch (err) {
		return res.status(401).json({ message: 'Invalid or expired token' });
	}
}

export function requireRoles(...roles) {
	return (req, res, next) => {
		if (!req.user || !roles.includes(req.user.role)) {
			return res.status(403).json({ message: 'Forbidden' });
		}
		next();
	};
}