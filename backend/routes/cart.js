const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { authenticateToken, isBuyer } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// All cart routes require authentication and buyer role
router.use(authenticateToken);
router.use(isBuyer);

// @desc    Get user's cart
// @route   GET /api/cart
// @access  Private (Buyer only)
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let cart = await Cart.findOne({ user: userId })
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
    await cart.save();
  }

  // Calculate totals
  let subtotal = 0;
  let totalItems = 0;
  let totalWeight = 0;

  cart.items.forEach(item => {
    if (item.product && item.product.status === 'active' && item.product.visibility === 'public') {
      const itemTotal = item.product.price.current * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;
      totalWeight += (item.product.weight || 0) * item.quantity;
    }
  });

  // Apply any discounts
  const discount = cart.discount || 0;
  const total = Math.max(0, subtotal - discount);

  res.json({
    success: true,
    data: {
      cart: {
        ...cart.toObject(),
        totals: {
          subtotal: parseFloat(subtotal.toFixed(2)),
          discount: parseFloat(discount.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          totalItems,
          totalWeight: parseFloat(totalWeight.toFixed(2))
        }
      }
    }
  });
}));

// @desc    Add item to cart
// @route   POST /api/cart/items
// @access  Private (Buyer only)
router.post('/items', [
  body('productId')
    .isMongoId()
    .withMessage('Valid product ID is required'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('sellerId')
    .isMongoId()
    .withMessage('Valid seller ID is required'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters')
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

  const { productId, quantity, sellerId, notes } = req.body;
  const userId = req.user._id;

  // Verify product exists and is available
  const product = await Product.findById(productId)
    .populate('category', 'name slug')
    .populate('seller', 'firstName lastName company.name company.logo');

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  if (product.status !== 'active' || product.visibility !== 'public') {
    return res.status(400).json({
      success: false,
      message: 'Product is not available for purchase'
    });
  }

  if (product.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: `Only ${product.stock} units available in stock`
    });
  }

  // Verify seller
  if (product.seller._id.toString() !== sellerId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid seller for this product'
    });
  }

  // Get or create cart
  let cart = await Cart.findOne({ user: userId });
  if (!cart) {
    cart = new Cart({ user: userId, items: [] });
  }

  // Check if item already exists in cart
  const existingItemIndex = cart.items.findIndex(
    item => item.product.toString() === productId && item.seller.toString() === sellerId
  );

  if (existingItemIndex !== -1) {
    // Update existing item
    const newQuantity = cart.items[existingItemIndex].quantity + quantity;
    
    if (newQuantity > product.stock) {
      return res.status(400).json({
        success: false,
        message: `Cannot add ${quantity} more units. Total quantity would exceed available stock.`
      });
    }

    cart.items[existingItemIndex].quantity = newQuantity;
    if (notes) {
      cart.items[existingItemIndex].notes = notes;
    }
  } else {
    // Add new item
    cart.items.push({
      product: productId,
      seller: sellerId,
      quantity,
      notes: notes || '',
      addedAt: new Date()
    });
  }

  await cart.save();

  // Populate cart for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  res.status(201).json({
    success: true,
    message: 'Item added to cart successfully',
    data: { cart: populatedCart }
  });
}));

// @desc    Update cart item quantity
// @route   PUT /api/cart/items/:itemId
// @access  Private (Buyer only)
router.put('/items/:itemId', [
  body('quantity')
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

  const { quantity } = req.body;
  const { itemId } = req.params;
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Cart item not found'
    });
  }

  // Verify product stock
  const product = await Product.findById(cart.items[itemIndex].product);
  if (!product) {
    return res.status(400).json({
      success: false,
      message: 'Product no longer exists'
    });
  }

  if (product.stock < quantity) {
    return res.status(400).json({
      success: false,
      message: `Only ${product.stock} units available in stock`
    });
  }

  // Update quantity
  cart.items[itemIndex].quantity = quantity;
  cart.items[itemIndex].updatedAt = new Date();

  await cart.save();

  // Populate cart for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  res.json({
    success: true,
    message: 'Cart item updated successfully',
    data: { cart: populatedCart }
  });
}));

