const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const { authenticateToken, canAccessOrder } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail } = require('../utils/emailService');

const router = express.Router();

// @desc    Create new order
// @route   POST /api/orders
// @access  Private (Buyer only)
router.post('/', [
  authenticateToken,
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.product')
    .isMongoId()
    .withMessage('Valid product ID is required for each item'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1 for each item'),
  body('shipping.method')
    .notEmpty()
    .withMessage('Shipping method is required'),
  body('billingAddress')
    .isObject()
    .withMessage('Billing address is required'),
  body('shippingAddress')
    .isObject()
    .withMessage('Shipping address is required'),
  body('payment.method')
    .isIn(['stripe', 'razorpay', 'bank_transfer', 'check', 'cash'])
    .withMessage('Valid payment method is required')
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

  const {
    items,
    shipping,
    billingAddress,
    shippingAddress,
    payment,
    notes
  } = req.body;

  // Validate products and calculate totals
  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      return res.status(400).json({
        success: false,
        message: `Product with ID ${item.product} not found`
      });
    }

    if (product.status !== 'active' || product.visibility !== 'public') {
      return res.status(400).json({
        success: false,
        message: `Product ${product.name} is not available`
      });
    }

    if (product.availableStock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${product.name}. Available: ${product.availableStock}`
      });
    }

    const itemTotal = product.price.current * item.quantity;
    subtotal += itemTotal;

    orderItems.push({
      product: product._id,
      quantity: item.quantity,
      unitPrice: product.price.current,
      totalPrice: itemTotal,
      specifications: item.specifications || [],
      notes: item.notes
    });

    // Reserve stock
    product.inventory.reserved += item.quantity;
    await product.save();
  }

  // Calculate totals
  const taxAmount = 0; // You can implement tax calculation logic here
  const shippingCost = shipping.cost || 0;
  const discountAmount = 0; // You can implement discount logic here
  const total = subtotal + taxAmount + shippingCost - discountAmount;

  // Create order
  const order = new Order({
    buyer: req.user._id,
    seller: orderItems[0].product.seller, // Assuming all items are from same seller
    items: orderItems,
    subtotal,
    tax: {
      amount: taxAmount,
      rate: 0,
      type: 'percentage'
    },
    shipping: {
      ...shipping,
      cost: shippingCost
    },
    discount: {
      amount: discountAmount,
      type: 'fixed'
    },
    total,
    currency: req.user.preferences?.currency || 'USD',
    payment: {
      ...payment,
      amount: total
    },
    billingAddress,
    shippingAddress,
    notes: {
      buyer: notes?.buyer || '',
      seller: notes?.seller || '',
      internal: notes?.internal || ''
    }
  });

  await order.save();

  // Populate order for response
  const populatedOrder = await Order.findById(order._id)
    .populate('buyer', 'firstName lastName email company.name')
    .populate('seller', 'firstName lastName email company.name')
    .populate('items.product', 'name images.primary price.current');

  // Send confirmation email
  try {
    await sendOrderConfirmationEmail(
      req.user.email,
      req.user.firstName,
      order.orderNumber,
      {
        total: order.total,
        status: order.status
      }
    );
  } catch (emailError) {
    console.error('Order confirmation email failed:', emailError);
  }

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: { order: populatedOrder }
  });
}));

// @desc    Get user orders
// @route   GET /api/orders
// @access  Private
router.get('/', [
  authenticateToken,
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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

  const { status, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let orders, total;

  if (req.user.role === 'buyer') {
    [orders, total] = await Promise.all([
      Order.findByBuyer(req.user._id, { status })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments({ buyer: req.user._id, ...(status && { status }) })
    ]);
  } else if (req.user.role === 'seller') {
    [orders, total] = await Promise.all([
      Order.findBySeller(req.user._id, { status })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments({ seller: req.user._id, ...(status && { status }) })
    ]);
  } else {
    // Admin can see all orders
    const query = {};
    if (status) query.status = status;
    
    [orders, total] = await Promise.all([
      Order.find(query)
        .populate('buyer', 'firstName lastName company.name')
        .populate('seller', 'firstName lastName company.name')
        .populate('items.product', 'name images.primary price.current')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query)
    ]);
  }

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }
  });
}));

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
router.get('/:id', [
  authenticateToken,
  canAccessOrder()
], asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'firstName lastName email company.name company.address company.phone')
    .populate('seller', 'firstName lastName email company.name company.address company.phone')
    .populate('items.product', 'name images.primary price.current description specifications');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  res.json({
    success: true,
    data: { order }
  });
}));

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private (Seller or Admin)
router.put('/:id/status', [
  authenticateToken,
  canAccessOrder(),
  body('status')
    .isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
    .withMessage('Invalid status'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters')
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

  const { status, description } = req.body;
  const order = req.order;

  // Check if user can update this order
  if (req.user.role === 'seller' && order.seller.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only update your own orders.'
    });
  }

  // Update order status
  await order.updateStatus(status, description, req.user._id);

  // Update product inventory if order is cancelled or refunded
  if (status === 'cancelled' || status === 'refunded') {
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.inventory.reserved = Math.max(0, product.inventory.reserved - item.quantity);
        await product.save();
      }
    }
  }

  // Send status update email to buyer
  try {
    const buyer = await User.findById(order.buyer);
    if (buyer) {
      await sendOrderStatusUpdateEmail(
        buyer.email,
        buyer.firstName,
        order.orderNumber,
        status,
        {
          total: order.total,
          status: order.status
        }
      );
    }
  } catch (emailError) {
    console.error('Order status update email failed:', emailError);
  }

  // Populate order for response
  const updatedOrder = await Order.findById(order._id)
    .populate('buyer', 'firstName lastName email company.name')
    .populate('seller', 'firstName lastName email company.name')
    .populate('items.product', 'name images.primary price.current');

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: { order: updatedOrder }
  });
}));

// @desc    Cancel order
// @route   POST /api/orders/:id/cancel
// @access  Private (Buyer only)
router.post('/:id/cancel', [
  authenticateToken,
  canAccessOrder(),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters')
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

  const { reason } = req.body;
  const order = req.order;

  // Check if user is the buyer
  if (order.buyer.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only the buyer can cancel this order.'
    });
  }

  // Check if order can be cancelled
  if (!order.canCancel) {
    return res.status(400).json({
      success: false,
      message: 'Order cannot be cancelled at this stage'
    });
  }

  // Update order status
  await order.updateStatus('cancelled', reason || 'Cancelled by buyer', req.user._id);

  // Update product inventory
  for (const item of order.items) {
    const product = await Product.findById(item.product);
    if (product) {
      product.inventory.reserved = Math.max(0, product.inventory.reserved - item.quantity);
      await product.save();
    }
  }

  // Send cancellation email to seller
  try {
    const seller = await User.findById(order.seller);
    if (seller) {
      await sendOrderStatusUpdateEmail(
        seller.email,
        seller.firstName,
        order.orderNumber,
        'cancelled',
        {
          total: order.total,
          status: order.status
        }
      );
    }
  } catch (emailError) {
    console.error('Order cancellation email failed:', emailError);
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully'
  });
}));

// @desc    Get seller's orders
// @route   GET /api/orders/seller
// @access  Private (Seller only)
router.get('/seller', authenticateToken, asyncHandler(async (req, res) => {
  // Check if user is seller
  if (req.user.role !== 'seller' && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only sellers can view seller orders.'
    });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Build query based on user role
  const query = req.user.role === 'admin' ? {} : { seller: req.user._id };

  // Get orders with pagination
  const orders = await Order.find(query)
    .populate('buyer', 'firstName lastName company.name email')
    .populate('items.product', 'name images price')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  // Get total count for pagination
  const total = await Order.countDocuments(query);

  res.json({
    success: true,
    data: {
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
}));

// @desc    Get order statistics (alias for /stats/overview)
// @route   GET /api/orders/stats
// @access  Private
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  let stats = {};

  if (req.user.role === 'buyer') {
    stats = await Order.aggregate([
      { $match: { buyer: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);
  } else if (req.user.role === 'seller') {
    stats = await Order.aggregate([
      { $match: { seller: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);
  } else {
    // Admin stats
    stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);
  }

  // Get status breakdown
  const statusBreakdown = await Order.aggregate([
    {
      $match: req.user.role === 'buyer' 
        ? { buyer: req.user._id }
        : req.user.role === 'seller'
        ? { seller: req.user._id }
        : {}
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get recent orders
  const recentOrders = await Order.find(
    req.user.role === 'buyer' 
      ? { buyer: req.user._id }
      : req.user.role === 'seller'
      ? { seller: req.user._id }
      : {}
  )
    .populate('buyer', 'firstName lastName company.name')
    .populate('seller', 'firstName lastName company.name')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      ...stats[0], // Spread the stats directly instead of nesting under overview
      statusBreakdown,
      recentOrders
    }
  });
}));

// @desc    Get order statistics
// @route   GET /api/orders/stats/overview
// @access  Private
router.get('/stats/overview', authenticateToken, asyncHandler(async (req, res) => {
  let stats = {};

  if (req.user.role === 'buyer') {
    stats = await Order.aggregate([
      { $match: { buyer: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);
  } else if (req.user.role === 'seller') {
    stats = await Order.aggregate([
      { $match: { seller: req.user._id } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);
  } else {
    // Admin stats
    stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);
  }

  // Get status breakdown
  const statusBreakdown = await Order.aggregate([
    {
      $match: req.user.role === 'buyer' 
        ? { buyer: req.user._id }
        : req.user.role === 'seller'
        ? { seller: req.user._id }
        : {}
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get recent orders
  const recentOrders = await Order.find(
    req.user.role === 'buyer' 
      ? { buyer: req.user._id }
      : req.user.role === 'seller'
      ? { seller: req.user._id }
      : {}
  )
    .populate('buyer', 'firstName lastName company.name')
    .populate('seller', 'firstName lastName company.name')
    .sort({ createdAt: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      overview: stats[0] || {},
      statusBreakdown,
      recentOrders
    }
  });
}));

module.exports = router;