const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { authenticateToken, isOwnerOrAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadUserAvatar, uploadCompanyLogo } = require('../utils/cloudinaryService');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const router = express.Router();

// @desc    Get user profile
// @route   GET /api/users/:id
// @access  Private
router.get('/:id', [
  authenticateToken,
  isOwnerOrAdmin('id')
], asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('-password')
    .populate('company.address');

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  res.json({
    success: true,
    data: { user }
  });
}));

// @desc    Update user profile
// @route   PUT /api/users/:id
// @access  Private
router.put('/:id', [
  authenticateToken,
  isOwnerOrAdmin('id'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('profile.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters'),
  body('profile.bio')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Bio cannot exceed 200 characters'),
  body('preferences.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi'])
    .withMessage('Invalid language'),
  body('preferences.currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CNY', 'JPY', 'KRW', 'AED'])
    .withMessage('Invalid currency')
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

  const { firstName, lastName, profile, preferences } = req.body;
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update user fields
  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (profile) user.profile = { ...user.profile, ...profile };
  if (preferences) user.preferences = { ...user.preferences, ...preferences };

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user }
  });
}));

// @desc    Update company information
// @route   PUT /api/users/:id/company
// @access  Private
router.put('/:id/company', [
  authenticateToken,
  isOwnerOrAdmin('id'),
  body('company.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Company name cannot exceed 100 characters'),
  body('company.description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Company description cannot exceed 500 characters'),
  body('company.website')
    .optional()
    .isURL()
    .withMessage('Invalid website URL'),
  body('company.businessType')
    .optional()
    .isIn(['manufacturer', 'wholesaler', 'distributor', 'retailer', 'service-provider'])
    .withMessage('Invalid business type'),
  body('company.address.street')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Street address cannot exceed 200 characters'),
  body('company.address.city')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('City cannot exceed 100 characters'),
  body('company.address.state')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('State cannot exceed 100 characters'),
  body('company.address.country')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Country cannot exceed 100 characters'),
  body('company.address.zipCode')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('ZIP code cannot exceed 20 characters'),
  body('company.phone')
    .optional()
    .trim()
    .isLength({ max: 20 })
    .withMessage('Phone number cannot exceed 20 characters')
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

  const { company } = req.body;
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update company information
  if (company) {
    user.company = { ...user.company, ...company };
  }

  await user.save();

  res.json({
    success: true,
    message: 'Company information updated successfully',
    data: { user }
  });
}));

// @desc    Upload user avatar
// @route   POST /api/users/:id/avatar
// @access  Private
router.post('/:id/avatar', [
  authenticateToken,
  isOwnerOrAdmin('id'),
  upload.single('avatar')
], asyncHandler(async (req, res) => {
  // This would typically use multer middleware for file upload
  // For now, we'll assume the file is in req.file
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Avatar file is required'
    });
  }

  const userId = req.params.id;
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  try {
    // Upload avatar to Cloudinary
    const result = await uploadUserAvatar(req.file, userId);
    
    // Update user profile
    user.profile.avatar = result.secure_url;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: { avatar: result.secure_url }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar'
    });
  }
}));

// @desc    Upload company logo
// @route   POST /api/users/:id/company/logo
// @access  Private
router.post('/:id/company/logo', [
  authenticateToken,
  isOwnerOrAdmin('id'),
  upload.single('logo')
], asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Logo file is required'
    });
  }

  const userId = req.params.id;
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  try {
    // Upload logo to Cloudinary
    const result = await uploadCompanyLogo(req.file, userId);
    
    // Update company logo
    user.company.logo = result.secure_url;
    await user.save();

    res.json({
      success: true,
      message: 'Company logo uploaded successfully',
      data: { logo: result.secure_url }
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo'
    });
  }
}));

// @desc    Get user dashboard data
// @route   GET /api/users/:id/dashboard
// @access  Private
router.get('/:id/dashboard', [
  authenticateToken,
  isOwnerOrAdmin('id')
], asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  let dashboardData = {};

  if (user.role === 'buyer') {
    // Get buyer-specific data
    const [recentOrders, favoriteProducts] = await Promise.all([
      Order.find({ buyer: userId })
        .populate('seller', 'firstName lastName company.name')
        .populate('items.product', 'name images.primary price.current')
        .sort({ createdAt: -1 })
        .limit(5),
      Product.find({ favorites: userId, status: 'active' })
        .populate('seller', 'firstName lastName company.name')
        .limit(8)
    ]);

    dashboardData = {
      recentOrders,
      favoriteProducts
    };
  } else if (user.role === 'seller') {
    // Get seller-specific data
    const [recentOrders, productStats, lowStockProducts] = await Promise.all([
      Order.find({ seller: userId })
        .populate('buyer', 'firstName lastName company.name')
        .populate('items.product', 'name images.primary price.current')
        .sort({ createdAt: -1 })
        .limit(5),
      Product.aggregate([
        { $match: { seller: userId } },
        {
          $group: {
            _id: null,
            totalProducts: { $sum: 1 },
            activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
            lowStockProducts: { $sum: { $cond: [{ $lte: ['$inventory.stock', '$inventory.lowStockThreshold'] }, 1, 0] } }
          }
        }
      ]),
      Product.find({ 
        seller: userId, 
        'inventory.stock': { $lte: '$inventory.lowStockThreshold' },
        status: 'active'
      })
        .select('name inventory.stock inventory.lowStockThreshold')
        .limit(5)
    ]);

    dashboardData = {
      recentOrders,
      productStats: productStats[0] || {},
      lowStockProducts
    };
  }

  res.json({
    success: true,
    data: dashboardData
  });
}));

