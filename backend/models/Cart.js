const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
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
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  addedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Virtual for item total
cartItemSchema.virtual('itemTotal').get(function() {
  if (this.product && this.product.price && this.product.price.current) {
    return this.product.price.current * this.quantity;
  }
  return 0;
});

// Ensure virtuals are serialized
cartItemSchema.set('toJSON', { virtuals: true });
cartItemSchema.set('toObject', { virtuals: true });

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [cartItemSchema],
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountCode: {
    type: String,
    trim: true
  },
  discountAppliedAt: {
    type: Date
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

// Virtual for cart totals
cartSchema.virtual('subtotal').get(function() {
  return this.items.reduce((total, item) => {
    if (item.product && item.product.price && item.product.price.current) {
      return total + (item.product.price.current * item.quantity);
    }
    return total;
  }, 0);
});

cartSchema.virtual('total').get(function() {
  return Math.max(0, this.subtotal - this.discount);
});

cartSchema.virtual('totalItems').get(function() {
  return this.items.reduce((total, item) => total + item.quantity, 0);
});

cartSchema.virtual('totalWeight').get(function() {
  return this.items.reduce((total, item) => {
    if (item.product && item.product.weight) {
      return total + (item.product.weight * item.quantity);
    }
    return total;
  }, 0);
});

// Indexes
cartSchema.index({ user: 1 });
cartSchema.index({ 'items.product': 1 });
cartSchema.index({ 'items.seller': 1 });
cartSchema.index({ lastUpdated: -1 });

// Pre-save middleware to update lastUpdated
cartSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Pre-save middleware to update item timestamps
cartSchema.pre('save', function(next) {
  this.items.forEach(item => {
    if (item.isModified('quantity')) {
      item.updatedAt = new Date();
    }
  });
  next();
});

// Static method to get cart with populated products
cartSchema.statics.findByUserWithProducts = function(userId) {
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

// Static method to get cart summary
cartSchema.statics.getSummary = function(userId) {
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
      $match: {
        'product.status': 'active',
        'product.visibility': 'public'
      }
    },
    {
      $group: {
        _id: null,
        totalItems: { $sum: '$items.quantity' },
        subtotal: { $sum: { $multiply: ['$product.price.current', '$items.quantity'] } },
        totalWeight: { $sum: { $multiply: ['$product.weight', '$items.quantity'] } },
        itemCount: { $sum: 1 }
      }
    }
  ]);
};

// Instance method to add item to cart
cartSchema.methods.addItem = function(productId, sellerId, quantity, notes = '') {
  const existingItemIndex = this.items.findIndex(
    item => item.product.toString() === productId.toString() && 
            item.seller.toString() === sellerId.toString()
  );

  if (existingItemIndex !== -1) {
    // Update existing item
    this.items[existingItemIndex].quantity += quantity;
    if (notes) {
      this.items[existingItemIndex].notes = notes;
    }
    this.items[existingItemIndex].updatedAt = new Date();
  } else {
    // Add new item
    this.items.push({
      product: productId,
      seller: sellerId,
      quantity,
      notes,
      addedAt: new Date(),
      updatedAt: new Date()
    });
  }

  this.lastUpdated = new Date();
  return this;
};

// Instance method to remove item from cart
cartSchema.methods.removeItem = function(itemId) {
  const itemIndex = this.items.findIndex(item => item._id.toString() === itemId.toString());
  if (itemIndex !== -1) {
    this.items.splice(itemIndex, 1);
    this.lastUpdated = new Date();
    return true;
  }
  return false;
};

// Instance method to update item quantity
cartSchema.methods.updateItemQuantity = function(itemId, quantity) {
  const item = this.items.find(item => item._id.toString() === itemId.toString());
  if (item && quantity > 0) {
    item.quantity = quantity;
    item.updatedAt = new Date();
    this.lastUpdated = new Date();
    return true;
  }
  return false;
};

// Instance method to clear cart
cartSchema.methods.clearCart = function() {
  this.items = [];
  this.discount = 0;
  this.discountCode = null;
  this.discountAppliedAt = null;
  this.lastUpdated = new Date();
  return this;
};

// Instance method to apply discount
cartSchema.methods.applyDiscount = function(discountCode, discountAmount) {
  this.discount = discountAmount;
  this.discountCode = discountCode;
  this.discountAppliedAt = new Date();
  this.lastUpdated = new Date();
  return this;
};

// Instance method to remove discount
cartSchema.methods.removeDiscount = function() {
  this.discount = 0;
  this.discountCode = null;
  this.discountAppliedAt = null;
  this.lastUpdated = new Date();
  return this;
};

// Instance method to validate cart items
cartSchema.methods.validateItems = async function() {
  const Product = mongoose.model('Product');
  const validItems = [];
  const invalidItems = [];

  for (const item of this.items) {
    try {
      const product = await Product.findById(item.product);
      if (product && 
          product.status === 'active' && 
          product.visibility === 'public' && 
          product.stock >= item.quantity) {
        validItems.push(item);
      } else {
        invalidItems.push({
          item,
          reason: !product ? 'Product not found' : 
                  product.status !== 'active' ? 'Product inactive' :
                  product.visibility !== 'public' ? 'Product not visible' :
                  'Insufficient stock'
        });
      }
    } catch (error) {
      invalidItems.push({
        item,
        reason: 'Error validating product'
      });
    }
  }

  return { validItems, invalidItems };
};

// Instance method to get cart totals
cartSchema.methods.getTotals = function() {
  let subtotal = 0;
  let totalItems = 0;
  let totalWeight = 0;
  let validItems = 0;

  this.items.forEach(item => {
    if (item.product && item.product.price && item.product.price.current) {
      const itemTotal = item.product.price.current * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;
      if (item.product.weight) {
        totalWeight += item.product.weight * item.quantity;
      }
      validItems++;
    }
  });

  const discount = this.discount || 0;
  const total = Math.max(0, subtotal - discount);

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount: parseFloat(discount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    totalItems,
    totalWeight: parseFloat(totalWeight.toFixed(2)),
    validItems
  };
};

// Instance method to check if cart is empty
cartSchema.methods.isEmpty = function() {
  return this.items.length === 0;
};

// Instance method to get item count
cartSchema.methods.getItemCount = function() {
  return this.items.length;
};

// Instance method to get unique seller count
cartSchema.methods.getSellerCount = function() {
  const sellerIds = new Set(this.items.map(item => item.seller.toString()));
  return sellerIds.size;
};

// Instance method to get cart expiration date (optional feature)
cartSchema.methods.getExpirationDate = function() {
  // Cart expires after 30 days of inactivity
  const expirationDate = new Date(this.lastUpdated);
  expirationDate.setDate(expirationDate.getDate() + 30);
  return expirationDate;
};

// Instance method to check if cart is expired
cartSchema.methods.isExpired = function() {
  const expirationDate = this.getExpirationDate();
  return new Date() > expirationDate;
};

// Instance method to clean expired items (optional feature)
cartSchema.methods.cleanExpiredItems = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  this.items = this.items.filter(item => 
    item.updatedAt > thirtyDaysAgo
  );
  
  this.lastUpdated = new Date();
  return this;
};

module.exports = mongoose.model('Cart', cartSchema);