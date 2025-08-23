const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { authenticateToken, isBuyer } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// All wishlist routes require authentication and buyer role
router.use(authenticateToken);
router.use(isBuyer);

// @desc    Get user's wishlist
// @route   GET /api/wishlist
// @access  Private (Buyer only)
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let wishlist = await Wishlist.findByUserWithProducts(userId);

  if (!wishlist) {
    wishlist = new Wishlist({ user: userId, items: [] });
    await wishlist.save();
  }

  // Get wishlist summary
  const summary = wishlist.getSummary();

  res.json({
    success: true,
    data: {
      wishlist,
      summary
    }
  });
}));

// @desc    Add item to wishlist
// @route   POST /api/wishlist/items
// @access  Private (Buyer only)
router.post('/items', [
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required'),
  body('sellerId')
    .isMongoId()
    .withMessage('Valid seller ID is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('priceAlert')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price alert must be a positive number'),
  body('stockAlert')
    .optional()
    .isBoolean()
    .withMessage('Stock alert must be a boolean')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { productId, sellerId, notes, priority, priceAlert, stockAlert } = req.body;
  const userId = req.user._id;

  // Verify product exists
  const product = await Product.findById(productId)
    .populate('category', 'name slug')
    .populate('seller', 'firstName lastName company.name company.logo');

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Verify seller
  if (product.seller._id.toString() !== sellerId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid seller for this product'
    });
  }

  // Get or create wishlist
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    wishlist = new Wishlist({ user: userId, items: [] });
  }

  // Add item to wishlist
  wishlist.addItem(productId, sellerId, {
    notes,
    priority,
    priceAlert,
    stockAlert
  });

  await wishlist.save();

  // Populate wishlist for response
  const populatedWishlist = await Wishlist.findByUserWithProducts(userId);

  res.status(201).json({
    success: true,
    message: 'Item added to wishlist successfully',
    data: { wishlist: populatedWishlist }
  });
}));

// @desc    Update wishlist item
// @route   PUT /api/wishlist/items/:itemId
// @access  Private (Buyer only)
router.put('/items/:itemId', [
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high'),
  body('priceAlert')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price alert must be a positive number'),
  body('stockAlert')
    .optional()
    .isBoolean()
    .withMessage('Stock alert must be a boolean')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { notes, priority, priceAlert, stockAlert } = req.body;
  const { itemId } = req.params;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  // Update item
  const updates = {};
  if (notes !== undefined) updates.notes = notes;
  if (priority !== undefined) updates.priority = priority;
  if (priceAlert !== undefined) updates.priceAlert = priceAlert;
  if (stockAlert !== undefined) updates.stockAlert = stockAlert;

  const success = wishlist.updateItem(itemId, updates);
  if (!success) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist item not found'
    });
  }

  await wishlist.save();

  // Populate wishlist for response
  const populatedWishlist = await Wishlist.findByUserWithProducts(userId);

  res.json({
    success: true,
    message: 'Wishlist item updated successfully',
    data: { wishlist: populatedWishlist }
  });
}));

// @desc    Remove item from wishlist
// @route   DELETE /api/wishlist/items/:itemId
// @access  Private (Buyer only)
router.delete('/items/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  const success = wishlist.removeItem(itemId);
  if (!success) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist item not found'
    });
  }

  await wishlist.save();

  // Populate wishlist for response
  const populatedWishlist = await Wishlist.findByUserWithProducts(userId);

  res.json({
    success: true,
    message: 'Item removed from wishlist successfully',
    data: { wishlist: populatedWishlist }
  });
}));

// @desc    Move item from wishlist to cart
// @route   POST /api/wishlist/items/:itemId/move-to-cart
// @access  Private (Buyer only)
router.post('/items/:itemId/move-to-cart', [
  body('quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { quantity = 1 } = req.body;
  const { itemId } = req.params;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  // Move item to cart
  const cartItemData = wishlist.moveToCart(itemId);
  if (!cartItemData) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist item not found'
    });
  }

  // Add to cart
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  cart.addItem(
    cartItemData.productId,
    cartItemData.sellerId,
    quantity,
    cartItemData.notes
  );

  await Promise.all([wishlist.save(), cart.save()]);

  // Populate both wishlist and cart for response
  const [populatedWishlist, populatedCart] = await Promise.all([
    Wishlist.findByUserWithProducts(userId),
    Cart.findById(cart._id).populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    }).populate('items.seller', 'firstName lastName company.name company.logo')
  ]);

  res.json({
    success: true,
    message: 'Item moved to cart successfully',
    data: { wishlist: populatedWishlist, cart: populatedCart }
  });
}));

