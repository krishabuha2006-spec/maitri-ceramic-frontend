const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');
const User = require('../models/User');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

const SYSTEM_MODULES_LIST = [
  { moduleKey: 'USER_MANAGEMENT', moduleName: 'User & Permission Management', parentModule: 'SETTINGS' },
  { moduleKey: 'COMPANY_SETTINGS', moduleName: 'Company Settings', parentModule: 'SETTINGS' },
  { moduleKey: 'AUDIT_LOG', moduleName: 'Audit & Activity Log', parentModule: 'SETTINGS' },
  
  // Master Management Modules
  { moduleKey: 'MASTER_MANAGEMENT', moduleName: 'Master Management Overview', parentModule: 'MASTERS' },
  { moduleKey: 'COMPANY_MASTER', moduleName: 'Company Master', parentModule: 'MASTERS' },
  { moduleKey: 'PRODUCT_GROUP_MASTER', moduleName: 'Product Group Master', parentModule: 'MASTERS' },
  { moduleKey: 'PRODUCT_MASTER', moduleName: 'Product Master', parentModule: 'MASTERS' },
  { moduleKey: 'VENDOR_MASTER', moduleName: 'Vendor Master', parentModule: 'MASTERS' },
  { moduleKey: 'UNIT_MASTER', moduleName: 'Unit Master', parentModule: 'MASTERS' },
  { moduleKey: 'TAX_MASTER', moduleName: 'Tax Master', parentModule: 'MASTERS' },
  { moduleKey: 'PAYMENT_MODE_MASTER', moduleName: 'Payment Mode Master', parentModule: 'MASTERS' },
  { moduleKey: 'QUOTATION_FORMAT_MASTER', moduleName: 'Quotation Format Master', parentModule: 'MASTERS' },
  { moduleKey: 'PRODUCT_IMPORT', moduleName: 'Product Import (Excel/PDF)', parentModule: 'MASTERS' },

  // Transactional Modules
  { moduleKey: 'CUSTOMER', moduleName: 'Customer Management', parentModule: 'SALES' },
  { moduleKey: 'QUOTATION', moduleName: 'Quotation Management', parentModule: 'SALES' },
  { moduleKey: 'FOLLOW_UP', moduleName: 'Follow-Up Management', parentModule: 'SALES' },
  { moduleKey: 'QUOTATION_CONFIRMATION', moduleName: 'Quotation Confirmation', parentModule: 'SALES' },
  { moduleKey: 'STOCK', moduleName: 'Stock Management', parentModule: 'INVENTORY' },
  { moduleKey: 'CHALLAN', moduleName: 'Challan Management', parentModule: 'INVENTORY' },
  { moduleKey: 'INVOICE', moduleName: 'Invoice Management', parentModule: 'BILLING' },
  { moduleKey: 'PAYMENT', moduleName: 'Payment Management', parentModule: 'BILLING' },
  { moduleKey: 'RETURN_NOTE', moduleName: 'Return Management', parentModule: 'BILLING' },
  { moduleKey: 'CUSTOMER_LEDGER', moduleName: 'Customer Ledger & Accounts', parentModule: 'ACCOUNTS' },
  { moduleKey: 'PRODUCT_QUOTATION_TRACKING', moduleName: 'Product-Quotation Tracking', parentModule: 'REPORTS' },
  { moduleKey: 'PRODUCT_TRACKING', moduleName: 'Product Tracking', parentModule: 'REPORTS' },
  { moduleKey: 'REPORTS', moduleName: 'Reports & Analytics', parentModule: 'REPORTS' }
];

/**
 * @desc    Seed system modules idempotently
 * @route   POST /api/permissions/modules/seed
 * @access  Public / Super Admin bootstrap
 */