// @desc    Get user statistics
// @route   GET /api/users/:id/stats
// @access  Private
router.get('/:id/stats', [
  authenticateToken,
  isOwnerOrAdmin('id')
], asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  let stats = {};

  if (user.role === 'buyer') {
    // Get buyer statistics
    const orderStats = await Order.aggregate([
      { $match: { buyer: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
        }
      }
    ]);

    const monthlySpending = await Order.aggregate([
      { $match: { buyer: userId, status: { $in: ['delivered', 'refunded'] } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          totalSpent: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    stats = {
      orders: orderStats[0] || {},
      monthlySpending
    };
  } else if (user.role === 'seller') {
    // Get seller statistics
    const orderStats = await Order.aggregate([
      { $match: { seller: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          averageOrderValue: { $avg: '$total' },
          completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } }
        }
      }
    ]);

    const productStats = await Product.aggregate([
      { $match: { seller: userId } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalViews: { $sum: '$views' },
          averageRating: { $avg: '$rating.average' }
        }
      }
    ]);

    const monthlyRevenue = await Order.aggregate([
      { $match: { seller: userId, status: { $in: ['delivered', 'refunded'] } } },
      {
        $group: {
          _id: { $month: '$createdAt' },
          revenue: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    stats = {
      orders: orderStats[0] || {},
      products: productStats[0] || {},
      monthlyRevenue
    };
  }

  res.json({
    success: true,
    data: stats
  });
}));

// @desc    Get user activity
// @route   GET /api/users/:id/activity
// @access  Private
router.get('/:id/activity', [
  authenticateToken,
  isOwnerOrAdmin('id'),
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

  const { page = 1, limit = 20 } = req.query;
  const userId = req.params.id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  let activity = [];
  let total = 0;

  if (user.role === 'buyer') {
    // Get buyer activity (orders)
    [activity, total] = await Promise.all([
      Order.find({ buyer: userId })
        .populate('seller', 'firstName lastName company.name')
        .populate('items.product', 'name images.primary')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments({ buyer: userId })
    ]);
  } else if (user.role === 'seller') {
    // Get seller activity (orders and product updates)
    [activity, total] = await Promise.all([
      Order.find({ seller: userId })
        .populate('buyer', 'firstName lastName company.name')
        .populate('items.product', 'name images.primary')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments({ seller: userId })
    ]);
  }

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      activity,
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

// @desc    Update user preferences
// @route   PUT /api/users/:id/preferences
// @access  Private
router.put('/:id/preferences', [
  authenticateToken,
  isOwnerOrAdmin('id'),
  body('notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notifications must be a boolean'),
  body('notifications.sms')
    .optional()
    .isBoolean()
    .withMessage('SMS notifications must be a boolean'),
  body('notifications.push')
    .optional()
    .isBoolean()
    .withMessage('Push notifications must be a boolean'),
  body('language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'hi'])
    .withMessage('Invalid language'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP', 'INR', 'CNY', 'JPY', 'KRW', 'AED'])
    .withMessage('Invalid currency')
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

  const { notifications, language, currency } = req.body;
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Update preferences
  if (notifications) {
    user.preferences.notifications = { ...user.preferences.notifications, ...notifications };
  }
  if (language) user.preferences.language = language;
  if (currency) user.preferences.currency = currency;

  await user.save();

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: { preferences: user.preferences }
  });
}));

// @desc    Delete user account
// @route   DELETE /api/users/:id
// @access  Private
router.delete('/:id', [
  authenticateToken,
  isOwnerOrAdmin('id')
], asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Prevent admin from deleting themselves
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own account'
    });
  }

  // Soft delete by changing status
  user.status = 'inactive';
  await user.save();

  res.json({
    success: true,
    message: 'User account deactivated successfully'
  });
}));

module.exports = router;