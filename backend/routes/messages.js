const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');
const { authenticateToken, canAccessConversation } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get user conversations
// @route   GET /api/messages/conversations
// @access  Private
router.get('/conversations', [
  authenticateToken,
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['active', 'archived']).withMessage('Invalid status')
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

  const { page = 1, limit = 20, status = 'active' } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [conversations, total] = await Promise.all([
    Conversation.findByUser(req.user._id, { status })
      .skip(skip)
      .limit(parseInt(limit)),
    Conversation.countDocuments({
      participants: req.user._id,
      status: status === 'active' ? { $ne: 'blocked' } : status
    })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      conversations,
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

// @desc    Get conversation messages
// @route   GET /api/messages/conversations/:conversationId
// @access  Private
router.get('/conversations/:conversationId', [
  authenticateToken,
  canAccessConversation(),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('before').optional().isISO8601().withMessage('Invalid date format'),
  query('after').optional().isISO8601().withMessage('Invalid date format')
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

  const { page = 1, limit = 50, before, after } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const options = {
    limit: parseInt(limit),
    before: before ? new Date(before) : undefined,
    after: after ? new Date(after) : undefined
  };

  const [messages, total] = await Promise.all([
    Message.findByConversation(req.params.conversationId, options)
      .skip(skip),
    Message.countDocuments({
      conversation: req.params.conversationId,
      deleted: false
    })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      messages,
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

// @desc    Create new conversation
// @route   POST /api/messages/conversations
// @access  Private
router.post('/conversations', [
  authenticateToken,
  body('participants')
    .isArray({ min: 1, max: 10 })
    .withMessage('Participants must be an array with 1-10 users'),
  body('participants.*')
    .isMongoId()
    .withMessage('Valid user ID is required for each participant'),
  body('title')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  body('type')
    .optional()
    .isIn(['buyer_seller', 'support', 'group'])
    .withMessage('Invalid conversation type'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
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

  const { participants, title, type = 'buyer_seller', metadata = {} } = req.body;

  // Add current user to participants if not already included
  if (!participants.includes(req.user._id.toString())) {
    participants.push(req.user._id.toString());
  }

  // Check if conversation already exists between these users
  if (type === 'buyer_seller' && participants.length === 2) {
    const existingConversation = await Conversation.findBetweenUsers(
      participants[0],
      participants[1],
      type
    );

    if (existingConversation) {
      return res.status(400).json({
        success: false,
        message: 'Conversation already exists between these users'
      });
    }
  }

  // Verify all participants exist
  const participantUsers = await User.find({ _id: { $in: participants } });
  if (participantUsers.length !== participants.length) {
    return res.status(400).json({
      success: false,
      message: 'One or more participants not found'
    });
  }

  // Create conversation
  const conversation = new Conversation({
    participants,
    initiator: req.user._id,
    type,
    title,
    metadata,
    isGroup: type === 'group'
  });

  if (type === 'group') {
    conversation.groupInfo = {
      name: title || 'Group Chat',
      admins: [req.user._id],
      members: participants.map(userId => ({
        user: userId,
        role: userId === req.user._id.toString() ? 'admin' : 'member'
      }))
    };
  }

  await conversation.save();

  // Populate conversation for response
  const populatedConversation = await Conversation.findById(conversation._id)
    .populate('participants', 'firstName lastName company.name profile.avatar');

  res.status(201).json({
    success: true,
    message: 'Conversation created successfully',
    data: { conversation: populatedConversation }
  });
}));

// @desc    Send message
// @route   POST /api/messages/conversations/:conversationId
// @access  Private
router.post('/conversations/:conversationId', [
  authenticateToken,
  canAccessConversation(),
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters'),
  body('type')
    .optional()
    .isIn(['text', 'image', 'file', 'order_reference', 'product_reference'])
    .withMessage('Invalid message type'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Valid message ID is required for reply'),
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
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

  const { content, type = 'text', attachments = [], replyTo, metadata = {} } = req.body;
  const conversation = req.conversation;

  // Find recipient (other participant)
  const recipient = conversation.participants.find(
    p => p.toString() !== req.user._id.toString()
  );

  if (!recipient) {
    return res.status(400).json({
      success: false,
      message: 'No recipient found for this conversation'
    });
  }

  // Create message
  const message = new Message({
    conversation: conversation._id,
    sender: req.user._id,
    recipient,
    content,
    type,
    attachments,
    replyTo,
    metadata
  });

  await message.save();

  // Update conversation last message
  await conversation.updateLastMessage(message._id, message.createdAt);

  // Increment unread count for recipient
  await conversation.incrementUnreadCount(recipient);

  // Populate message for response
  const populatedMessage = await Message.findById(message._id)
    .populate('sender', 'firstName lastName company.name profile.avatar')
    .populate('recipient', 'firstName lastName company.name profile.avatar')
    .populate('replyTo', 'content sender');

  res.status(201).json({
    success: true,
    message: 'Message sent successfully',
    data: { message: populatedMessage }
  });
}));

// @desc    Mark messages as read
// @route   PUT /api/messages/read
// @access  Private
router.put('/read', [
  authenticateToken,
  body('messageIds')
    .isArray({ min: 1 })
    .withMessage('Message IDs array is required'),
  body('messageIds.*')
    .isMongoId()
    .withMessage('Valid message ID is required for each message')
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

  const { messageIds } = req.body;

  // Mark messages as read
  await Message.markAsRead(messageIds, req.user._id);

  res.json({
    success: true,
    message: 'Messages marked as read successfully'
  });
}));

// @desc    Mark messages as delivered
// @route   PUT /api/messages/delivered
// @access  Private
router.put('/delivered', [
  authenticateToken,
  body('messageIds')
    .isArray({ min: 1 })
    .withMessage('Message IDs array is required'),
  body('messageIds.*')
    .isMongoId()
    .withMessage('Valid message ID is required for each message')
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

  const { messageIds } = req.body;

  // Mark messages as delivered
  await Message.markAsDelivered(messageIds, req.user._id);

  res.json({
    success: true,
    message: 'Messages marked as delivered successfully'
  });
}));

// @desc    Delete message
// @route   DELETE /api/messages/:messageId
// @access  Private
router.delete('/:messageId', [
  authenticateToken
], asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  // Check if user can delete this message
  if (message.sender.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only delete your own messages.'
    });
  }

  // Soft delete message
  await message.softDelete(req.user._id);

  res.json({
    success: true,
    message: 'Message deleted successfully'
  });
}));

// @desc    Edit message
// @route   PUT /api/messages/:messageId
// @access  Private
router.put('/:messageId', [
  authenticateToken,
  body('content')
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters')
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

  const { content } = req.body;
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found'
    });
  }

  // Check if user can edit this message
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only edit your own messages.'
    });
  }

  // Check if message can be edited (not too old)
  const timeDiff = Date.now() - message.createdAt.getTime();
  const maxEditTime = 15 * 60 * 1000; // 15 minutes

  if (timeDiff > maxEditTime) {
    return res.status(400).json({
      success: false,
      message: 'Message cannot be edited after 15 minutes'
    });
  }

  // Update message
  message.content = content;
  await message.save();

  // Populate message for response
  const updatedMessage = await Message.findById(message._id)
    .populate('sender', 'firstName lastName company.name profile.avatar')
    .populate('recipient', 'firstName lastName company.name profile.avatar')
    .populate('replyTo', 'content sender');

  res.json({
    success: true,
    message: 'Message updated successfully',
    data: { message: updatedMessage }
  });
}));

