import { Router } from 'express';
import { adminStats, listOrdersAdmin, listProductsAdmin, listUsers } from '../controllers/adminController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { UserRoles } from '../models/User.js';

const router = Router();

router.use(requireAuth, requireRoles(UserRoles.ADMIN));

router.get('/stats', adminStats);
router.get('/users', listUsers);
router.get('/products', listProductsAdmin);
router.get('/orders', listOrdersAdmin);

export default router;