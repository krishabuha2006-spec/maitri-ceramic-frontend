const Role = require('../models/Role');
const RoleDefaultPermission = require('../models/RoleDefaultPermission');
const SystemModule = require('../models/SystemModule');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new Role
 * @route   POST /api/roles
 * @access  checkPermission('USER_MANAGEMENT', 'create')
 */
const createRole = async (req, res, next) => {
  try {
    const { roleName, description, isActive } = req.body;

    if (!roleName) {
      return sendError(res, 'Role name is required.', 400);
    }

    const existingRole = await Role.findOne({ roleName: roleName.trim() });
    if (existingRole) {
      return sendError(res, `Role '${roleName}' already exists.`, 400);
    }

    const role = await Role.create({
      roleName: roleName.trim(),
      description: description || null,
      isActive: isActive !== undefined ? isActive : true,
      isSystemRole: false
    });

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'CREATE',
      entityType: 'Role',
      entityId: role._id,
      entityLabel: `Role ${role.roleName}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Role create log error:', err.message));

    return sendSuccess(res, 'Role created successfully.', role, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all Roles
 * @route   GET /api/roles
 * @access  checkPermission('USER_MANAGEMENT', 'view')
 */
const getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });
    return sendSuccess(res, 'Roles retrieved successfully.', roles);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Role
 * @route   PUT /api/roles/:id
 * @access  checkPermission('USER_MANAGEMENT', 'edit')
 */
const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { roleName, description, isActive } = req.body;

    const role = await Role.findById(id);
    if (!role) {
      return sendError(res, 'Role not found.', 404);
    }

    // Protect system role name
    if (role.isSystemRole && roleName && roleName.trim() !== role.roleName) {
      return sendError(res, 'System role name cannot be modified.', 400);
    }

    const oldRole = { roleName: role.roleName, description: role.description, isActive: role.isActive };

    if (roleName) {
      const duplicate = await Role.findOne({
        roleName: roleName.trim(),
        _id: { $ne: id }
      });
      if (duplicate) {
        return sendError(res, `Role '${roleName}' already exists.`, 400);
      }
      role.roleName = roleName.trim();
    }

    if (description !== undefined) role.description = description;
    if (isActive !== undefined && !role.isSystemRole) role.isActive = isActive;

    await role.save();

    const diff = activityLogService.computeDiff(oldRole, role);
    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'UPDATE',
      entityType: 'Role',
      entityId: role._id,
      entityLabel: `Role ${role.roleName}`,
      changeSummary: diff,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Role update log error:', err.message));

    return sendSuccess(res, 'Role updated successfully.', role);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete Role
 * @route   DELETE /api/roles/:id
 * @access  checkPermission('USER_MANAGEMENT', 'delete')
 */
const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    const role = await Role.findById(id);
    if (!role) {
      return sendError(res, 'Role not found.', 404);
    }

    if (role.isSystemRole) {
      return sendError(res, 'System roles cannot be deleted.', 400);
    }

    await RoleDefaultPermission.deleteMany({ role: id });
    await Role.findByIdAndDelete(id);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'DELETE',
      entityType: 'Role',
      entityId: role._id,
      entityLabel: `Role ${role.roleName} deleted`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Role delete log error:', err.message));

    return sendSuccess(res, 'Role and its default permissions deleted successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set or update default permissions for a Role template
 * @route   POST /api/roles/:id/default-permissions
 * @access  checkPermission('USER_MANAGEMENT', 'approve')
 */
const setDefaultPermissions = async (req, res, next) => {
  try {
    const { id: roleId } = req.params;
    const { permissions } = req.body;

    const role = await Role.findById(roleId);
    if (!role) {
      return sendError(res, 'Role not found.', 404);
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      return sendError(res, 'Permissions array is required.', 400);
    }

    const results = [];

    for (const item of permissions) {
      const { moduleKey, moduleId, actions } = item;

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

      // Upsert default permission
      const defaultPerm = await RoleDefaultPermission.findOneAndUpdate(
        { role: roleId, module: moduleDoc._id },
        {
          $set: {
            actions: formattedActions
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate('module');

      results.push(defaultPerm);
    }

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'USER_MANAGEMENT',
      actionType: 'PERMISSION_CHANGE',
      entityType: 'RoleDefaultPermission',
      entityId: role._id,
      entityLabel: `Role ${role.roleName} default permissions updated`,
      changeSummary: {
        roleId: role._id,
        roleName: role.roleName,
        permissions
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Role default perm log error:', err.message));

    return sendSuccess(res, 'Role default permissions updated successfully.', results);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get default permissions for a Role
 * @route   GET /api/roles/:id/default-permissions
 * @access  checkPermission('USER_MANAGEMENT', 'view')
 */
const getDefaultPermissions = async (req, res, next) => {
  try {
    const { id: roleId } = req.params;

    const role = await Role.findById(roleId);
    if (!role) {
      return sendError(res, 'Role not found.', 404);
    }

    const defaultPermissions = await RoleDefaultPermission.find({ role: roleId }).populate('module');
    return sendSuccess(res, 'Role default permissions retrieved successfully.', defaultPermissions);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRole,
  getRoles,
  updateRole,
  deleteRole,
  setDefaultPermissions,
  getDefaultPermissions
};