const seedModules = async (req, res, next) => {
  try {
    const results = [];

    for (const mod of SYSTEM_MODULES_LIST) {
      const updated = await SystemModule.findOneAndUpdate(
        { moduleKey: mod.moduleKey },
        {
          $set: {
            moduleName: mod.moduleName,
            parentModule: mod.parentModule,
            isActive: true
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      results.push(updated);
    }

    return sendSuccess(res, `Successfully seeded ${results.length} system modules.`, results);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all System Modules
 * @route   GET /api/permissions/modules
 * @access  checkPermission('USER_MANAGEMENT', 'view')
 */
const getModules = async (req, res, next) => {
  try {
    const modules = await SystemModule.find({ isActive: true }).sort({ parentModule: 1, moduleName: 1 });
    return sendSuccess(res, 'System modules retrieved successfully.', modules);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Assign or update User-Wise Permissions (Independent of Role)
 * @route   POST /api/permissions/assign
 * @access  checkPermission('USER_MANAGEMENT', 'approve')
 */
const assignUserPermissions = async (req, res, next) => {
  try {
    const { userId, permissions } = req.body;

    if (!userId) {
      return sendError(res, 'Target userId is required.', 400);
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return sendError(res, 'Target user does not exist.', 404);
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return sendError(res, 'Permissions array is required.', 400);
    }

    const updatedPermissions = [];

    for (const item of permissions) {
      const { moduleKey, moduleId, actions, dataScope } = item;

      let moduleDoc;
      if (moduleId) {
        moduleDoc = await SystemModule.findById(moduleId);
      } else if (moduleKey) {
        moduleDoc = await SystemModule.findOne({ moduleKey: moduleKey.toUpperCase() });
      }

      if (!moduleDoc) {
        continue;
      }

      const formattedActions = {
        view: Boolean(actions?.view),
        create: Boolean(actions?.create),
        edit: Boolean(actions?.edit),
        delete: Boolean(actions?.delete),
        export: Boolean(actions?.export),
        approve: Boolean(actions?.approve)
      };

      const validDataScope = ['ALL', 'OWN', 'TEAM'].includes(dataScope) ? dataScope : 'OWN';

      const userPerm = await UserPermission.findOneAndUpdate(
        { user: userId, module: moduleDoc._id },
        {
          $set: {
            actions: formattedActions,
            dataScope: validDataScope,
            grantedBy: req.user._id,
            isActive: true
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate('module');

      updatedPermissions.push(userPerm);
    }

    // Fire-and-forget PERMISSION_CHANGE audit log with full unredacted diff
    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'PERMISSION_CHANGE',
      entityType: 'UserPermission',
      entityId: targetUser._id,
      entityLabel: `Permissions assigned for user ${targetUser.name}`,
      changeSummary: {
        targetUserId: targetUser._id,
        targetUserName: targetUser.name,
        assignedPermissions: permissions
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Permission assign log error:', err.message));

    return sendSuccess(res, 'User permissions assigned and updated successfully.', updatedPermissions);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get permissions for a specific user
 * @route   GET /api/permissions/user/:userId
 * @access  checkPermission('USER_MANAGEMENT', 'view')
 */
const getUserPermissions = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('role');
    if (!user) {
      return sendError(res, 'User not found.', 404);
    }

    const permissions = await UserPermission.find({ user: userId }).populate('module');
    return sendSuccess(res, 'User permissions retrieved successfully.', {
      user,
      permissions
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Revoke a user's permissions on a specific module
 * @route   PUT /api/permissions/revoke
 * @access  checkPermission('USER_MANAGEMENT', 'approve')
 */
const revokeUserPermission = async (req, res, next) => {
  try {
    const { userId, moduleKey, moduleId } = req.body;

    if (!userId || (!moduleKey && !moduleId)) {
      return sendError(res, 'userId and moduleKey/moduleId are required.', 400);
    }

    let moduleDoc;
    if (moduleId) {
      moduleDoc = await SystemModule.findById(moduleId);
    } else {
      moduleDoc = await SystemModule.findOne({ moduleKey: moduleKey.toUpperCase() });
    }

    if (!moduleDoc) {
      return sendError(res, 'System module not found.', 404);
    }

    const updated = await UserPermission.findOneAndUpdate(
      { user: userId, module: moduleDoc._id },
      {
        $set: {
          'actions.view': false,
          'actions.create': false,
          'actions.edit': false,
          'actions.delete': false,
          'actions.export': false,
          'actions.approve': false,
          isActive: false
        }
      },
      { new: true }
    );

    // Fire-and-forget PERMISSION_CHANGE audit log
    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'PERMISSION_CHANGE',
      entityType: 'UserPermission',
      entityId: updated?._id || moduleDoc._id,
      entityLabel: `Permissions revoked on ${moduleDoc.moduleName} for user ${userId}`,
      changeSummary: {
        targetUserId: userId,
        moduleKey: moduleDoc.moduleKey,
        revoked: true
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Permission revoke log error:', err.message));

    return sendSuccess(res, `Permissions on '${moduleDoc.moduleName}' revoked successfully.`, updated);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's menu - modules with AT LEAST ONE true action
 * @route   GET /api/permissions/my-menu
 * @access  Authenticated
 */
const getMyMenu = async (req, res, next) => {
  try {
    const user = req.user;

    // Super Admin receives all system modules with full actions
    if (user.role && user.role.isSystemRole) {
      const allModules = await SystemModule.find({ isActive: true }).sort({ parentModule: 1, moduleName: 1 });
      const menu = allModules.map((m) => ({
        moduleKey: m.moduleKey,
        moduleName: m.moduleName,
        parentModule: m.parentModule,
        dataScope: 'ALL',
        actions: {
          view: true,
          create: true,
          edit: true,
          delete: true,
          export: true,
          approve: true
        }
      }));

      return sendSuccess(res, 'Menu generated for Super Admin.', menu);
    }

    // Standard user: query UserPermission collection
    const userPermissions = await UserPermission.find({
      user: user._id,
      isActive: true
    }).populate('module');

    // Filter modules where AT LEAST ONE action is true
    const activeMenu = [];

    for (const up of userPermissions) {
      if (!up.module || !up.module.isActive) continue;

      const act = up.actions || {};
      const hasAnyAction = act.view || act.create || act.edit || act.delete || act.export || act.approve;

      if (hasAnyAction) {
        activeMenu.push({
          moduleKey: up.module.moduleKey,
          moduleName: up.module.moduleName,
          parentModule: up.module.parentModule,
          dataScope: up.dataScope,
          actions: {
            view: Boolean(act.view),
            create: Boolean(act.create),
            edit: Boolean(act.edit),
            delete: Boolean(act.delete),
            export: Boolean(act.export),
            approve: Boolean(act.approve)
          }
        });
      }
    }

    return sendSuccess(res, 'My Menu retrieved successfully.', activeMenu);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  seedModules,
  getModules,
  assignUserPermissions,
  getUserPermissions,
  revokeUserPermission,
  getMyMenu,
  SYSTEM_MODULES_LIST
};
