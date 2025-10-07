const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Message content is required'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file', 'order_reference', 'product_reference'],
    default: 'text'
  },
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'other']
    },
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  }],
  metadata: {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' }
  },
  read: { type: Boolean, default: false },
  readAt: Date,
  delivered: { type: Boolean, default: false },
  deliveredAt: Date,
  edited: { type: Boolean, default: false },
  editedAt: Date,
  originalContent: String,
  deleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reactions: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    emoji: String,
    createdAt: { type: Date, default: Date.now }
  }],
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    validate: {
      validator: function(value) {
        // Prevent a message from replying to itself
        return !value || value.toString() !== this._id?.toString();
      },
      message: 'A message cannot reply to itself'
    }
  },
  isSystemMessage: { type: Boolean, default: false },
  systemMessageType: {
    type: String,
    enum: ['order_created', 'order_updated', 'payment_received', 'shipping_update', 'other']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for message status
messageSchema.virtual('status').get(function() {
  if (this.deleted) return 'deleted';
  if (this.read) return 'read';
  if (this.delivered) return 'delivered';
  return 'sent';
});

// Indexes for performance
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ recipient: 1, createdAt: -1 });
messageSchema.index({ read: 1, recipient: 1 });
messageSchema.index({ delivered: 1, recipient: 1 });
messageSchema.index({ 'metadata.orderId': 1 });
messageSchema.index({ 'metadata.productId': 1 });

// Pre-save middleware
messageSchema.pre('save', function(next) {
  if (this.isModified('content') && this.originalContent && !this.edited) {
    this.originalContent = this.content;
    this.edited = true;
    this.editedAt = new Date();
  }
  next();
});

// ---- Static methods ----

// Find conversation messages
messageSchema.statics.findByConversation = function(conversationId, options = {}) {
  const query = { conversation: conversationId, deleted: false };

  if (options.before) query.createdAt = { $lt: options.before };
  if (options.after) query.createdAt = { $gt: options.after };

  return this.find(query)
    .populate('sender', 'firstName lastName company.name profile.avatar')
    .populate('recipient', 'firstName lastName company.name profile.avatar')
    .populate('replyTo', 'content sender')
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

// Find unread messages
messageSchema.statics.findUnread = function(userId) {
  return this.find({
    recipient: userId,
    read: false,
    deleted: false
  }).populate('sender', 'firstName lastName company.name profile.avatar');
};

// Mark as read (bulk)
messageSchema.statics.markAsRead = function(messageIds, userId) {
  return this.updateMany(
    { _id: { $in: messageIds }, recipient: userId, read: false },
    { read: true, readAt: new Date() }
  );
};

// Mark as delivered (bulk)
messageSchema.statics.markAsDelivered = function(messageIds, userId) {
  return this.updateMany(
    { _id: { $in: messageIds }, recipient: userId, delivered: false },
    { delivered: true, deliveredAt: new Date() }
  );
};

// ---- Instance methods ----

// Mark a single message as read
messageSchema.methods.markAsRead = function() {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Mark a single message as delivered
messageSchema.methods.markAsDelivered = function() {
  if (!this.delivered) {
    this.delivered = true;
    this.deliveredAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Soft delete
messageSchema.methods.softDelete = function(userId) {
  this.deleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  return this.save();
};

// Add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  this.reactions.push({ user: userId, emoji, createdAt: new Date() });
  return this.save();
};

// Remove reaction
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// ---- Plugin support (fix for your error) ----
try {
  if (mongoose.plugins && Array.isArray(mongoose.plugins)) {
    mongoose.plugins.forEach((pluginConfig, index) => {
      if (pluginConfig && typeof pluginConfig.fn === 'function') {
        messageSchema.plugin(pluginConfig.fn, pluginConfig.opts || {});
      }
    });
  }
} catch (error) {
  console.warn('Plugin application failed for Message model:', error.message);
}

module.exports = mongoose.model('Message', messageSchema);
// ================= Plugin Fix =================