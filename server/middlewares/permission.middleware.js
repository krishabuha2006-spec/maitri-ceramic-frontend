const { sendError } = require('../utils/response.util');
const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');

/**
 * Granular User-Wise Permission Middleware
 *
 * Checks UserPermission collection at runtime for the authenticated user.
 * Role is never checked for action authorization (Role is only metadata / template).
 *
 * @param {string} moduleKey - E.g. 'PRODUCT_MASTER', 'QUOTATION', 'USER_MANAGEMENT'
 * @param {'view'|'create'|'edit'|'delete'|'export'|'approve'} action - The granular action required
 */
const checkPermission = (moduleKey, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return sendError(res, 'Authentication required before checking permissions.', 401);
      }

      // Super Admin (System Role) has universal bypass
      if (req.user.role && req.user.role.isSystemRole) {
        req.userPermission = {
          dataScope: 'ALL',
          actions: {
            view: true,
            create: true,
            edit: true,
            delete: true,
            export: true,
            approve: true
          }
        };
        return next();
      }

      // Resolve module by moduleKey
      const systemModule = await SystemModule.findOne({
        moduleKey: moduleKey.toUpperCase(),
        isActive: true
      });

      if (!systemModule) {
        return sendError(
          res,
          `Access Denied: System module '${moduleKey}' not found or inactive.`,
          403
        );
      }

      // Query UserPermission directly for this user and module
      const userPermission = await UserPermission.findOne({
        user: req.user._id,
        module: systemModule._id,
        isActive: true
      });

      if (!userPermission) {
        return sendError(
          res,
          `Access Denied: No permissions granted for module '${moduleKey}'.`,
          403
        );
      }

      // Verify specific independent action flag
      if (!userPermission.actions || userPermission.actions[action] !== true) {
        return sendError(
          res,
          `Access Denied: You do not have '${action}' permission on '${moduleKey}'.`,
          403
        );
      }

      // Attach resolved userPermission to request for downstream dataScope filtering
      req.userPermission = userPermission;
      next();
    } catch (error) {
      return sendError(res, `Permission evaluation error: ${error.message}`, 500);
    }
  };
};

/**
 * DataScope Filter Helper Middleware
 *
 * Inspects req.userPermission.dataScope:
 * - 'OWN' -> sets req.scopeFilter = { createdBy: req.user._id }
 * - 'TEAM' -> sets req.scopeFilter = { createdBy: req.user._id }
 * - 'ALL' -> sets req.scopeFilter = {}
 */
const applyDataScope = (req, res, next) => {
  const scope = req.userPermission ? req.userPermission.dataScope : 'ALL';
  req.scopeFilter = {};

  if (scope === 'OWN') {
    req.scopeFilter = { createdBy: req.user._id };
  } else if (scope === 'TEAM') {
    req.scopeFilter = { createdBy: req.user._id };
  }

  next();
};

module.exports = {
  checkPermission,
  applyDataScope
};
