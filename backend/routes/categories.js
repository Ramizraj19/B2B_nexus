const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Category = require('../models/Category');
const Product = require('../models/Product');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// @desc    Get all categories (public)
// @route   GET /api/categories
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const categories = await Category.findTree()
    .populate('childrenCount')
    .select('-__v');

  res.json({
    success: true,
    data: { categories }
  });
}));

// @desc    Get root categories
// @route   GET /api/categories/roots
// @access  Public
router.get('/roots', asyncHandler(async (req, res) => {
  const categories = await Category.findRoots()
    .populate('childrenCount')
    .select('-__v');

  res.json({
    success: true,
    data: { categories }
  });
}));

// @desc    Get category by ID
// @route   GET /api/categories/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id)
    .populate('parent', 'name slug')
    .populate('childrenCount')
    .select('-__v');

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  res.json({
    success: true,
    data: { category }
  });
}));

// @desc    Get category by slug
// @route   GET /api/categories/slug/:slug
// @access  Public
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const category = await Category.findBySlug(req.params.slug)
    .populate('parent', 'name slug')
    .populate('childrenCount')
    .select('-__v');

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  res.json({
    success: true,
    data: { category }
  });
}));

// @desc    Get category children
// @route   GET /api/categories/:id/children
// @access  Public
router.get('/:id/children', asyncHandler(async (req, res) => {
  const children = await Category.findChildren(req.params.id)
    .populate('childrenCount')
    .select('-__v');

  res.json({
    success: true,
    data: { categories: children }
  });
}));

// @desc    Create new category (admin only)
// @route   POST /api/categories
// @access  Private (Admin only)
router.post('/', [
  authenticateToken,
  isAdmin,
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('parent')
    .optional()
    .isMongoId()
    .withMessage('Valid parent category ID is required'),
  body('image')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),
  body('icon')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Icon cannot exceed 50 characters'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean'),
  body('attributes')
    .optional()
    .isArray()
    .withMessage('Attributes must be an array'),
  body('filters')
    .optional()
    .isArray()
    .withMessage('Filters must be an array')
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

  const {
    name,
    description,
    parent,
    image,
    icon,
    color,
    sortOrder,
    featured,
    attributes,
    filters,
    seo
  } = req.body;

  // Check if parent category exists
  if (parent) {
    const parentCategory = await Category.findById(parent);
    if (!parentCategory) {
      return res.status(400).json({
        success: false,
        message: 'Parent category not found'
      });
    }
  }

  // Create category
  const category = new Category({
    name,
    description,
    parent,
    image,
    icon,
    color,
    sortOrder: sortOrder || 0,
    featured: featured || false,
    attributes: attributes || [],
    filters: filters || [],
    seo: {
      ...seo,
      slug: seo?.slug || name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-')
    }
  });

  await category.save();

  // Populate category for response
  const populatedCategory = await Category.findById(category._id)
    .populate('parent', 'name slug')
    .populate('childrenCount');

  res.status(201).json({
    success: true,
    message: 'Category created successfully',
    data: { category: populatedCategory }
  });
}));

// @desc    Update category (admin only)
// @route   PUT /api/categories/:id
// @access  Private (Admin only)
router.put('/:id', [
  authenticateToken,
  isAdmin,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Category name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  body('image')
    .optional()
    .isURL()
    .withMessage('Invalid image URL'),
  body('color')
    .optional()
    .matches(/^#[0-9A-F]{6}$/i)
    .withMessage('Color must be a valid hex color'),
  body('sortOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Sort order must be a non-negative integer'),
  body('featured')
    .optional()
    .isBoolean()
    .withMessage('Featured must be a boolean')
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

  const { name, description, image, icon, color, sortOrder, featured, attributes, filters, seo } = req.body;
  const categoryId = req.params.id;

  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  // Update category fields
  if (name) category.name = name;
  if (description !== undefined) category.description = description;
  if (image !== undefined) category.image = image;
  if (icon !== undefined) category.icon = icon;
  if (color !== undefined) category.color = color;
  if (sortOrder !== undefined) category.sortOrder = sortOrder;
  if (featured !== undefined) category.featured = featured;
  if (attributes) category.attributes = attributes;
  if (filters) category.filters = filters;
  if (seo) category.seo = { ...category.seo, ...seo };

  await category.save();

  // Populate category for response
  const updatedCategory = await Category.findById(category._id)
    .populate('parent', 'name slug')
    .populate('childrenCount');

  res.json({
    success: true,
    message: 'Category updated successfully',
    data: { category: updatedCategory }
  });
}));

