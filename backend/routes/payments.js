const express = require('express');
const { body, query, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const { authenticateToken, canAccessOrder } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Create payment intent
// @route   POST /api/payments/create-intent
// @access  Private
router.post('/create-intent', [
  authenticateToken,
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required'),
  body('paymentMethod')
    .optional()
    .isString()
    .withMessage('Payment method must be a string')
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

  const { orderId, paymentMethod } = req.body;

  // Get order
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Check if user can access this order
  if (order.buyer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only pay for your own orders.'
    });
  }

  // Check if order can be paid
  if (order.payment.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Order payment status is not pending'
    });
  }

  try {
    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.total * 100), // Convert to cents
      currency: order.currency.toLowerCase(),
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        buyerId: order.buyer.toString(),
        sellerId: order.seller.toString()
      },
      payment_method_types: ['card'],
      customer_email: req.user.email,
      description: `Payment for order ${order.orderNumber}`,
      ...(paymentMethod && { payment_method: paymentMethod })
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      }
    });
  } catch (error) {
    console.error('Stripe payment intent creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent'
    });
  }
}));

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private
router.post('/confirm', [
  authenticateToken,
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required'),
  body('paymentIntentId')
    .isString()
    .withMessage('Payment intent ID is required')
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

  const { orderId, paymentIntentId } = req.body;

  // Get order
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Check if user can access this order
  if (order.buyer.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only confirm payment for your own orders.'
    });
  }

  try {
    // Retrieve payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Update order payment status
      order.payment.status = 'completed';
      order.payment.transactionId = paymentIntent.id;
      order.payment.paidAt = new Date();
      order.status = 'confirmed';
      
      await order.save();

      res.json({
        success: true,
        message: 'Payment confirmed successfully',
        data: { order }
      });
    } else if (paymentIntent.status === 'requires_payment_method') {
      res.status(400).json({
        success: false,
        message: 'Payment requires additional authentication'
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Payment status: ${paymentIntent.status}`
      });
    }
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });
  }
}));

// @desc    Get payment methods
// @route   GET /api/payments/methods
// @access  Private
router.get('/methods', authenticateToken, asyncHandler(async (req, res) => {
  try {
    // Get customer's payment methods
    const paymentMethods = await stripe.paymentMethods.list({
      customer: req.user.stripeCustomerId,
      type: 'card'
    });

    res.json({
      success: true,
      data: { paymentMethods: paymentMethods.data }
    });
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment methods'
    });
  }
}));

// @desc    Add payment method
// @route   POST /api/payments/methods
// @access  Private
router.post('/methods', [
  authenticateToken,
  body('paymentMethodId')
    .isString()
    .withMessage('Payment method ID is required')
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

  const { paymentMethodId } = req.body;

  try {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: req.user.stripeCustomerId
    });

    res.json({
      success: true,
      message: 'Payment method added successfully'
    });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add payment method'
    });
  }
}));

// @desc    Remove payment method
// @route   DELETE /api/payments/methods/:paymentMethodId
// @access  Private
router.delete('/methods/:paymentMethodId', authenticateToken, asyncHandler(async (req, res) => {
  const { paymentMethodId } = req.params;

  try {
    // Detach payment method
    await stripe.paymentMethods.detach(paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    console.error('Remove payment method error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove payment method'
    });
  }
}));

// @desc    Process refund
// @route   POST /api/payments/refund
// @access  Private (Admin or Seller)
router.post('/refund', [
  authenticateToken,
  body('orderId')
    .isMongoId()
    .withMessage('Valid order ID is required'),
  body('amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Refund amount must be a positive number'),
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

  const { orderId, amount, reason } = req.body;

  // Get order
  const order = await Order.findById(orderId);
  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found'
    });
  }

  // Check if user can process refund
  if (order.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only the seller or admin can process refunds.'
    });
  }

  // Check if order can be refunded
  if (order.payment.status !== 'completed') {
    return res.status(400).json({
      success: false,
      message: 'Order payment is not completed'
    });
  }

  // Check if order has been delivered
  if (order.status !== 'delivered') {
    return res.status(400).json({
      success: false,
      message: 'Order must be delivered before refund can be processed'
    });
  }

  try {
    // Process refund through Stripe
    const refundAmount = amount ? Math.round(amount * 100) : Math.round(order.total * 100);
    
    const refund = await stripe.refunds.create({
      payment_intent: order.payment.transactionId,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
        reason: reason || 'Refund requested'
      }
    });

    // Update order
    order.payment.status = 'refunded';
    order.payment.refundedAt = new Date();
    order.payment.refundAmount = refundAmount / 100;
    order.status = 'refunded';
    order.refundReason = reason || 'Refund processed';

    await order.save();

    res.json({
      success: true,
      message: 'Refund processed successfully',
      data: { 
        refund,
        order
      }
    });
  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund'
    });
  }
}));

// @desc    Get payment history
// @route   GET /api/payments/history
// @access  Private
router.get('/history', [
  authenticateToken,
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
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Get user's payment history
  const query = req.user.role === 'buyer' 
    ? { buyer: req.user._id }
    : req.user.role === 'seller'
    ? { seller: req.user._id }
    : {};

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('buyer', 'firstName lastName company.name')
      .populate('seller', 'firstName lastName company.name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('orderNumber total payment status createdAt'),
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

// @desc    Webhook for Stripe events
// @route   POST /api/payments/webhook
// @access  Public
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
}));

// Handle payment success
const handlePaymentSuccess = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;
    const order = await Order.findById(orderId);
    
    if (order) {
      order.payment.status = 'completed';
      order.payment.transactionId = paymentIntent.id;
      order.payment.paidAt = new Date();
      order.status = 'confirmed';
      
      await order.save();
      
      console.log(`Payment succeeded for order: ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
};

// Handle payment failure
const handlePaymentFailure = async (paymentIntent) => {
  try {
    const orderId = paymentIntent.metadata.orderId;
    const order = await Order.findById(orderId);
    
    if (order) {
      order.payment.status = 'failed';
      await order.save();
      
      console.log(`Payment failed for order: ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
};

// Handle refund
const handleRefund = async (charge) => {
  try {
    // Find order by payment intent ID
    const order = await Order.findOne({ 'payment.transactionId': charge.payment_intent });
    
    if (order) {
      order.payment.status = 'refunded';
      order.payment.refundedAt = new Date();
      order.payment.refundAmount = charge.amount_refunded / 100;
      order.status = 'refunded';
      
      await order.save();
      
      console.log(`Refund processed for order: ${order.orderNumber}`);
    }
  } catch (error) {
    console.error('Error handling refund:', error);
  }
};

module.exports = router;