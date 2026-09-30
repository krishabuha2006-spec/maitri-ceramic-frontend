const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'developer-secret-key-2508';
const ACCESS_TOKEN_EXPIRE = process.env.JWT_ACCESS_EXPIRE || '15m';
const REFRESH_TOKEN_DAYS = parseInt(process.env.JWT_REFRESH_DAYS, 10) || 7;

/**
 * Generate short-lived JWT access token
 * @param {Object} payload - { id, mobile, role }
 * @returns {string} Signed JWT
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRE
  });
};

/**
 * Generate random opaque refresh token and its SHA-256 hash
 * @returns {{ token: string, tokenHash: string, expiresAt: Date }}
 */
const generateRefreshToken = () => {
  const token = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);

  return {
    token,
    tokenHash,
    expiresAt
  };
};

/**
 * Hash a plain token using SHA-256
 * @param {string} token
 * @returns {string} Hex hash
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Verify JWT access token
 * @param {string} token
 * @returns {Object} Decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken
};
