const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  priceAlert: {
    type: Number,
    min: 0
  },
  stockAlert: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Virtual for product availability
wishlistItemSchema.virtual('isAvailable').get(function() {
  if (this.product && this.product.status && this.product.visibility) {
    return this.product.status === 'active' && this.product.visibility === 'public';
  }
  return false;
});

// Virtual for stock status
wishlistItemSchema.virtual('stockStatus').get(function() {
  if (this.product && this.product.stock !== undefined) {
    if (this.product.stock === 0) return 'out_of_stock';
    if (this.product.stock <= 5) return 'low_stock';
    return 'in_stock';
  }
  return 'unknown';
});

// Ensure virtuals are serialized
wishlistItemSchema.set('toJSON', { virtuals: true });
wishlistItemSchema.set('toObject', { virtuals: true });

const wishlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [wishlistItemSchema],
  name: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'My Wishlist'
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for wishlist statistics
wishlistSchema.virtual('totalItems').get(function() {
  return this.items.length;
});

wishlistSchema.virtual('availableItems').get(function() {
  return this.items.filter(item => item.isAvailable).length;
});

wishlistSchema.virtual('outOfStockItems').get(function() {
  return this.items.filter(item => item.stockStatus === 'out_of_stock').length;
});

wishlistSchema.virtual('lowStockItems').get(function() {
  return this.items.filter(item => item.stockStatus === 'low_stock').length;
});

// Indexes
wishlistSchema.index({ 'items.product': 1 });
wishlistSchema.index({ 'items.seller': 1 });
wishlistSchema.index({ lastUpdated: -1 });
wishlistSchema.index({ isPublic: 1 });

// Pre-save middleware to update lastUpdated
wishlistSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Static method to get wishlist with populated products
wishlistSchema.statics.findByUserWithProducts = function(userId) {
  return this.findOne({ user: userId })
    .populate({
      path: 'items.product',
      select: 'name price images category brand stock status visibility weight',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .populate('items.seller', 'firstName lastName company.name company.logo');
};

// Static method to get public wishlists
wishlistSchema.statics.findPublicWishlists = function(limit = 10) {
  return this.find({ isPublic: true })
    .populate('user', 'firstName lastName company.name company.logo')
    .populate({
      path: 'items.product',
      select: 'name price images category',
      populate: {
        path: 'category',
        select: 'name slug'
      }
    })
    .sort({ lastUpdated: -1 })
    .limit(limit);
};

// Static method to get wishlist statistics
wishlistSchema.statics.getStats = function(userId) {
  return this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId) } },
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
        _id: null,
        totalItems: { $sum: 1 },
        availableItems: {
          $sum: {
            $cond: [
              { $and: [
                { $eq: ['$product.status', 'active'] },
                { $eq: ['$product.visibility', 'public'] }
              ]},
              1,
              0
            ]
          }
        },
        outOfStockItems: {
          $sum: {
            $cond: [
              { $eq: ['$product.stock', 0] },
              1,
              0
            ]
          }
        },
        lowStockItems: {
          $sum: {
            $cond: [
              { $and: [
                { $gt: ['$product.stock', 0] },
                { $lte: ['$product.stock', 5] }
              ]},
              1,
              0
            ]
          }
        }
      }
    }
  ]);
};

// Instance method to add item to wishlist
wishlistSchema.methods.addItem = function(productId, sellerId, options = {}) {
  const {
    notes = '',
    priority = 'medium',
    priceAlert = null,
    stockAlert = false
  } = options;

  // Check if item already exists
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString() && 
            item.seller.toString() === sellerId.toString()
  );

  if (existingItemIndex !== -1) {
    // Update existing item
    this.items[existingItemIndex].notes = notes;
    this.items[existingItemIndex].priority = priority;
    this.items[existingItemIndex].priceAlert = priceAlert;
    this.items[existingItemIndex].stockAlert = stockAlert;
    this.items[existingItemIndex].updatedAt = new Date();
  } else {
    // Add new item
    this.items.push({
      product: productId,
      seller: sellerId,
      notes,
      priority,
      priceAlert,
      stockAlert,
      addedAt: new Date()
    });
  }

  this.lastUpdated = new Date();
  return this;
};

// Instance method to remove item from wishlist
wishlistSchema.methods.removeItem = function(itemId) {
  const itemIndex = this.items.findIndex(item => item._id.toString() === itemId.toString());
  if (itemIndex !== -1) {
    this.items.splice(itemIndex, 1);
    this.lastUpdated = new Date();
    return true;
  }
  return false;
};

// Instance method to update item
wishlistSchema.methods.updateItem = function(itemId, updates) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  if (item) {
    Object.assign(item, updates);
    item.updatedAt = new Date();
    this.lastUpdated = new Date();
    return true;
  }
  return false;
};

