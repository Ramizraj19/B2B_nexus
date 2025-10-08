import axios from 'axios';
import { API_URL } from './config';

export const fetchDashboardStats = async () => {
  const response = await axios.get(`${API_URL}/api/admin/dashboard-stats`);
  return response.data.data;
};

export const fetchPendingUsers = async () => {
  const response = await axios.get(`${API_URL}/api/admin/pending-users`);
  return response.data.data;
};

export const updateUserStatus = async (userId, status, rejectionReason = '') => {
  const response = await axios.put(`${API_URL}/api/admin/user/${userId}/status`, {
    status,
    rejectionReason
  });
  return response.data.data;
};

export const updateOrderStatus = async (orderId, status) => {
  const response = await axios.put(`${API_URL}/api/admin/orders/${orderId}/status`, {
    status
  });
  return response.data.data;
};