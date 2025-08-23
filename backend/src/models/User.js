import mongoose from 'mongoose';

export const UserRoles = Object.freeze({
	ADMIN: 'admin',
	SELLER: 'seller',
	BUYER: 'buyer',
});

const userSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		email: { type: String, required: true, unique: true, lowercase: true, index: true },
		passwordHash: { type: String, required: true },
		role: { type: String, enum: Object.values(UserRoles), default: UserRoles.BUYER, index: true },
		storeName: { type: String, trim: true },
		storeDescription: { type: String, trim: true },
		isActive: { type: Boolean, default: true },
	},
	{ timestamps: true }
);

userSchema.methods.toJSON = function toJSON() {
	const obj = this.toObject({ versionKey: false });
	delete obj.passwordHash;
	return obj;
};

export const User = mongoose.model('User', userSchema);