const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    unique: true,
    required: true,
    lowercase: true
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  ancestors: [{
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category'
    },
    name: String,
    slug: String
  }],
  level: {
    type: Number,
    default: 0
  },
  image: {
    type: String
  },
  icon: {
    type: String
  },
  color: {
    type: String,
    default: '#3B82F6'
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
    keywords: [String]
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  featured: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    default: 0
  },
  productCount: {
    type: Number,
    default: 0
  },
  attributes: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['text', 'number', 'boolean', 'select', 'multiselect'],
      default: 'text'
    },
    required: {
      type: Boolean,
      default: false
    },
    options: [String],
    unit: String,
    minValue: Number,
    maxValue: Number
  }],
  filters: [{
    name: String,
    type: {
      type: String,
      enum: ['range', 'checkbox', 'radio', 'select']
    },
    options: [String],
    minValue: Number,
    maxValue: Number
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for full path
categorySchema.virtual('fullPath').get(function() {
  if (this.ancestors && this.ancestors.length > 0) {
    return this.ancestors.map(ancestor => ancestor.name).concat(this.name).join(' > ');
  }
  return this.name;
});

// Virtual for full slug path
categorySchema.virtual('fullSlugPath').get(function() {
  if (this.ancestors && this.ancestors.length > 0) {
    return this.ancestors.map(ancestor => ancestor.slug).concat(this.slug).join('/');
  }
  return this.slug;
});

// Virtual for children count
categorySchema.virtual('childrenCount', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parent',
  count: true
});

// Indexes
categorySchema.index({ slug: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ level: 1 });
categorySchema.index({ status: 1 });
categorySchema.index({ featured: 1 });
categorySchema.index({ sortOrder: 1 });
categorySchema.index({ 'ancestors._id': 1 });

// Pre-save middleware to generate slug and update ancestors
categorySchema.pre('save', async function(next) {
  if (!this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  if (this.parent) {
    const parent = await this.constructor.findById(this.parent);
    if (parent) {
      this.level = parent.level + 1;
      this.ancestors = parent.ancestors.concat([{
        _id: parent._id,
        name: parent.name,
        slug: parent.slug
      }]);
    }
  } else {
    this.level = 0;
    this.ancestors = [];
  }

  next();
});

// Static method to find root categories
categorySchema.statics.findRoots = function() {
  return this.find({ parent: null, status: 'active' }).sort({ sortOrder: 1, name: 1 });
};

// Static method to find children of a category
categorySchema.statics.findChildren = function(parentId) {
  return this.find({ parent: parentId, status: 'active' }).sort({ sortOrder: 1, name: 1 });
};

// Static method to find category tree
categorySchema.statics.findTree = function() {
  return this.find({ status: 'active' }).sort({ level: 1, sortOrder: 1, name: 1 });
};

// Static method to find by slug
categorySchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug, status: 'active' });
};

// Method to get all descendants
categorySchema.methods.getDescendants = function() {
  return this.constructor.find({
    'ancestors._id': this._id,
    status: 'active'
  });
};

// Method to get all ancestors
categorySchema.methods.getAncestors = function() {
  return this.constructor.find({
    _id: { $in: this.ancestors.map(a => a._id) },
    status: 'active'
  });
};

// Method to update product count
categorySchema.methods.updateProductCount = async function() {
  const Product = mongoose.model('Product');
  const count = await Product.countDocuments({ 
    category: this._id, 
    status: 'active' 
  });
  this.productCount = count;
  return this.save();
};

module.exports = mongoose.model('Category', categorySchema);