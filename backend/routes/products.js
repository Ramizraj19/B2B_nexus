const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { authenticateToken, isSeller, canAccessSellerResource } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { uploadToCloudinary } = require('../utils/cloudinaryService');

const router = express.Router();

// @desc    Get all products (public)
// @route   GET /api/products
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('category').optional().isMongoId().withMessage('Invalid category ID'),
  query('search').optional().trim().isLength({ min: 1 }).withMessage('Search query cannot be empty'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number'),
  query('tags').optional().isArray().withMessage('Tags must be an array'),
  query('brand').optional().trim().isLength({ min: 1 }).withMessage('Brand cannot be empty'),
  query('sortBy').optional().isIn(['price', 'name', 'createdAt', 'rating', 'views']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc'),
  query('featured').optional().isBoolean().withMessage('Featured must be a boolean')
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
    category,
    search,
    minPrice,
    maxPrice,
    tags,
    brand,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    featured
  } = req.query;

  // Build query
  const query = { status: 'active', visibility: 'public' };

  if (category) {
    query.category = category;
  }

  if (search) {
    query.$text = { $search: search };
  }

  if (minPrice || maxPrice) {
    query['price.current'] = {};
    if (minPrice) query['price.current'].$gte = parseFloat(minPrice);
    if (maxPrice) query['price.current'].$lte = parseFloat(maxPrice);
  }

  if (tags && Array.isArray(tags)) {
    query.tags = { $in: tags };
  }

  if (brand) {
    query.brand = { $regex: brand, $options: 'i' };
  }

  if (featured !== undefined) {
    query.featured = featured === 'true';
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

// @desc    Get featured products
// @route   GET /api/products/featured
// @access  Public
router.get('/featured', asyncHandler(async (req, res) => {
  const products = await Product.findFeatured()
    .populate('seller', 'firstName lastName company.name company.logo')
    .populate('category', 'name slug')
    .limit(10)
    .select('-__v');

  res.json({
    success: true,
    data: { products }
  });
}));

// @desc    Get product by ID
// @route   GET /api/products/:id
// @access  Public
router.get('/:id', asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('seller', 'firstName lastName company.name company.logo company.description company.address company.phone company.businessType')
    .populate('category', 'name slug description')
    .populate('subcategory', 'name slug')
    .select('-__v');

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Check if product is accessible
  if (product.status !== 'active' || product.visibility !== 'public') {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Increment view count
  await product.incrementViews();

  res.json({
    success: true,
    data: { product }
  });
}));

// @desc    Get product by slug
// @route   GET /api/products/slug/:slug
// @access  Public
router.get('/slug/:slug', asyncHandler(async (req, res) => {
  const product = await Product.findOne({ 'seo.slug': req.params.slug })
    .populate('seller', 'firstName lastName company.name company.logo company.description company.address company.phone company.businessType')
    .populate('category', 'name slug description')
    .populate('subcategory', 'name slug')
    .select('-__v');

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Check if product is accessible
  if (product.status !== 'active' || product.visibility !== 'public') {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Increment view count
  await product.incrementViews();

  res.json({
    success: true,
    data: { product }
  });
}));

// @desc    Create new product
// @route   POST /api/products
// @access  Private (Seller only)
router.post('/', [
  authenticateToken,
  isSeller,
  body('name')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('shortDescription')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Short description cannot exceed 300 characters'),
  body('category')
    .isMongoId()
    .withMessage('Valid category ID is required'),
  body('subcategory')
    .optional()
    .isMongoId()
    .withMessage('Valid subcategory ID is required'),
  body('price.current')
    .isFloat({ min: 0 })
    .withMessage('Current price must be a positive number'),
  body('price.original')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Original price must be a positive number'),
  body('inventory.stock')
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer'),
  body('inventory.minOrderQuantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Minimum order quantity must be at least 1'),
  body('sku')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('SKU must be between 3 and 50 characters'),
  body('brand')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Brand cannot exceed 100 characters'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters')
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
    alternateNames,
    description,
    shortDescription,
    category,
    subcategory,
    price,
    inventory,
    sku,
    brand,
    tags,
    specifications,
    dimensions,
    shipping,
    warranty,
    seo
  } = req.body;

  // Check if SKU already exists
  const existingProduct = await Product.findOne({ sku });
  if (existingProduct) {
    return res.status(400).json({
      success: false,
      message: 'Product with this SKU already exists'
    });
  }

  // Verify category exists
  const categoryExists = await Category.findById(category);
  if (!categoryExists) {
    return res.status(400).json({
      success: false,
      message: 'Category not found'
    });
  }

  // Verify subcategory if provided
  if (subcategory) {
    const subcategoryExists = await Category.findById(subcategory);
    if (!subcategoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Subcategory not found'
      });
    }
  }

  // Create product
  const product = new Product({
    name,
    alternateNames,
    description,
    shortDescription,
    seller: req.user._id,
    category,
    subcategory,
    price,
    inventory,
    sku,
    brand,
    tags,
    specifications,
    dimensions,
    shipping,
    warranty,
    seo: {
      ...seo,
      slug: seo?.slug || name.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-')
    }
  });

  await product.save();

  // Populate product for response
  const populatedProduct = await Product.findById(product._id)
    .populate('seller', 'firstName lastName company.name')
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug');

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: { product: populatedProduct }
  });
}));

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private (Seller only)
router.put('/:id', [
  authenticateToken,
  isSeller,
  body('name')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product name must be between 3 and 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Description must be between 10 and 2000 characters'),
  body('price.current')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Current price must be a positive number'),
  body('inventory.stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be a non-negative integer')
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

  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Check if user owns the product or is admin
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only update your own products.'
    });
  }

  // Update product
  const updateFields = ['name', 'alternateNames', 'description', 'shortDescription', 'price', 'inventory', 'brand', 'tags', 'specifications', 'dimensions', 'shipping', 'warranty', 'seo'];
  
  updateFields.forEach(field => {
    if (req.body[field] !== undefined) {
      product[field] = req.body[field];
    }
  });

  await product.save();

  // Populate product for response
  const updatedProduct = await Product.findById(product._id)
    .populate('seller', 'firstName lastName company.name')
    .populate('category', 'name slug')
    .populate('subcategory', 'name slug');

  res.json({
    success: true,
    message: 'Product updated successfully',
    data: { product: updatedProduct }
  });
}));

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private (Seller only)
router.delete('/:id', [
  authenticateToken,
  isSeller
], asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Check if user owns the product or is admin
  if (product.seller.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You can only delete your own products.'
    });
  }

  // Soft delete by changing status
  product.status = 'archived';
  await product.save();

  res.json({
    success: true,
    message: 'Product deleted successfully'
  });
}));

