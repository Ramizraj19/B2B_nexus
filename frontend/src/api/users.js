import api from './config';

export const usersAPI = {
  // Get current user profile
  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch current user'
      };
    }
  },

  // Update current user profile
  updateProfile: async (userData) => {
    try {
      // Whitelist allowed fields to match backend expectations
      const { firstName, lastName, company, profile, preferences } = userData || {};
      const payload = {};
      if (firstName !== undefined) payload.firstName = firstName;
      if (lastName !== undefined) payload.lastName = lastName;
      if (company !== undefined) payload.company = company;
      if (profile !== undefined) payload.profile = profile;
      if (preferences !== undefined) payload.preferences = preferences;

      const response = await api.put('/auth/profile', payload);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update profile'
      };
    }
  },

  // Get user by ID (admin only)
  getUser: async (userId) => {
    try {
      const response = await api.get(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all users (admin only)
  getAllUsers: async (params = {}) => {
    try {
      const response = await api.get('/users', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update user (admin only)
  updateUser: async (userId, userData) => {
    try {
      const response = await api.put(`/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete user (admin only)
  deleteUser: async (userId) => {
    try {
      const response = await api.delete(`/users/${userId}`);
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete user'
      };
    }
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    try {
      const response = await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to change password'
      };
    }
  },

  // Upload profile picture
  uploadProfilePicture: async (formData) => {
    try {
      const response = await api.post('/users/me/profile-picture', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload profile picture'
      };
    }
  },

  // Get user statistics
  getUserStats: async () => {
    try {
      const response = await api.get('/users/me/stats');
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to fetch user stats'
      };
    }
  },

  // Forgot password
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to initiate password reset'
      };
    }
  },

  // Reset password
  resetPassword: async (token, newPassword) => {
    try {
      const response = await api.post('/auth/reset-password', { token, newPassword });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reset password'
      };
    }
  }
};
