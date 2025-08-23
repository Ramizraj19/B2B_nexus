const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Apply admin middleware to all routes
router.use(authenticateToken, isAdmin);

// @desc    Get admin dashboard overview
// @route   GET /api/admin/dashboard
// @access  Private (Admin only)
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get user statistics
  const userStats = await User.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        pendingUsers: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        suspendedUsers: { $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] } }
      }
    }
  ]);

  // Get role breakdown
  const roleBreakdown = await User.aggregate([
    {
      $group: {
        _id: '$role',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get product statistics
  const productStats = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        draftProducts: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
        featuredProducts: { $sum: { $cond: ['$featured', 1, 0] } }
      }
    }
  ]);

  // Get order statistics
  const orderStats = await Order.aggregate([
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageOrderValue: { $avg: '$total' },
        pendingOrders: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        completedOrders: { $sum: { $cond: [{ $in: ['$status', ['delivered', 'refunded']] }, 1, 0] } }
      }
    }
  ]);

  // Get recent activity
  const recentUsers = await User.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .select('firstName lastName email role status createdAt');

  const recentOrders = await Order.find()
    .populate('buyer', 'firstName lastName company.name')
    .populate('seller', 'firstName lastName company.name')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('orderNumber total status createdAt');

  const recentProducts = await Product.find()
    .populate('seller', 'firstName lastName company.name')
    .sort({ createdAt: -1 })
    .limit(5)
    .select('name price.current status createdAt');

  // Get monthly revenue for the last 12 months
  const monthlyRevenue = await Order.aggregate([
    {
      $match: {
        status: { $in: ['delivered', 'refunded'] },
        createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) }
      }
    },
    {
      $group: {
        _id: { $month: '$createdAt' },
        revenue: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.json({
    success: true,
    data: {
      overview: {
        users: userStats[0] || {},
        products: productStats[0] || {},
        orders: orderStats[0] || {}
      },
      roleBreakdown,
      monthlyRevenue,
      recentActivity: {
        users: recentUsers,
        orders: recentOrders,
        products: recentProducts
      }
    }
  });
}));

// @desc    Get all users with pagination and filters
// @route   GET /api/admin/users
// @access  Private (Admin only)
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['buyer', 'seller', 'admin']).withMessage('Invalid role'),
  query('status').optional().isIn(['active', 'inactive', 'suspended', 'pending']).withMessage('Invalid status'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search query cannot be empty'),
  query('sortBy').optional().isIn(['firstName', 'lastName', 'email', 'role', 'status', 'createdAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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
    page = 1,
    limit = 20,
    role,
    status,
    search,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (role) query.role = role;
  if (status) query.status = status;
  
  if (search) {
    query.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { 'company.name': { $regex: search, $options: 'i' } }
    ];
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [users, total] = await Promise.all([
    User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    User.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      users,
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

// @desc    Update user status
// @route   PUT /api/admin/users/:id/status
// @access  Private (Admin only)
router.put('/users/:id/status', [
  body('status')
    .isIn(['active', 'inactive', 'suspended', 'pending'])
    .withMessage('Invalid status'),
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

  const { status, reason } = req.body;
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Prevent admin from suspending themselves
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot change your own status'
    });
  }

  // Update user status
  user.status = status;
  if (reason) {
    user.statusHistory = user.statusHistory || [];
    user.statusHistory.push({
      status,
      reason,
      changedBy: req.user._id,
      changedAt: new Date()
    });
  }

  await user.save();

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: { user }
  });
}));

// @desc    Get all products with admin filters
// @route   GET /api/admin/products
// @access  Private (Admin only)
router.get('/products', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'inactive', 'draft', 'archived']).withMessage('Invalid status'),
  query('seller').optional().isMongoId().withMessage('Invalid seller ID'),
  query('category').optional().isMongoId().withMessage('Invalid category ID'),
  query('featured').optional().isBoolean().withMessage('Featured must be a boolean'),
  query('sortBy').optional().isIn(['name', 'price', 'status', 'createdAt', 'views', 'rating']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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
    page = 1,
    limit = 20,
    status,
    seller,
    category,
    featured,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  if (seller) query.seller = seller;
  if (category) query.category = category;
  if (featured !== undefined) query.featured = featured === 'true';

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('seller', 'firstName lastName company.name')
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Product.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      products,
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

// @desc    Update product status
// @route   PUT /api/admin/products/:id/status
// @access  Private (Admin only)
router.put('/products/:id/status', [
  body('status')
    .isIn(['active', 'inactive', 'draft', 'archived'])
    .withMessage('Invalid status'),
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

  const { status, reason } = req.body;
  const productId = req.params.id;

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Update product status
  product.status = status;
  if (reason) {
    product.statusHistory = product.statusHistory || [];
    product.statusHistory.push({
      status,
      reason,
      changedBy: req.user._id,
      changedAt: new Date()
    });
  }

  await product.save();

  res.json({
    success: true,
    message: 'Product status updated successfully',
    data: { product }
  });
}));

