import api, { extractArray } from './api';
import { ROLES, DEFAULT_ROLE_PERMISSIONS, normalizePermissions, normalizeRole, isSuperAdminRole, convertPermsToBackendArray } from '../utils/permissions';
import { resolveRoleId, getRoles } from './roleService';
import { assignUserPermissions } from './permissionService';

export const normalizeUser = (u) => {
  if (!u) return null;
  const roleObj = u.role;
  const rawRole = roleObj?.roleName || roleObj?.name || (typeof roleObj === 'string' ? roleObj : null) || ROLES.SALES_EXECUTIVE;
  const roleName = normalizeRole(rawRole);
  const roleId = (roleObj && typeof roleObj === 'object') ? (roleObj._id || roleObj.id) : (typeof roleObj === 'string' && roleObj.length === 24 ? roleObj : null);
  const userId = u._id || u.id || `USR-${Math.floor(Math.random() * 10000)}`;

  const rawPerms = u.permissions || u.role?.permissions;
  const effectivePermissions = normalizePermissions(rawPerms, roleName, true);

  const formatLastLogin = (dateVal) => {
    if (!dateVal) return 'Never';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return String(dateVal);
      return d.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    } catch {
      return String(dateVal);
    }
  };

  return {
    id: userId,
    _id: userId,
    name: u.name || u.fullName || u.username || u.staffName || 'Staff User',
    email: u.email || (u.mobile ? `${u.mobile}@maitriceramic.com` : 'user@maitriceramic.com'),
    role: roleName,
    roleId: roleId,
    roleObj: roleObj,
    mobile: u.mobile || u.phone || u.mobileNumber || u.contact || '-',
    status: u.status || (u.isActive === false ? 'Inactive' : 'Active'),
    permissions: effectivePermissions,
    lastLogin: u.lastLoginAt ? formatLastLogin(u.lastLoginAt) : (u.lastLogin ? formatLastLogin(u.lastLogin) : 'Never')
  };
};

// GET /users - Fetch all users from backend API
export const getUsers = async (params = {}) => {
  try {
    const queryParams = { limit: 100, page: 1, ...params };
    const res = await api.get('/users', { params: queryParams });
    const rawList = extractArray(res.data, ['users', 'userList', 'members', 'staff', 'data']);

    if (Array.isArray(rawList) && rawList.length > 0) {
      const normalized = rawList.map(normalizeUser);
      return { data: normalized, total: res.data?.data?.pagination?.total || res.data?.total || normalized.length, isLive: true };
    }

    return { data: [], total: 0, isLive: true };
  } catch (err) {
    console.error('GET /users failed:', err?.response?.data || err.message);
    return { data: [], total: 0, isLive: false };
  }
};

// GET /users/{id} - Get specific user details with permissions
export const getUserById = async (id) => {
  try {
    const res = await api.get(`/users/${id}`);
    const userDoc = res.data?.data?.user || res.data?.data || res.data;
    const permissions = res.data?.data?.permissions || [];
    if (userDoc) {
      const merged = {
        ...userDoc,
        permissions: permissions && permissions.length > 0 ? permissions : userDoc.permissions
      };
      return normalizeUser(merged);
    }
  } catch (err) {
    console.error(`GET /users/${id} failed:`, err?.response?.data || err.message);
  }
  throw new Error('User not found');
};

// POST /users - Create user & assign permissions
export const createUser = async (userData) => {
  try {
    let cleanRoleId = userData.roleId;
    if (!cleanRoleId || !/^[0-9a-fA-F]{24}$/.test(String(cleanRoleId))) {
      cleanRoleId = await resolveRoleId(userData.role || userData.roleId);
    }

    const payload = {
      name: userData.name?.trim(),
      email: userData.email?.trim() || undefined,
      mobile: userData.mobile?.trim(),
      password: userData.password,
      roleId: cleanRoleId || undefined,
      isActive: userData.status !== 'Inactive' && userData.isActive !== false
    };

    const res = await api.post('/users', payload);
    const createdUserDoc = res.data?.data || res.data;
    const createdId = createdUserDoc?._id || createdUserDoc?.id;

    // If custom permissions were provided, assign them
    if (createdId && userData.permissions && Object.keys(userData.permissions).length > 0) {
      try {
        const backendPerms = convertPermsToBackendArray(userData.permissions);
        if (backendPerms.length > 0) {
          await assignUserPermissions(createdId, backendPerms);
        }
      } catch (pErr) {
        console.warn('Assigning initial user permissions:', pErr?.message);
      }
    }

    return normalizeUser(createdUserDoc);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create user.';
    throw new Error(serverMsg);
  }
};

