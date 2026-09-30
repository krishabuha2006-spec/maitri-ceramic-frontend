const User = require('../models/User');
const Role = require('../models/Role');
const RoleDefaultPermission = require('../models/RoleDefaultPermission');
const UserPermission = require('../models/UserPermission');
const RefreshToken = require('../models/RefreshToken');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new User & auto-copy Role default permissions
 * @route   POST /api/users
 * @access  checkPermission('USER_MANAGEMENT', 'create')
 */
const createUser = async (req, res, next) => {
  try {
    const { name, mobile, email, password, roleId } = req.body;

    if (!name || !mobile || !password) {
      return sendError(res, 'Name, mobile, and password are required.', 400);
    }

    // Check duplicate mobile
    const existingUser = await User.findOne({ mobile: mobile.trim() });
    if (existingUser) {
      return sendError(res, `User with mobile '${mobile}' already exists.`, 400);
    }

    let roleDoc = null;
    if (roleId) {
      roleDoc = await Role.findById(roleId);
      if (!roleDoc) {
        return sendError(res, 'Specified Role does not exist.', 400);
      }
    }

    const passwordHash = await User.hashPassword(password);

    const user = await User.create({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim().toLowerCase() : null,
      passwordHash,
      role: roleDoc ? roleDoc._id : null,
      createdBy: req.user ? req.user._id : null,
      isActive: true
    });

    // Auto-copy RoleDefaultPermission -> UserPermission if role exists
    if (roleDoc) {
      const defaultPerms = await RoleDefaultPermission.find({ role: roleDoc._id });

      if (defaultPerms.length > 0) {
        const userPermDocs = defaultPerms.map((dp) => ({
          user: user._id,
          module: dp.module,
          actions: {
            view: dp.actions.view,
            create: dp.actions.create,
            edit: dp.actions.edit,
            delete: dp.actions.delete,
            export: dp.actions.export,
            approve: dp.actions.approve
          },
          dataScope: 'OWN',
          grantedBy: req.user ? req.user._id : user._id,
          isActive: true
        }));

        await UserPermission.insertMany(userPermDocs);
      }
    }

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'CREATE',
      entityType: 'User',
      entityId: user._id,
      entityLabel: `User ${user.name} (${user.mobile})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] User create log error:', err.message));

    const populatedUser = await User.findById(user._id).populate('role');
    return sendSuccess(res, 'User created successfully with role template permissions.', populatedUser, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of all users
 * @route   GET /api/users
 * @access  checkPermission('USER_MANAGEMENT', 'view')
 */
const getUsers = async (req, res, next) => {
  try {
    const { search, role, isActive, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('role')
        .populate('createdBy', 'name mobile')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      User.countDocuments(filter)
    ]);

    return sendSuccess(res, 'Users retrieved successfully.', {
      users,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single user with permissions
 * @route   GET /api/users/:id
 * @access  checkPermission('USER_MANAGEMENT', 'view')
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).populate('role').populate('createdBy', 'name mobile');
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    const permissions = await UserPermission.find({ user: id }).populate('module');

    return sendSuccess(res, 'User retrieved successfully.', {
      user,
      permissions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/users/:id
 * @access  checkPermission('USER_MANAGEMENT', 'edit')
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, mobile, email, roleId, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    const oldUser = { name: user.name, mobile: user.mobile, email: user.email, role: user.role, isActive: user.isActive };

    if (mobile && mobile.trim() !== user.mobile) {
      const duplicate = await User.findOne({ mobile: mobile.trim(), _id: { $ne: id } });
      if (duplicate) {
        return sendError(res, `Mobile '${mobile}' is already registered to another user.`, 400);
      }
      user.mobile = mobile.trim();
    }

    if (name) user.name = name.trim();
    if (email !== undefined) user.email = email ? email.trim().toLowerCase() : null;
    if (roleId) {
      const roleExists = await Role.findById(roleId);
      if (!roleExists) {
        return sendError(res, 'Specified Role does not exist.', 400);
      }
      user.role = roleId;
    }
    if (isActive !== undefined) user.isActive = isActive;

    await user.save();

    const diff = activityLogService.computeDiff(oldUser, user, ['name', 'mobile', 'email', 'role', 'isActive']);
    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      entityLabel: `User ${user.name} (${user.mobile})`,
      changeSummary: diff,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] User update log error:', err.message));

    const updatedUser = await User.findById(id).populate('role');
    return sendSuccess(res, 'User updated successfully.', updatedUser);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate user & invalidate all active sessions
 * @route   PUT /api/users/:id/deactivate
 * @access  checkPermission('USER_MANAGEMENT', 'delete')
 */
const deactivateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    user.isActive = false;
    await user.save();

    // Invalidate all active Refresh Tokens for this user
    await RefreshToken.updateMany({ user: id, isRevoked: false }, { $set: { isRevoked: true } });

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'DELETE',
      entityType: 'User',
      entityId: user._id,
      entityLabel: `User ${user.name} deactivated`,
      changeSummary: { isActive: { before: true, after: false } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] User deactivate log error:', err.message));

    return sendSuccess(res, 'User deactivated successfully and all active sessions revoked.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset user password & revoke active sessions
 * @route   PUT /api/users/:id/reset-password
 * @access  checkPermission('USER_MANAGEMENT', 'edit')
 */
const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return sendError(res, 'Password must be at least 6 characters long.', 400);
    }

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();

    // Revoke previous tokens
    await RefreshToken.updateMany({ user: id, isRevoked: false }, { $set: { isRevoked: true } });

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      entityLabel: `Password reset for user ${user.name}`,
      changeSummary: { passwordChanged: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Password reset log error:', err.message));

    return sendSuccess(res, 'Password reset successfully. Active sessions invalidated.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete User and cascade purge permissions and sessions
 * @route   DELETE /api/users/:id
 * @access  checkPermission('USER_MANAGEMENT', 'delete')
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id).populate('role');
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    // Safety guard: Super Admin / System Role user cannot be deleted
    if (user.role && user.role.isSystemRole) {
      return sendError(res, 'System Admin user with a system role cannot be deleted.', 403);
    }

    // Prevent deleting oneself
    if (req.user && String(req.user._id) === String(id)) {
      return sendError(res, 'You cannot delete your own active user account.', 400);
    }

    // 1. Delete all User Permissions
    const permRes = await UserPermission.deleteMany({ user: id });

    // 2. Delete all Refresh Tokens / active sessions
    const tokenRes = await RefreshToken.deleteMany({ user: id });

    // 3. Delete the User document
    await User.deleteOne({ _id: id });

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'DELETE',
      entityType: 'User',
      entityId: user._id,
      entityLabel: `User ${user.name} permanently deleted`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] User delete log error:', err.message));

    return sendSuccess(res, 'User and all associated permissions and sessions deleted successfully.', {
      userId: user._id,
      name: user.name,
      mobile: user.mobile,
      deletedUser: true,
      deletedPermissions: permRes.deletedCount || 0,
      deletedRefreshTokens: tokenRes.deletedCount || 0
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deactivateUser,
  resetPassword,
  deleteUser
};