// @desc    Get all orders with admin filters
// @route   GET /api/admin/orders
// @access  Private (Admin only)
router.get('/orders', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']).withMessage('Invalid status'),
  query('buyer').optional().isMongoId().withMessage('Invalid buyer ID'),
  query('seller').optional().isMongoId().withMessage('Invalid seller ID'),
  query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
  query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
  query('sortBy').optional().isIn(['orderNumber', 'total', 'status', 'createdAt']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
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
    page = 1,
    limit = 20,
    status,
    buyer,
    seller,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = {};
  
  if (status) query.status = status;
  if (buyer) query.buyer = buyer;
  if (seller) query.seller = seller;
  
  if (dateFrom || dateTo) {
    query.createdAt = {};
    if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
    if (dateTo) query.createdAt.$lte = new Date(dateTo);
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('buyer', 'firstName lastName company.name')
      .populate('seller', 'firstName lastName company.name')
      .populate('items.product', 'name images.primary price.current')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit)),
    Order.countDocuments(query)
  ]);

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

// @desc    Get analytics data
// @route   GET /api/admin/analytics
// @access  Private (Admin only)
router.get('/analytics', [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format')
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

  const { period = '30d', startDate, endDate } = req.query;

  // Calculate date range
  let dateRange = {};
  if (startDate && endDate) {
    dateRange = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else {
    const now = new Date();
    let start;
    
    switch (period) {
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    
    dateRange = { $gte: start, $lte: now };
  }

  // Get user registration trends
  const userTrends = await User.aggregate([
    { $match: { createdAt: dateRange } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // Get order trends
  const orderTrends = await Order.aggregate([
    { $match: { createdAt: dateRange } },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        },
        count: { $sum: 1 },
        revenue: { $sum: '$total' }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  // Get top sellers
  const topSellers = await Order.aggregate([
    { $match: { createdAt: dateRange, status: { $in: ['delivered', 'refunded'] } } },
    {
      $group: {
        _id: '$seller',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$total' }
      }
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: 10 }
  ]);

  // Populate seller information
  const populatedTopSellers = await User.populate(topSellers, {
    path: '_id',
    select: 'firstName lastName company.name'
  });

  // Get top products
  const topProducts = await Order.aggregate([
    { $match: { createdAt: dateRange, status: { $in: ['delivered', 'refunded'] } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        totalRevenue: { $sum: '$items.totalPrice' }
      }
    },
    { $sort: { totalSold: -1 } },
    { $limit: 10 }
  ]);

  // Populate product information
  const populatedTopProducts = await Product.populate(topProducts, {
    path: '_id',
    select: 'name images.primary price.current'
  });

  // Get category performance
  const categoryPerformance = await Order.aggregate([
    { $match: { createdAt: dateRange, status: { $in: ['delivered', 'refunded'] } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.product',
        foreignField: '_id',
        as: 'product'
      }
    },
    { $unwind: '$product' },
    {
      $group: {
        _id: '$product.category',
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$items.totalPrice' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // Populate category information
  const populatedCategoryPerformance = await Category.populate(categoryPerformance, {
    path: '_id',
    select: 'name slug'
  });

  res.json({
    success: true,
    data: {
      userTrends,
      orderTrends,
      topSellers: populatedTopSellers,
      topProducts: populatedTopProducts,
      categoryPerformance: populatedCategoryPerformance
    }
  });
}));

// @desc    Get system health
// @route   GET /api/admin/health
// @access  Private (Admin only)
router.get('/health', asyncHandler(async (req, res) => {
  // Check database connection
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  // Get system info
  const systemInfo = {
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    database: dbStatus
  };

  res.json({
    success: true,
    data: { systemInfo }
  });
}));

module.exports = router;