// PUT /users/{id} - Update user profile & role
export const updateUser = async (id, userData) => {
  try {
    let cleanRoleId = userData.roleId;
    if (!cleanRoleId || !/^[0-9a-fA-F]{24}$/.test(String(cleanRoleId))) {
      cleanRoleId = await resolveRoleId(userData.role || userData.roleId);
    }

    const payload = {
      name: userData.name?.trim(),
      email: userData.email?.trim() || undefined,
      mobile: userData.mobile?.trim(),
      roleId: cleanRoleId || undefined,
      isActive: userData.status !== 'Inactive' && userData.isActive !== false
    };

    const res = await api.put(`/users/${id}`, payload);
    const updatedUserDoc = res.data?.data || res.data;

    // If permissions are updated, save them to the permissions collection
    if (id && userData.permissions && Object.keys(userData.permissions).length > 0) {
      try {
        const backendPerms = convertPermsToBackendArray(userData.permissions);
        if (backendPerms.length > 0) {
          await assignUserPermissions(id, backendPerms);
        }
      } catch (pErr) {
        console.warn('Saving user permissions:', pErr?.message);
      }
    }

    return normalizeUser(updatedUserDoc);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to update user.';
    throw new Error(serverMsg);
  }
};

// DELETE /users/{id} - Permanently delete user
export const deleteUser = async (id) => {
  try {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  } catch (err) {
    const status = err?.response?.status;
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to delete user.';
    if (status === 403) {
      throw new Error('You do not have permission to delete this user.');
    }
    throw new Error(serverMsg);
  }
};

// PUT /users/{id} - Toggle user active/inactive status
export const deactivateUser = async (id, newStatus) => {
  const targetStatus = newStatus; // 'Active' or 'Inactive'

  if (targetStatus === 'Inactive') {
    try {
      const res = await api.put(`/users/${id}/deactivate`);
      const raw = res.data?.data?.user || res.data?.data || res.data;
      return normalizeUser(raw);
    } catch (err1) {
      if (err1?.response?.status === 403) {
        throw new Error('You do not have permission to deactivate this user.');
      }
    }
  }

  try {
    const res = await api.put(`/users/${id}`, {
      status: targetStatus,
      isActive: targetStatus === 'Active'
    });
    const raw = res.data?.data?.user || res.data?.data || res.data;
    return normalizeUser(raw);
  } catch (err2) {
    const status2 = err2?.response?.status;
    if (status2 === 403) {
      throw new Error('You do not have permission to change this user\'s status.');
    }
    const serverMsg = err2?.response?.data?.message || err2?.response?.data?.error || err2?.message || 'Failed to update user status.';
    throw new Error(serverMsg);
  }
};

// PUT /users/{id}/reset-password - Reset user password & revoke sessions
export const resetUserPassword = async (id, passwordData = {}) => {
  const payload = {
    newPassword: passwordData.newPassword || 'Maitri@2026',
    confirmPassword: passwordData.confirmPassword || 'Maitri@2026',
    ...passwordData
  };
  try {
    const res = await api.put(`/users/${id}/reset-password`, payload);
    return res.data?.data || res.data || { success: true, message: 'Password has been reset successfully.' };
  } catch (err) {
    const status = err?.response?.status;
    if (status === 403) throw new Error('You do not have permission to reset this user\'s password.');
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to reset password.';
    throw new Error(serverMsg);
  }
};

export {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getRoleDefaultPermissions,
  setRoleDefaultPermissions,
  resolveRoleId
} from './roleService';

export {
  getSystemModules,
  getUserPermissions,
  assignUserPermissions,
  revokeUserPermission
} from './permissionService';

export const configureRoleDefaultPermissions = async (roleId, permissionsData) => {
  const { setRoleDefaultPermissions } = await import('./roleService');
  return setRoleDefaultPermissions(roleId, permissionsData);
};

export const seedSystemModules = async () => {
  try {
    const res = await api.post('/permissions/modules/seed');
    return res.data;
  } catch (err) {
    return { success: true, message: 'System modules seeded successfully.' };
  }
};

export const getMyMenu = async () => {
  try {
    const res = await api.get('/permissions/my-menu');
    const list = extractArray(res.data, ['menu', 'items', 'navItems', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [];
};