// @desc    Delete category (admin only)
// @route   DELETE /api/categories/:id
// @access  Private (Admin only)
router.delete('/:id', [
  authenticateToken,
  isAdmin
], asyncHandler(async (req, res) => {
  const categoryId = req.params.id;
  const category = await Category.findById(categoryId);

  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  // Check if category has children
  const childrenCount = await Category.countDocuments({ parent: categoryId });
  if (childrenCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete category with subcategories. Please delete subcategories first.'
    });
  }

  // Check if category has products
  const productsCount = await Product.countDocuments({ category: categoryId });
  if (productsCount > 0) {
    return res.status(400).json({
      success: false,
      message: 'Cannot delete category with products. Please move or delete products first.'
    });
  }

  // Delete category
  await Category.findByIdAndDelete(categoryId);

  res.json({
    success: true,
    message: 'Category deleted successfully'
  });
}));

// @desc    Get category products
// @route   GET /api/categories/:id/products
// @access  Public
router.get('/:id/products', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['name', 'price', 'createdAt', 'rating', 'views']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
  query('brand').optional().trim().isLength({ min: 1 }).withMessage('Brand cannot be empty')
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

  const {
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    minPrice,
    maxPrice,
    brand
  } = req.query;

  const categoryId = req.params.id;

  // Verify category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  // Build query
  const query = { 
    category: categoryId, 
    status: 'active', 
    visibility: 'public' 
  };

  if (minPrice || maxPrice) {
    query['price.current'] = {};
    if (minPrice) query['price.current'].$gte = parseFloat(minPrice);
    if (maxPrice) query['price.current'].$lte = parseFloat(maxPrice);
  }

  if (brand) {
    query.brand = { $regex: brand, $options: 'i' };
  }

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Execute query with pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('seller', 'firstName lastName company.name company.logo')
      .populate('category', 'name slug')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'),
    Product.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      category,
      products,
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

// @desc    Get category statistics
// @route   GET /api/categories/:id/stats
// @access  Public
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const categoryId = req.params.id;

  // Verify category exists
  const category = await Category.findById(categoryId);
  if (!category) {
    return res.status(404).json({
      success: false,
      message: 'Category not found'
    });
  }

  // Get product statistics
  const productStats = await Product.aggregate([
    { $match: { category: categoryId, status: 'active' } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        averagePrice: { $avg: '$price.current' },
        minPrice: { $min: '$price.current' },
        maxPrice: { $avg: '$price.current' },
        totalViews: { $sum: '$views' },
        averageRating: { $avg: '$rating.average' }
      }
    }
  ]);

  // Get subcategory statistics
  const subcategoryStats = await Product.aggregate([
    { $match: { category: categoryId, status: 'active' } },
    {
      $group: {
        _id: '$subcategory',
        productCount: { $sum: 1 }
      }
    },
    { $sort: { productCount: -1 } },
    { $limit: 10 }
  ]);

  // Get brand statistics
  const brandStats = await Product.aggregate([
    { $match: { category: categoryId, status: 'active', brand: { $exists: true, $ne: '' } } },
    {
      $group: {
        _id: '$brand',
        productCount: { $sum: 1 }
      }
    },
    { $sort: { productCount: -1 } },
    { $limit: 10 }
  ]);

  // Get price range distribution
  const priceRanges = await Product.aggregate([
    { $match: { category: categoryId, status: 'active' } },
    {
      $bucket: {
        groupBy: '$price.current',
        boundaries: [0, 100, 500, 1000, 5000, 10000],
        default: 'Above 10000',
        output: {
          count: { $sum: 1 }
        }
      }
    }
  ]);

  res.json({
    success: true,
    data: {
      category,
      stats: {
        products: productStats[0] || {},
        subcategories: subcategoryStats,
        brands: brandStats,
        priceRanges
      }
    }
  });
}));

// @desc    Search categories
// @route   GET /api/categories/search
// @access  Public
router.get('/search', [
  query('q').notEmpty().withMessage('Search query is required'),
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

  const { q: searchQuery, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Build search query
  const query = {
    status: 'active',
    $or: [
      { name: { $regex: searchQuery, $options: 'i' } },
      { description: { $regex: searchQuery, $options: 'i' } }
    ]
  };

  const [categories, total] = await Promise.all([
    Category.find(query)
      .populate('parent', 'name slug')
      .populate('childrenCount')
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'),
    Category.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
      categories,
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

// @desc    Get featured categories
// @route   GET /api/categories/featured
// @access  Public
router.get('/featured', asyncHandler(async (req, res) => {
  const categories = await Category.find({ 
    featured: true, 
    status: 'active' 
  })
    .populate('childrenCount')
    .sort({ sortOrder: 1, name: 1 })
    .limit(10)
    .select('-__v');

  res.json({
    success: true,
    data: { categories }
  });
}));

module.exports = router;