// @desc    Get seller products
// @route   GET /api/products/seller/:sellerId
// @access  Public
router.get('/seller/:sellerId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find({ 
      seller: req.params.sellerId, 
      status: 'active', 
      visibility: 'public' 
    })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'),
    Product.countDocuments({ 
      seller: req.params.sellerId, 
      status: 'active', 
      visibility: 'public' 
    })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
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

// @desc    Get products by category
// @route   GET /api/products/category/:categoryId
// @access  Public
router.get('/category/:categoryId', asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [products, total] = await Promise.all([
    Product.find({ 
      category: req.params.categoryId, 
      status: 'active', 
      visibility: 'public' 
    })
      .populate('seller', 'firstName lastName company.name company.logo')
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'),
    Product.countDocuments({ 
      category: req.params.categoryId, 
      status: 'active', 
      visibility: 'public' 
    })
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
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

// @desc    Search products
// @route   GET /api/products/search
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
    visibility: 'public',
    $text: { $search: searchQuery }
  };

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate('seller', 'firstName lastName company.name company.logo')
      .populate('category', 'name slug')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-__v'),
    Product.countDocuments(query)
  ]);

  const totalPages = Math.ceil(total / parseInt(limit));

  res.json({
    success: true,
    data: {
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

// @desc    Get related products
// @route   GET /api/products/:id/related
// @access  Public
router.get('/:id/related', asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  // Find related products based on category and tags
  const relatedProducts = await Product.find({
    _id: { $ne: product._id },
    status: 'active',
    visibility: 'public',
    $or: [
      { category: product.category },
      { tags: { $in: product.tags } },
      { brand: product.brand }
    ]
  })
    .populate('seller', 'firstName lastName company.name company.logo')
    .populate('category', 'name slug')
    .sort({ 'rating.average': -1, views: -1 })
    .limit(8)
    .select('-__v');

  res.json({
    success: true,
    data: { products: relatedProducts }
  });
}));

module.exports = router;