// Instance method to clear wishlist
wishlistSchema.methods.clearWishlist = function() {
  this.items = [];
  this.lastUpdated = new Date();
  return this;
};

// Instance method to move item to cart
wishlistSchema.methods.moveToCart = async function(itemId, quantity = 1) {
  const Cart = mongoose.model('Cart');
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  if (!item) return null;

  // Remove from wishlist
  this.removeItem(itemId);

  // Add to or create cart
  let cart = await Cart.findOne({ user: this.user });
  if (!cart) {
    cart = new Cart({ user: this.user, items: [] });
  }

  const existingIndex = cart.items.findIndex(
    (ci) => ci.product.toString() === item.product.toString() && ci.seller.toString() === item.seller.toString()
  );
  if (existingIndex !== -1) {
    cart.items[existingIndex].quantity += quantity;
    if (item.notes) cart.items[existingIndex].notes = item.notes;
  } else {
    cart.items.push({
      product: item.product,
      seller: item.seller,
      quantity,
      notes: item.notes || '',
      addedAt: new Date()
    });
  }

  await Promise.all([this.save(), cart.save()]);

  return {
    productId: item.product,
    sellerId: item.seller,
    quantity,
    notes: item.notes
  };
};

// Instance method to get items by priority
wishlistSchema.methods.getItemsByPriority = function(priority) {
  return this.items.filter(item => item.priority === priority);
};

// Instance method to get items with price alerts
wishlistSchema.methods.getItemsWithPriceAlerts = function() {
  return this.items.filter(item => item.priceAlert !== null);
};

// Instance method to get items with stock alerts
wishlistSchema.methods.getItemsWithStockAlerts = function() {
  return this.items.filter(item => item.stockAlert === true);
};

// Instance method to check price alerts
wishlistSchema.methods.checkPriceAlerts = function() {
  const alerts = [];
  
  this.items.forEach(item => {
    if (item.priceAlert && item.product && item.product.price) {
      if (item.product.price.current <= item.priceAlert) {
        alerts.push({
          item,
          message: `Price dropped to $${item.product.price.current}!`,
          oldPrice: item.priceAlert,
          newPrice: item.product.price.current
        });
      }
    }
  });
  
  return alerts;
};

// Instance method to check stock alerts
wishlistSchema.methods.checkStockAlerts = function() {
  const alerts = [];
  
  this.items.forEach(item => {
    if (item.stockAlert && item.product) {
      if (item.product.stock === 0) {
        alerts.push({
          item,
          message: 'Product is out of stock!',
          stock: 0
        });
      } else if (item.product.stock <= 5) {
        alerts.push({
          item,
          message: `Low stock alert: Only ${item.product.stock} units left!`,
          stock: item.product.stock
        });
      }
    }
  });
  
  return alerts;
};

// Instance method to get wishlist summary
wishlistSchema.methods.getSummary = function() {
  const totalItems = this.items.length;
  const availableItems = this.items.filter(item => item.isAvailable).length;
  const outOfStockItems = this.items.filter(item => item.stockStatus === 'out_of_stock').length;
  const lowStockItems = this.items.filter(item => item.stockStatus === 'low_stock').length;
  
  const priorityBreakdown = {
    high: this.items.filter(item => item.priority === 'high').length,
    medium: this.items.filter(item => item.priority === 'medium').length,
    low: this.items.filter(item => item.priority === 'low').length
  };

  return {
    totalItems,
    availableItems,
    outOfStockItems,
    lowStockItems,
    priorityBreakdown
  };
};

// Instance method to check if wishlist is empty
wishlistSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

// Instance method to get item count
wishlistSchema.methods.getItemCount = function() {
  return this.items.length;
};

// Instance method to get unique seller count
wishlistSchema.methods.getSellerCount = function() {
  const sellerIds = new Set(this.items.map(item => item.seller.toString()));
  return sellerIds.size;
};

// Instance method to get unique category count
wishlistSchema.methods.getCategoryCount = function() {
  const categoryIds = new Set(
    this.items
      .filter(item => item.product && item.product.category)
      .map(item => item.product.category.toString())
  );
  return categoryIds.size;
};

// Instance method to export wishlist (for sharing)
wishlistSchema.methods.exportWishlist = function() {
  return {
    name: this.name,
    description: this.description,
    totalItems: this.items.length,
    items: this.items.map(item => ({
      productName: item.product?.name || 'Unknown Product',
      sellerName: item.seller?.company?.name || item.seller?.firstName || 'Unknown Seller',
      priority: item.priority,
      notes: item.notes,
      addedAt: item.addedAt
    })),
    exportedAt: new Date()
  };
};

module.exports = mongoose.model('Wishlist', wishlistSchema);