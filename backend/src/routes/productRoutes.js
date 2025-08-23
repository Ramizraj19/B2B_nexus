import { Router } from 'express';
import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from '../controllers/productController.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { UserRoles } from '../models/User.js';

const router = Router();

router.get('/', listProducts);
router.get('/:id', getProduct);

router.post('/', requireAuth, requireRoles(UserRoles.SELLER, UserRoles.ADMIN), createProduct);
router.put('/:id', requireAuth, requireRoles(UserRoles.SELLER, UserRoles.ADMIN), updateProduct);
router.delete('/:id', requireAuth, requireRoles(UserRoles.SELLER, UserRoles.ADMIN), deleteProduct);

export default router;