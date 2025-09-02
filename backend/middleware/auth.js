const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Order = require('../models/Order');

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header must be in the format: Bearer <token>'
      });
    }
    const token = authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access token is required' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({ 
        success: false, 
        message: 'Account is not active' 
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({ 
        success: false, 
        message: 'Account is temporarily locked due to multiple failed login attempts' 
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid token' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token expired' 
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Authentication error' 
    });
  }
};

// Middleware to check if user has specific role
const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Middleware to check if user is admin
const isAdmin = authorizeRole('admin');

// Middleware to check if user is seller
const isSeller = authorizeRole('seller', 'admin');

// Middleware to check if user is buyer
const isBuyer = authorizeRole('buyer', 'admin');

// Middleware to check if user owns the resource or is admin
const isOwnerOrAdmin = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user owns the resource
    const resourceId = req.params[resourceField] || req.body[resourceField];
    
    if (!resourceId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Resource identifier is required' 
      });
    }

    if (req.user._id.toString() !== resourceId.toString()) {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your own resources.' 
      });
    }

    next();
  };
};

// Middleware to check if user can access seller resources
const canAccessSellerResource = (sellerField = 'seller') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Sellers can only access their own resources
    if (req.user.role === 'seller') {
      const sellerId = req.params[sellerField] || req.body[sellerField];
      
      if (!sellerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Seller identifier is required' 
        });
      }

      if (req.user._id.toString() !== sellerId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. You can only access your own resources.' 
        });
      }
    }

    next();
  };
};

// Middleware to check if user can access buyer resources
const canAccessBuyerResource = (buyerField = 'buyer') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }

    // Buyers can only access their own resources
    if (req.user.role === 'buyer') {
      const buyerId = req.params[buyerField] || req.body[buyerField];
      
      if (!buyerId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Buyer identifier is required' 
        });
      }

      if (req.user._id.toString() !== buyerId.toString()) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. You can only access your own resources.' 
        });
      }
    }

    next();
  };
};

// Middleware to check if user can access conversation
const canAccessConversation = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const conversationId = req.params.conversationId || req.body.conversationId;
      
      if (!conversationId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Conversation identifier is required' 
        });
      }
      
      const conversation = await Conversation.findById(conversationId);
      
      if (!conversation) {
        return res.status(404).json({ 
          success: false, 
          message: 'Conversation not found' 
        });
      }

      // Check if user is participant
      if (!conversation.participants.includes(req.user._id)) {
        return res.status(403).json({ 
          success: false, 
          message: 'Access denied. You are not a participant in this conversation.' 
        });
      }

      req.conversation = conversation;
      next();
    } catch (error) {
      console.error('Conversation access check error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error checking conversation access' 
      });
    }
  };
};

// Middleware to check if user can access order
const canAccessOrder = () => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }

      const orderId = req.params.orderId || req.body.orderId;
      
      if (!orderId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Order identifier is required' 
        });
      }
      
      const order = await Order.findById(orderId);
      
      if (!order) {
        return res.status(404).json({ 
          success: false, 
          message: 'Order not found' 
        });
      }

      // Admin can access everything
      if (req.user.role === 'admin') {
        req.order = order;
        return next();
      }

      // Check if user is buyer or seller
      if (order.buyer.toString() === req.user._id.toString() || 
          order.seller.toString() === req.user._id.toString()) {
        req.order = order;
        return next();
      }

      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. You can only access your own orders.' 
      });
    } catch (error) {
      console.error('Order access check error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Error checking order access' 
      });
    }
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  isAdmin,
  isSeller,
  isBuyer,
  isOwnerOrAdmin,
  canAccessSellerResource,
  canAccessBuyerResource,
  canAccessConversation,
  canAccessOrder
};