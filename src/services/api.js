import axios from 'axios';

// Live backend URL configured via environment variable with fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://maitri-cermic.vercel.app/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  timeout: 30000
});

// Utility to check if a valid 3-part JWT token (header.payload.signature) is stored
export const hasRealJwtToken = () => {
  try {
    const token = localStorage.getItem('maitri_auth_token');
    if (!token || token === 'null' || token === 'undefined' || token === 'maitri_active_session_token_2026' || token === 'fallback-jwt-token') {
      return false;
    }
    const parts = token.split('.');
    return parts.length === 3;
  } catch (err) {
    return false;
  }
};

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Attach Authorization Bearer token only if it is a valid real JWT
api.interceptors.request.use(
  (config) => {
    if (hasRealJwtToken()) {
      const token = localStorage.getItem('maitri_auth_token');
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      // Remove any leftover stale/fake Authorization header
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with automatic 401 refresh logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const status = error?.response?.status;
    const requestUrl = originalRequest?.url || '';

    const isAuthEndpoint = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh-token');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      const refreshToken = localStorage.getItem('maitri_refresh_token');

      if (refreshToken && refreshToken !== 'null' && refreshToken !== 'undefined') {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh-token`, { refreshToken });
          const data = res.data?.data || res.data;
          const newAccessToken = data?.accessToken || data?.token;
          const newRefreshToken = data?.refreshToken;

          if (newAccessToken) {
            localStorage.setItem('maitri_auth_token', newAccessToken);
            if (newRefreshToken) {
              localStorage.setItem('maitri_refresh_token', newRefreshToken);
            }
            api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

            processQueue(null, newAccessToken);
            isRefreshing = false;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          processQueue(refreshErr, null);
          isRefreshing = false;
        }
      }

      // Clear invalid tokens on 401 and redirect to login
      try {
        localStorage.removeItem('maitri_auth_token');
        localStorage.removeItem('maitri_refresh_token');
        localStorage.removeItem('maitri_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } catch (e) {}
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

  const target = (inner && typeof inner === 'object') ? inner : resData;
  if (Array.isArray(target)) return target;

  const keysToTry = [
    ...preferredKeys,
    'users', 'roles', 'products', 'customers', 'quotations', 'invoices',
    'challans', 'payments', 'returns', 'entries', 'movements', 'companies',
    'productGroups', 'modules', 'items', 'docs', 'records', 'list', 'data'
  ];

  for (const key of keysToTry) {
    if (target[key] && Array.isArray(target[key])) return target[key];
    if (resData[key] && Array.isArray(resData[key])) return resData[key];
  }

  return [];
};

export default api;
