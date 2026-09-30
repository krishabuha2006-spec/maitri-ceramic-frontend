import axios from 'axios';

// Live backend URL configured via environment variable with same-domain fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

// Utility to check if a valid auth token is stored
export const hasRealJwtToken = () => {
  try {
    const token = localStorage.getItem('maitri_auth_token');
    if (!token || token === 'null' || token === 'undefined' || token === 'maitri_active_session_token_2026' || token === 'fallback-jwt-token') {
      return false;
    }
    return token.trim().length > 10;
  } catch (err) {
    return false;
  }
};

// Attach Authorization Bearer token only if it is a valid real JWT
api.interceptors.request.use(
  (config) => {
    if (hasRealJwtToken()) {
      const token = localStorage.getItem('maitri_auth_token');
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: on 401 Unauthorized, clear auth token and redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error?.response?.status;
    const requestUrl = originalRequest?.url || '';

    const isAuthEndpoint = requestUrl.includes('/auth/login');

    if (status === 401 && !isAuthEndpoint) {
      try {
        localStorage.removeItem('maitri_auth_token');
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } catch (e) { }
    }

    return Promise.reject(error);
  }
);

// Helper utility to safely extract data array from any backend API response format
export const extractArray = (resData, preferredKeys = []) => {
  if (!resData) return [];
  if (Array.isArray(resData)) return resData;

  const inner = resData.data;
  if (Array.isArray(inner)) return inner;

  if (resData && typeof resData === 'object') {
    for (const key of preferredKeys) {
      if (Array.isArray(resData[key])) return resData[key];
    }

    if (inner && typeof inner === 'object') {
      for (const key of preferredKeys) {
        if (Array.isArray(inner[key])) return inner[key];
      }

      for (const k of Object.keys(inner)) {
        if (Array.isArray(inner[k])) return inner[k];
      }
    }

    for (const k of Object.keys(resData)) {
      if (Array.isArray(resData[k])) return resData[k];
    }
  }

  return [];
};

export default api;