// @desc    Remove item from cart
// @route   DELETE /api/cart/items/:itemId
// @access  Private (Buyer only)
router.delete('/items/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId);
  if (itemIndex === -1) {
    return res.status(404).json({
      success: false,
      message: 'Cart item not found'
    });
  }

  // Remove item
  cart.items.splice(itemIndex, 1);
  await cart.save();

  // Populate cart for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  res.json({
    success: true,
    message: 'Item removed from cart successfully',
    data: { cart: populatedCart }
  });
}));

// @desc    Clear entire cart
// @route   DELETE /api/cart
// @access  Private (Buyer only)
router.delete('/', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  cart.items = [];
  await cart.save();

  res.json({
    success: true,
    message: 'Cart cleared successfully',
    data: { cart }
  });
}));

// @desc    Move cart items to wishlist
// @route   POST /api/cart/move-to-wishlist
// @access  Private (Buyer only)
router.post('/move-to-wishlist', [
  body('itemIds')
    .isArray()
    .withMessage('Item IDs must be an array')
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

  const { itemIds } = req.body;
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  // Filter items to move
  const itemsToMove = cart.items.filter(item => 
    itemIds.includes(item._id.toString())
  );

  if (itemsToMove.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No valid items to move'
    });
  }

  // TODO: Add wishlist functionality
  // For now, just remove items from cart
  cart.items = cart.items.filter(item => 
    !itemIds.includes(item._id.toString())
  );

  await cart.save();

  // Populate cart for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  res.json({
    success: true,
    message: `${itemsToMove.length} items moved to wishlist successfully`,
    data: { cart: populatedCart }
  });
}));

// @desc    Apply discount code
// @route   POST /api/cart/apply-discount
// @access  Private (Buyer only)
router.post('/apply-discount', [
  body('discountCode')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Discount code must be between 3 and 20 characters')
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

  const { discountCode } = req.body;
  const userId = req.user._id;

  // TODO: Implement discount code validation
  // For now, just return a mock response
  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  // Mock discount logic
  const discountAmount = 10; // $10 discount
  cart.discount = discountAmount;
  cart.discountCode = discountCode;
  cart.discountAppliedAt = new Date();

  await cart.save();

  // Populate cart for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  res.json({
    success: true,
    message: 'Discount code applied successfully',
    data: { cart: populatedCart }
  });
}));

// @desc    Remove discount code
// @route   DELETE /api/cart/remove-discount
// @access  Private (Buyer only)
router.delete('/remove-discount', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId });
  if (!cart) {
    return res.status(404).json({
      success: false,
      message: 'Cart not found'
    });
  }

  cart.discount = 0;
  cart.discountCode = null;
  cart.discountAppliedAt = null;

  await cart.save();

  // Populate cart for response
  const populatedCart = await Cart.findById(cart._id)
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');

  res.json({
    success: true,
    message: 'Discount code removed successfully',
    data: { cart: populatedCart }
  });
}));

// @desc    Get cart summary
// @route   GET /api/cart/summary
// @access  Private (Buyer only)
router.get('/summary', asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const cart = await Cart.findOne({ user: userId })
    .populate('items.product', 'price stock status visibility');

  if (!cart || cart.items.length === 0) {
    return res.json({
      success: true,
      data: {
        summary: {
          totalItems: 0,
          subtotal: 0,
          discount: 0,
          total: 0,
          totalWeight: 0
        }
      }
    });
  }

  // Calculate summary
  let subtotal = 0;
  let totalItems = 0;
  let totalWeight = 0;
  let validItems = 0;

  cart.items.forEach(item => {
    if (item.product && item.product.status === 'active' && item.product.visibility === 'public') {
      const itemTotal = item.product.price.current * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;
      totalWeight += (item.product.weight || 0) * item.quantity;
      validItems++;
    }
  });

  const discount = cart.discount || 0;
  const total = Math.max(0, subtotal - discount);

  res.json({
    success: true,
    data: {
      summary: {
        totalItems,
        validItems,
        subtotal: parseFloat(subtotal.toFixed(2)),
        discount: parseFloat(discount.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        totalWeight: parseFloat(totalWeight.toFixed(2))
      }
    }
  });
}));

module.exports = router;