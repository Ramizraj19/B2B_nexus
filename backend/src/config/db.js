import mongoose from 'mongoose';

export async function connectToDatabase(mongoUri) {
	if (!mongoUri) {
		throw new Error('MONGODB_URI is not defined');
	}

	mongoose.set('strictQuery', true);

	try {
		await mongoose.connect(mongoUri, {
			serverSelectionTimeoutMS: 10000,
		});
		return mongoose.connection;
	} catch (error) {
		throw error;
	}
}