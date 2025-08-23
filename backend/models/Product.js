const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  alternateNames: {
    type: [String],
    maxlength: 3,
    validate: {
      validator: function(v) {
        return v.length <= 3;
      },
      message: 'Cannot have more than 3 alternate names'
    }
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  shortDescription: {
    type: String,
    maxlength: [300, 'Short description cannot exceed 300 characters']
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller is required']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  subcategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters']
  }],
  brand: {
    type: String,
    trim: true,
    maxlength: [100, 'Brand name cannot exceed 100 characters']
  },
  model: {
    type: String,
    trim: true,
    maxlength: [100, 'Model cannot exceed 100 characters']
  },
  sku: {
    type: String,
    unique: true,
    required: [true, 'SKU is required'],
    trim: true
  },
  price: {
    current: {
      type: Number,
      required: [true, 'Current price is required'],
      min: [0, 'Price cannot be negative']
    },
    original: {
      type: Number,
      min: [0, 'Original price cannot be negative']
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP', 'INR', 'CNY']
    },
    bulkPricing: [{
      minQuantity: {
        type: Number,
        required: true,
        min: 1
      },
      maxQuantity: {
        type: Number,
        min: 1
      },
      price: {
        type: Number,
        required: true,
        min: 0
      }
    }]
  },
  inventory: {
    stock: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock cannot be negative']
    },
    minOrderQuantity: {
      type: Number,
      default: 1,
      min: [1, 'Minimum order quantity must be at least 1']
    },
    maxOrderQuantity: {
      type: Number,
      min: [1, 'Maximum order quantity must be at least 1']
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: [0, 'Low stock threshold cannot be negative']
    },
    reserved: {
      type: Number,
      default: 0,
      min: [0, 'Reserved stock cannot be negative']
    }
  },
  images: {
    primary: {
      type: String,
      required: [true, 'Primary image is required']
    },
    gallery: [{
      url: String,
      alt: String,
      caption: String
    }],
    thumbnails: [String]
  },
  specifications: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    value: {
      type: String,
      required: true,
      trim: true
    },
    unit: String
  }],
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    weight: Number,
    unit: {
      type: String,
      enum: ['cm', 'inch', 'mm', 'kg', 'lb', 'g']
    }
  },
  shipping: {
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    },
    shippingClass: {
      type: String,
      enum: ['light', 'standard', 'heavy', 'oversized']
    },
    freeShipping: {
      type: Boolean,
      default: false
    },
    shippingCost: {
      type: Number,
      min: [0, 'Shipping cost cannot be negative']
    }
  },
  certifications: [{
    name: String,
    issuer: String,
    validUntil: Date,
    certificateUrl: String
  }],
  warranty: {
    duration: Number,
    unit: {
      type: String,
      enum: ['days', 'months', 'years']
    },
    description: String
  },
  seo: {
    metaTitle: {
      type: String,
      maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
      type: String,
      maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    keywords: [String],
    slug: {
      type: String,
      unique: true,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'draft', 'archived'],
    default: 'draft'
  },
  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public'
  },
  featured: {
    type: Boolean,
    default: false
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  views: {
    type: Number,
    default: 0
  },
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  relatedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  customFields: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available stock
productSchema.virtual('availableStock').get(function() {
  return Math.max(0, this.inventory.stock - this.inventory.reserved);
});

// Virtual for isInStock
productSchema.virtual('isInStock').get(function() {
  return this.availableStock > 0;
});

// Virtual for isLowStock
productSchema.virtual('isLowStock').get(function() {
  return this.availableStock <= this.inventory.lowStockThreshold;
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.price.original && this.price.original > this.price.current) {
    return Math.round(((this.price.original - this.price.current) / this.price.original) * 100);
  }
  return 0;
});

// Indexes for search and performance
productSchema.index({ 
  name: 'text', 
  description: 'text', 
  tags: 'text',
  'specifications.name': 'text',
  'specifications.value': 'text'
});

productSchema.index({ seller: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ 'price.current': 1 });
productSchema.index({ 'inventory.stock': 1 });
productSchema.index({ featured: 1, status: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ 'rating.average': -1 });
productSchema.index({ views: -1 });

// Pre-save middleware to generate slug if not provided
productSchema.pre('save', function(next) {
  if (!this.seo.slug) {
    this.seo.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }
  next();
});

// Static method to find active products
productSchema.statics.findActive = function() {
  return this.find({ status: 'active', visibility: 'public' });
};

// Static method to find by category
productSchema.statics.findByCategory = function(categoryId) {
  return this.find({ 
    category: categoryId, 
    status: 'active', 
    visibility: 'public' 
  });
};

// Static method to find featured products
productSchema.statics.findFeatured = function() {
  return this.find({ 
    featured: true, 
    status: 'active', 
    visibility: 'public' 
  });
};

// Method to increment views
productSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to update rating
productSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);