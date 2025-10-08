const express = require('express');
const { body, query, validationResult } = require('express-validator');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Category = require('../models/Category');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../utils/emailService'); // Import at top
const logger = require('../utils/logger');

const router = express.Router();

// Apply admin middleware to all routes
router.use(authenticateToken, isAdmin);

// Enhanced dashboard with better performance
router.get('/dashboard', [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period')
], asyncHandler(async (req, res) => {
  const { period = '30d' } = req.query;
  
  // Calculate date range for period
  const dateRange = calculateDateRange(period);

  // Execute all analytics in parallel for better performance
  const [
    userStats,
    productStats, 
    orderStats,
    monthlyRevenue,
    recentActivity
  ] = await Promise.all([
    getUserStatistics(),
    getProductStatistics(),
    getOrderStatistics(dateRange),
    getMonthlyRevenue(dateRange),
    getRecentActivity()
  ]);

  res.json({
    success: true,
    data: {
      overview: { userStats, productStats, orderStats },
      monthlyRevenue,
      recentActivity
    }
  });
}));

// Enhanced user management with email notifications
router.put('/users/:id/status', [
  body('status').isIn(['active', 'inactive', 'suspended', 'pending']),
  body('reason').optional().trim().isLength({ max: 500 })
], asyncHandler(async (req, res) => {
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

  // Prevent self-modification
  if (user._id.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'You cannot change your own status'
    });
  }

  const oldStatus = user.status;
  user.status = status;
  
  // Track status history
  user.statusHistory.push({
    status,
    reason,
    changedBy: req.user._id,
    changedAt: new Date()
  });

  await user.save();

  // Send email notification for status changes
  if (oldStatus !== status) {
    try {
      if (status === 'active') {
        await emailService.sendAccountApproval(user);
      } else if (status === 'suspended') {
        await emailService.sendAccountSuspended(user, reason);
      }
    } catch (emailError) {
      logger.warn('Failed to send status update email', { userId, error: emailError.message });
      // Don't fail the request if email fails
    }
  }

  logger.info('User status updated', { 
    adminId: req.user._id, 
    userId, 
    oldStatus, 
    newStatus: status 
  });

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: { user: user.toObject() }
  });
}));

// Enhanced order status update with email notifications
router.put('/orders/:id/status', [
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']),
  body('reason').optional().trim().isLength({ max: 500 })
], asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }

  const { status, reason } = req.body;
  const orderId = req.params.id;

  const order = await Order.findById(orderId)
    .populate('buyer', 'firstName lastName email')
    .populate('seller', 'firstName lastName email');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  const oldStatus = order.status;
  order.status = status;
  
  // Update timestamps for specific status changes
  if (status === 'shipped') {
    order.shippedAt = new Date();
  } else if (status === 'delivered') {
    order.deliveredAt = new Date();
  }

  // Track status history
  order.statusHistory.push({
    status,
    reason,
    changedBy: req.user._id,
    changedAt: new Date()
  });

  await order.save();

  // Send email notification for significant status changes
  if (shouldSendStatusEmail(oldStatus, status)) {
    try {
      await emailService.sendOrderStatusUpdate(order, order.buyer);
    } catch (emailError) {
      logger.warn('Failed to send order status email', { orderId, error: emailError.message });
    }
  }

  logger.info('Order status updated', {
    adminId: req.user._id,
    orderId,
    oldStatus,
    newStatus: status
  });

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: { order }
  });
}));

// Helper functions
function calculateDateRange(period) {
  const now = new Date();
  let startDate = new Date();
  
  switch (period) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }
  
  return { $gte: startDate, $lte: now };
}

function shouldSendStatusEmail(oldStatus, newStatus) {
  const significantStatuses = ['confirmed', 'shipped', 'delivered', 'cancelled'];
  return significantStatuses.includes(newStatus) && oldStatus !== newStatus;
}

// Export the enhanced router
module.exports = router;