import axios from 'axios';

// Base URL (single source of truth)
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
export const API_URL = API_BASE_URL;

// Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach auth token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export { api };
export default api;
