import { Router } from 'express';
import { createOrder, listMyOrders, listSellerOrders, updateOrderStatus } from '../controllers/orderController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { UserRoles } from '../models/User.js';

const router = Router();

router.post('/', requireAuth, requireRoles(UserRoles.BUYER), createOrder);
router.get('/me', requireAuth, requireRoles(UserRoles.BUYER), listMyOrders);
router.get('/seller', requireAuth, requireRoles(UserRoles.SELLER, UserRoles.ADMIN), listSellerOrders);
router.patch('/:id/status', requireAuth, requireRoles(UserRoles.SELLER, UserRoles.ADMIN), updateOrderStatus);

export default router;