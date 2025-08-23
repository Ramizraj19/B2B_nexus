import { User, UserRoles } from '../models/User.js';
import { comparePassword, generateJwtToken, hashPassword } from '../middleware/auth.js';

export async function register(req, res) {
	try {
		const { name, email, password, role } = req.body;
		if (!name || !email || !password) {
			return res.status(400).json({ message: 'Missing required fields' });
		}
		const existing = await User.findOne({ email });
		if (existing) {
			return res.status(409).json({ message: 'Email already registered' });
		}
		const passwordHash = await hashPassword(password);
		const user = await User.create({ name, email, passwordHash, role: role || UserRoles.BUYER });
		const token = generateJwtToken(user._id, user.role);
		return res.status(201).json({ token, user });
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
}

export async function login(req, res) {
	try {
		const { email, password } = req.body;
		const user = await User.findOne({ email });
		if (!user) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}
		const ok = await comparePassword(password, user.passwordHash);
		if (!ok) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}
		const token = generateJwtToken(user._id, user.role);
		return res.json({ token, user });
	} catch (err) {
		return res.status(500).json({ message: err.message });
	}
}

export async function me(req, res) {
	return res.json({ user: req.user });
}