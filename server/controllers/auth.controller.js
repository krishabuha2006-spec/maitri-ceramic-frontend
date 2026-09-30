const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const UserPermission = require('../models/UserPermission');
const activityLogService = require('../services/activityLog.service');
const { generateAccessToken, generateRefreshToken, hashToken } = require('../utils/jwt.util');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Login user & issue Access + Refresh tokens
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { mobile, email, username, identifier, password } = req.body;

    const userInput = (identifier || mobile || email || username || '').trim();

    if (!userInput || !password) {
      return sendError(res, 'Please provide mobile number or email address, along with your password.', 400);
    }

    // Escape regex characters for safe matching
    const safeInput = userInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Find user by either mobile number, email address (case-insensitive), or username
    const user = await User.findOne({
      $or: [
        { mobile: userInput },
        { email: { $regex: `^${safeInput}$`, $options: 'i' } },
        { name: { $regex: `^${safeInput}$`, $options: 'i' } }
      ]
    }).populate('role');

    if (!user) {
      return sendError(res, 'Invalid credentials.', 401);
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return sendError(res, 'Invalid credentials.', 401);
    }

    // Check account status
    if (!user.isActive) {
      return sendError(res, 'Your account has been deactivated. Please contact administrator.', 401);
    }

    // Generate Access Token & Refresh Token
    const accessToken = generateAccessToken({
      id: user._id,
      mobile: user.mobile,
      role: user.role?._id || null
    });

    const { token: plainRefreshToken, tokenHash, expiresAt } = generateRefreshToken();

    // Store hashed refresh token in DB
    await RefreshToken.create({
      user: user._id,
      tokenHash,
      expiresAt
    });

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    const userData = user.toObject();

    // Fire-and-forget activity log recording
    activityLogService.record({
      user: user._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'LOGIN',
      entityType: 'User',
      entityId: user._id,
      entityLabel: `User ${user.name} logged in`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Login log error:', err.message));

    return sendSuccess(res, 'Login successful.', {
      user: userData,
      accessToken,
      refreshToken: plainRefreshToken,
      expiresIn: '15m'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Rotate and issue new Access Token + Refresh Token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: incomingToken } = req.body;

    if (!incomingToken) {
      return sendError(res, 'Refresh token is required.', 400);
    }

    const tokenHash = hashToken(incomingToken);

    // Look up token
    const storedToken = await RefreshToken.findOne({
      tokenHash,
      isRevoked: false
    });

    if (!storedToken) {
      return sendError(res, 'Invalid or revoked refresh token.', 401);
    }

    // Check expiry
    if (new Date() > storedToken.expiresAt) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return sendError(res, 'Refresh token has expired. Please login again.', 401);
    }

    // Lookup user
    const user = await User.findById(storedToken.user).populate('role');
    if (!user || !user.isActive) {
      storedToken.isRevoked = true;
      await storedToken.save();
      return sendError(res, 'User account is inactive or not found.', 401);
    }

    // Revoke current refresh token (Rotation)
    storedToken.isRevoked = true;
    await storedToken.save();

    // Generate new pair
    const newAccessToken = generateAccessToken({
      id: user._id,
      mobile: user.mobile,
      role: user.role?._id || null
    });

    const { token: newPlainRefreshToken, tokenHash: newTokenHash, expiresAt } = generateRefreshToken();

    await RefreshToken.create({
      user: user._id,
      tokenHash: newTokenHash,
      expiresAt
    });

    return sendSuccess(res, 'Token refreshed successfully.', {
      accessToken: newAccessToken,
      refreshToken: newPlainRefreshToken
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Logout user & revoke refresh token
 * @route   POST /api/auth/logout
 * @access  Authenticated / Public with token
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: incomingToken } = req.body;
    let loggedOutUserId = req.user?._id;

    if (incomingToken) {
      const tokenHash = hashToken(incomingToken);
      const storedToken = await RefreshToken.findOne({ tokenHash });
      if (storedToken) {
        loggedOutUserId = loggedOutUserId || storedToken.user;
      }
      await RefreshToken.updateOne({ tokenHash }, { $set: { isRevoked: true } });
    } else if (req.user) {
      // Revoke all active tokens for this user
      await RefreshToken.updateMany({ user: req.user._id, isRevoked: false }, { $set: { isRevoked: true } });
    }

    if (loggedOutUserId) {
      activityLogService.record({
        user: loggedOutUserId,
        moduleKey: 'USER_MANAGEMENT',
        actionType: 'LOGOUT',
        entityType: 'User',
        entityId: loggedOutUserId,
        entityLabel: `User logged out`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      }).catch((err) => console.error('[ActivityLog] Logout log error:', err.message));
    }

    return sendSuccess(res, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current logged in user profile & permissions
 * @route   GET /api/auth/me
 * @access  Authenticated
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate('role');

    // Fetch assigned active permissions
    const permissions = await UserPermission.find({
      user: req.user._id,
      isActive: true
    }).populate('module');

    return sendSuccess(res, 'Profile retrieved successfully.', {
      user,
      permissions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  refreshToken,
  logout,
  getMe
};
