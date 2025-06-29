import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smartbite_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('smartbite_token');
      localStorage.removeItem('smartbite_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  verify: () => api.get('/auth/verify'),
};

// Users API
export const usersAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getUsers: (params) => api.get('/users', { params }),
  toggleUserStatus: (userId) => api.put(`/users/${userId}/toggle-status`),
  deleteUser: (userId) => api.delete(`/users/${userId}`),
};

// Restaurants API
export const restaurantsAPI = {
  getRestaurants: (params) => api.get('/restaurants', { params }),
  getRestaurant: (id) => api.get(`/restaurants/${id}`),
  createRestaurant: (data) => api.post('/restaurants', data),
  updateRestaurant: (id, data) => api.put(`/restaurants/${id}`, data),
  getMyRestaurant: () => api.get('/restaurants/owner/my-restaurant'),
};

// Menu API
export const menuAPI = {
  getMenuItems: (restaurantId, params) => api.get(`/menu/restaurant/${restaurantId}`, { params }),
  getMenuItem: (id) => api.get(`/menu/${id}`),
  createMenuItem: (data) => api.post('/menu', data),
  updateMenuItem: (id, data) => api.put(`/menu/${id}`, data),
  deleteMenuItem: (id) => api.delete(`/menu/${id}`),
};

// Orders API
export const ordersAPI = {
  getCustomerOrders: () => api.get('/orders/customer'),
  getRestaurantOrders: () => api.get('/orders/restaurant'),
  getAvailableDeliveries: () => api.get('/orders/available-deliveries'),
  getAgentOrders: () => api.get('/orders/agent'),
  createOrder: (data) => api.post('/orders', data),
  updateOrderStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  acceptDelivery: (id) => api.put(`/orders/${id}/accept-delivery`),
};

// Location API
export const locationAPI = {
  updateLocation: (data) => api.post('/location/update', data),
  trackOrder: (orderId) => api.get(`/location/track/${orderId}`),
  getLocationHistory: (orderId) => api.get(`/location/history/${orderId}`),
};

export default api;