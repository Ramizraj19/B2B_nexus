import api from './config';

export const ordersAPI = {
  // Get user's orders
  getOrders: async (params = {}) => {
    try {
      const response = await api.get('/orders', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get a single order by ID
  getOrder: async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Create new order
  createOrder: async (orderData) => {
    try {
      const response = await api.post('/orders', orderData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update order status (for sellers/admin)
  updateOrderStatus: async (orderId, status, notes = '') => {
    try {
      const response = await api.put(`/orders/${orderId}/status`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Cancel order
  cancelOrder: async (orderId, reason = '') => {
    try {
      const response = await api.put(`/orders/${orderId}/cancel`, {
        reason
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get order tracking information
  getOrderTracking: async (orderId) => {
    try {
      const response = await api.get(`/orders/${orderId}/tracking`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update shipping information
  updateShippingInfo: async (orderId, shippingData) => {
    try {
      const response = await api.put(`/orders/${orderId}/shipping`, shippingData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get orders by status
  getOrdersByStatus: async (status, params = {}) => {
    try {
      const response = await api.get('/orders', {
        params: { ...params, status }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get seller's orders (for sellers)
  getSellerOrders: async (params = {}) => {
    try {
      const response = await api.get('/orders/seller', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get order statistics
  getOrderStats: async (params = {}) => {
    try {
      const response = await api.get('/orders/stats', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};