// @desc    Clear entire wishlist
// @route   DELETE /api/wishlist
// @access  Private (Buyer only)
router.delete('/', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  wishlist.clearWishlist();
  await wishlist.save();

  res.json({
    success: true,
    message: 'Wishlist cleared successfully',
    data: { wishlist }
  });
}));

// @desc    Get wishlist summary
// @route   GET /api/wishlist/summary
// @access  Private (Buyer only)
router.get('/summary', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.json({
      success: true,
      data: {
        summary: {
          totalItems: 0,
          availableItems: 0,
          outOfStockItems: 0,
          lowStockItems: 0,
          priorityBreakdown: { high: 0, medium: 0, low: 0 }
        }
      }
    });
  }

  const summary = wishlist.getSummary();

  res.json({
    success: true,
    data: { summary }
  });
}));

// @desc    Get wishlist statistics
// @route   GET /api/wishlist/stats
// @access  Private (Buyer only)
router.get('/stats', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const stats = await Wishlist.getStats(userId);
  const summary = stats[0] || {
    totalItems: 0,
    availableItems: 0,
    outOfStockItems: 0,
    lowStockItems: 0
  };

  res.json({
    success: true,
    data: { stats: summary }
  });
}));

// @desc    Get items by priority
// @route   GET /api/wishlist/priority/:priority
// @access  Private (Buyer only)
router.get('/priority/:priority', [
  query('priority')
    .isIn(['low', 'medium', 'high'])
    .withMessage('Priority must be low, medium, or high')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { priority } = req.params;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  const items = wishlist.getItemsByPriority(priority);

  res.json({
    success: true,
    data: { items, priority }
  });
}));

// @desc    Get items with price alerts
// @route   GET /api/wishlist/price-alerts
// @access  Private (Buyer only)
router.get('/price-alerts', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wishlist = await Wishlist.findByUserWithProducts(userId);
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  const items = wishlist.getItemsWithPriceAlerts();
  const alerts = wishlist.checkPriceAlerts();

  res.json({
    success: true,
    data: { items, alerts }
  });
}));

// @desc    Get items with stock alerts
// @route   GET /api/wishlist/stock-alerts
// @access  Private (Buyer only)
router.get('/stock-alerts', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wishlist = await Wishlist.findByUserWithProducts(userId);
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  const items = wishlist.getItemsWithStockAlerts();
  const alerts = wishlist.checkStockAlerts();

  res.json({
    success: true,
    data: { items, alerts }
  });
}));

// @desc    Update wishlist settings
// @route   PUT /api/wishlist/settings
// @access  Private (Buyer only)
router.put('/settings', [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('isPublic')
    .optional()
    .isBoolean()
    .withMessage('isPublic must be a boolean')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { name, description, isPublic } = req.body;
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  // Update settings
  if (name !== undefined) wishlist.name = name;
  if (description !== undefined) wishlist.description = description;
  if (isPublic !== undefined) wishlist.isPublic = isPublic;

  await wishlist.save();

  // Populate wishlist for response
  const populatedWishlist = await Wishlist.findByUserWithProducts(userId);

  res.json({
    success: true,
    message: 'Wishlist settings updated successfully',
    data: { wishlist: populatedWishlist }
  });
}));

// @desc    Export wishlist
// @route   GET /api/wishlist/export
// @access  Private (Buyer only)
router.get('/export', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) {
    return res.status(404).json({
      success: false,
      message: 'Wishlist not found'
    });
  }

  const exportedData = wishlist.exportWishlist();

  res.json({
    success: true,
    data: { exportedWishlist: exportedData }
  });
}));

// @desc    Get public wishlists
// @route   GET /api/wishlist/public
// @access  Public
router.get('/public', [
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
], asyncHandler(async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { limit = 10 } = req.query;

  const wishlists = await Wishlist.findPublicWishlists(parseInt(limit));

  res.json({
    success: true,
    data: { wishlists }
  });
}));

module.exports = router;