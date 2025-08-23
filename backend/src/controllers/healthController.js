export const healthCheck = (req, res) => {
	res.status(200).json({ status: 'ok', uptime: process.uptime() });
};