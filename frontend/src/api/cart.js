import api from './config';

export const cartAPI = {
  // Get user's cart
  getCart: async () => {
    try {
      const response = await api.get('/cart');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Add item to cart
  addToCart: async (productId, quantity, sellerId, notes = '') => {
    try {
      const response = await api.post('/cart/items', {
        productId,
        quantity,
        sellerId,
        notes
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update item quantity in cart
  updateCartItem: async (itemId, quantity) => {
    try {
      const response = await api.put(`/cart/items/${itemId}`, { quantity });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Remove item from cart
  removeFromCart: async (itemId) => {
    try {
      const response = await api.delete(`/cart/items/${itemId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Clear entire cart
  clearCart: async () => {
    try {
      const response = await api.delete('/cart');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Apply discount code to cart
  applyDiscount: async (discountCode) => {
    try {
      const response = await api.post('/cart/discount', { discountCode });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Remove discount from cart
  removeDiscount: async () => {
    try {
      const response = await api.delete('/cart/discount');
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get cart summary (totals, item count, etc.)
  getCartSummary: async () => {
    try {
      const response = await api.get('/cart/summary');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