// @desc    Archive conversation
// @route   POST /api/messages/conversations/:conversationId/archive
// @access  Private
router.post('/conversations/:conversationId/archive', [
  authenticateToken,
  canAccessConversation()
], asyncHandler(async (req, res) => {
  const conversation = req.conversation;

  // Archive conversation
  await conversation.archive(req.user._id);

  res.json({
    success: true,
    message: 'Conversation archived successfully'
  });
}));

// @desc    Block conversation
// @route   POST /api/messages/conversations/:conversationId/block
// @access  Private
router.post('/conversations/:conversationId/block', [
  authenticateToken,
  canAccessConversation(),
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
  const conversation = req.conversation;

  // Block conversation
  await conversation.block(req.user._id, reason);

  res.json({
    success: true,
    message: 'Conversation blocked successfully'
  });
}));

// @desc    Unblock conversation
// @route   POST /api/messages/conversations/:conversationId/unblock
// @access  Private
router.post('/conversations/:conversationId/unblock', [
  authenticateToken,
  canAccessConversation()
], asyncHandler(async (req, res) => {
  const conversation = req.conversation;

  // Unblock conversation
  await conversation.unblock(req.user._id);

  res.json({
    success: true,
    message: 'Conversation unblocked successfully'
  });
}));

// @desc    Get unread message count
// @route   GET /api/messages/unread/count
// @access  Private
router.get('/unread/count', authenticateToken, asyncHandler(async (req, res) => {
  const unreadMessages = await Message.findUnread(req.user._id);
  
  const conversationCounts = {};
  unreadMessages.forEach(message => {
    const conversationId = message.conversation.toString();
    if (!conversationCounts[conversationId]) {
      conversationCounts[conversationId] = 0;
    }
    conversationCounts[conversationId]++;
  });

  res.json({
    success: true,
    data: {
      totalUnread: unreadMessages.length,
      conversationCounts
    }
  });
}));

module.exports = router;