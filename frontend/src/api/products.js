import api from './config';

export const productsAPI = {
  // Get all products with optional filters
  getProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get a single product by ID
  getProduct: async (productId) => {
    try {
      const response = await api.get(`/products/${productId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get products by category
  getProductsByCategory: async (categoryId, params = {}) => {
    try {
      const response = await api.get('/products', {
        params: { ...params, category: categoryId }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Search products
  searchProducts: async (searchTerm, params = {}) => {
    try {
      const response = await api.get('/products', {
        params: { ...params, search: searchTerm }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get featured products
  getFeaturedProducts: async (params = {}) => {
    try {
      const response = await api.get('/products', {
        params: { ...params, featured: true }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get seller's products (requires authentication)
  getMyProducts: async (params = {}) => {
    try {
      const response = await api.get('/products/my-products', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new product (requires seller authentication)
  createProduct: async (productData) => {
    try {
      const response = await api.post('/products', productData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update product (requires seller authentication)
  updateProduct: async (productId, productData) => {
    try {
      const response = await api.put(`/products/${productId}`, productData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete product (requires seller authentication)
  deleteProduct: async (productId) => {
    try {
      const response = await api.delete(`/products/${productId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get product categories
  getCategories: async () => {
    try {
      const response = await api.get('/categories');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
