const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['buyer_seller', 'support', 'group'],
    default: 'buyer_seller'
  },
  title: {
    type: String,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  lastMessageAt: Date,
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'blocked'],
    default: 'active'
  },
  metadata: {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order'
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    subject: String,
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal'
    }
  },
  settings: {
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    },
    autoArchive: {
      type: Boolean,
      default: false
    },
    archiveAfter: {
      type: Number,
      default: 30 // days
    }
  },
  tags: [String],
  isGroup: {
    type: Boolean,
    default: false
  },
  groupInfo: {
    name: String,
    description: String,
    avatar: String,
    admins: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    members: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      role: {
        type: String,
        enum: ['admin', 'member'],
        default: 'member'
      },
      joinedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  blockedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    blockedAt: {
      type: Date,
      default: Date.now
    },
    reason: String
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for conversation name
conversationSchema.virtual('displayName').get(function() {
  if (this.title) return this.title;
  if (this.isGroup && this.groupInfo.name) return this.groupInfo.name;
  return 'Direct Message';
});

// Virtual for isArchived
conversationSchema.virtual('isArchived').get(function() {
  return this.status === 'archived';
});

// Virtual for isBlocked
conversationSchema.virtual('isBlocked').get(function() {
  return this.status === 'blocked';
});

// Indexes for performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ 'lastMessageAt': -1 });
conversationSchema.index({ status: 1 });
conversationSchema.index({ 'metadata.orderId': 1 });
conversationSchema.index({ 'metadata.productId': 1 });
conversationSchema.index({ createdAt: -1 });

// Pre-save middleware
conversationSchema.pre('save', function(next) {
  // Ensure participants are unique
  this.participants = [...new Set(this.participants)];
  
  // Set title for buyer-seller conversations if not provided
  if (this.type === 'buyer_seller' && !this.title && this.metadata.productId) {
    this.title = 'Product Inquiry';
  }
  
  next();
});

// Static method to find conversation between two users
conversationSchema.statics.findBetweenUsers = function(user1Id, user2Id, type = 'buyer_seller') {
  return this.findOne({
    participants: { $all: [user1Id, user2Id] },
    type: type,
    status: { $ne: 'blocked' }
  });
};

// Static method to find user conversations
conversationSchema.statics.findByUser = function(userId, options = {}) {
  const query = {
    participants: userId,
    status: { $ne: 'blocked' }
  };
  
  if (options.status) {
    query.status = options.status;
  }
  
  if (options.type) {
    query.type = options.type;
  }
  
  return this.find(query)
    .populate('participants', 'firstName lastName company.name profile.avatar')
    .populate('lastMessage', 'content type sender createdAt')
    .populate('metadata.productId', 'name images.primary')
    .populate('metadata.orderId', 'orderNumber')
    .sort({ lastMessageAt: -1, createdAt: -1 });
};

// Static method to find by order
conversationSchema.statics.findByOrder = function(orderId) {
  return this.findOne({
    'metadata.orderId': orderId,
    status: { $ne: 'blocked' }
  });
};

// Static method to find by product
conversationSchema.statics.findByProduct = function(productId) {
  return this.find({
    'metadata.productId': productId,
    status: { $ne: 'blocked' }
  });
};

// Method to add participant
conversationSchema.methods.addParticipant = function(userId, role = 'member') {
  if (!this.participants.includes(userId)) {
    this.participants.push(userId);
    
    if (this.isGroup) {
      this.groupInfo.members.push({
        user: userId,
        role: role,
        joinedAt: new Date()
      });
    }
    
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to remove participant
conversationSchema.methods.removeParticipant = function(userId) {
  this.participants = this.participants.filter(p => p.toString() !== userId.toString());
  
  if (this.isGroup) {
    this.groupInfo.members = this.groupInfo.members.filter(m => m.user.toString() !== userId.toString());
    this.groupInfo.admins = this.groupInfo.admins.filter(a => a.toString() !== userId.toString());
  }
  
  return this.save();
};

// Method to update last message
conversationSchema.methods.updateLastMessage = function(messageId, messageAt) {
  this.lastMessage = messageId;
  this.lastMessageAt = messageAt || new Date();
  return this.save();
};

// Method to increment unread count
conversationSchema.methods.incrementUnreadCount = function(userId) {
  const currentCount = this.unreadCount.get(userId.toString()) || 0;
  this.unreadCount.set(userId.toString(), currentCount + 1);
  return this.save();
};

// Method to reset unread count
conversationSchema.methods.resetUnreadCount = function(userId) {
  this.unreadCount.set(userId.toString(), 0);
  return this.save();
};

// Method to archive conversation
conversationSchema.methods.archive = function(userId) {
  if (this.status !== 'archived') {
    this.status = 'archived';
    this.archivedBy.push({
      user: userId,
      archivedAt: new Date()
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to block conversation
conversationSchema.methods.block = function(userId, reason = '') {
  if (this.status !== 'blocked') {
    this.status = 'blocked';
    this.blockedBy.push({
      user: userId,
      blockedAt: new Date(),
      reason: reason
    });
    return this.save();
  }
  return Promise.resolve(this);
};

// Method to unblock conversation
conversationSchema.methods.unblock = function(userId) {
  if (this.status === 'blocked') {
    this.blockedBy = this.blockedBy.filter(b => b.user.toString() !== userId.toString());
    
    if (this.blockedBy.length === 0) {
      this.status = 'active';
    }
    
    return this.save();
  }
  return Promise.resolve(this);
};

module.exports = mongoose.model('Conversation', conversationSchema);