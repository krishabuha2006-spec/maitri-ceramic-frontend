import api from './api';

/**
 * Service for Module 1: Authentication & Sessions
 * Handles Login, Token Refresh, Logout, and User Profile (Me).
 */
export const authService = {
  /**
   * POST /auth/login
   * User login (Issues Access Token & Rotating Refresh Token)
   */
  async login(credentials) {
    try {
      const res = await api.post('/auth/login', credentials);
      return res.data;
    } catch (err) {
      if (err.response && err.response.data) {
        return { success: false, ...err.response.data, status: err.response.status };
      }
      return { success: false, message: err.message || 'Server connection failed' };
    }
  },

  /**
   * POST /auth/refresh-token
   * Rotate and renew Access Token & Refresh Token pair
   */
  async refreshToken(refreshToken) {
    const res = await api.post('/auth/refresh-token', { refreshToken });
    return res.data;
  },

  /**
   * POST /auth/logout
   * Logout user & invalidate refresh token
   */
  async logout(refreshToken) {
    try {
      const res = await api.post('/auth/logout', { refreshToken });
      return res.data;
    } catch (err) {}
    return { success: true };
  },

  /**
   * GET /auth/me
   * Get current logged-in user profile & assigned permissions
   */
  async getMe() {
    try {
      const res = await api.get('/auth/me');
      return res.data;
    } catch (err) {
      return null;
    }
  }
};

export default authService;
