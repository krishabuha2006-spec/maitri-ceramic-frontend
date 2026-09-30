const { verifyAccessToken } = require('../utils/jwt.util');
const { sendError } = require('../utils/response.util');
const User = require('../models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Access denied. No authentication token provided.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Access denied. Malformed authorization token.', 401);
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Authentication token expired. Please refresh your session.', 401);
      }
      return sendError(res, 'Invalid authentication token.', 401);
    }

    // Lookup user in DB to ensure account is still active and valid
    const user = await User.findById(decoded.id).populate('role');
    if (!user) {
      return sendError(res, 'User account no longer exists.', 401);
    }

    if (!user.isActive) {
      return sendError(res, 'User account has been deactivated. Access revoked.', 401);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return sendError(res, `Authentication error: ${error.message}`, 500);
  }
};

module.exports = {
  authenticate
};
