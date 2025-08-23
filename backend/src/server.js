import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import http from 'http';

import { connectToDatabase } from './config/db.js';
import apiRouter from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { createSocketServer } from './sockets/index.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV !== 'production') {
	app.use(morgan('dev'));
}

app.get('/', (req, res) => {
	res.json({ name: 'B2B Nexus API', version: '1.0.0' });
});

app.use('/api', apiRouter);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

(async () => {
	try {
		const skipDb = String(process.env.SKIP_DB || '').toLowerCase() === 'true';
		if (!skipDb) {
			const mongoUri = process.env.MONGODB_URI;
			await connectToDatabase(mongoUri);
		} else {
			console.warn('Starting server with SKIP_DB=true (no database connection)');
		}
		createSocketServer(server, process.env.CORS_ORIGIN?.split(',') || '*');
		server.listen(PORT, () => {
			console.log(`Server running on port ${PORT}`);
		});
	} catch (error) {
		console.error('Failed to start server:', error.message);
		process.exit(1);
	}
})();