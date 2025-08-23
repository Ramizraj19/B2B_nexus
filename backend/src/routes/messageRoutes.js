import { Router } from 'express';
import { fetchConversation, sendMessage } from '../controllers/messageController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/with/:withUserId', requireAuth, fetchConversation);
router.post('/', requireAuth, sendMessage);

export default router;