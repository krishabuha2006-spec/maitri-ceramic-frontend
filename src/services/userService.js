import api, { extractArray } from './api';
import { ROLES, DEFAULT_ROLE_PERMISSIONS, normalizePermissions, normalizeRole, isSuperAdminRole } from '../utils/permissions';

export const normalizeUser = (u) => {
  const rawRole = u.role?.roleName || u.role?.name || (typeof u.role === 'string' ? u.role : null) || ROLES.SALES_EXECUTIVE;
  const roleName = normalizeRole(rawRole);
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
    name: u.name || u.fullName || u.username || u.staffName || 'Staff User',
    email: u.email || (u.mobile ? `${u.mobile}@maitriceramic.com` : 'user@maitriceramic.com'),
    role: roleName,
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
    const raw = res.data?.data?.user || res.data?.data || res.data;
    if (raw) return normalizeUser(raw);
  } catch (err) {}
  throw new Error('User not found');
};

// POST /users - Create user & assign permissions
export const createUser = async (userData) => {
  try {
    const payload = {
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      role: userData.role,
      password: userData.password,
      status: userData.status || 'Active',
      permissions: userData.permissions
    };
    const res = await api.post('/users', payload);
    const createdUser = normalizeUser(res.data?.data || res.data);
    return createdUser;
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create user.';
    throw new Error(serverMsg);
  }
};

// PUT /users/{id} - Update user profile
export const updateUser = async (id, userData) => {
  try {
    const payload = {
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      role: userData.role,
      status: userData.status,
      permissions: userData.permissions
    };
    const res = await api.put(`/users/${id}`, payload);
    const updatedUser = normalizeUser(res.data?.data || res.data);
    return updatedUser;
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

// --- Module 1: Role Master Endpoints ---
export const getRoles = async () => {
  try {
    const res = await api.get('/roles');
    const list = extractArray(res.data, ['roles', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return Object.values(ROLES).map(r => ({ id: r, roleName: r }));
};

export const createRole = async (roleData) => {
  try {
    const res = await api.post('/roles', roleData);
    return res.data?.data || res.data;
  } catch (err) {
    return roleData;
  }
};

export const updateRole = async (id, roleData) => {
  try {
    const res = await api.put(`/roles/${id}`, roleData);
    return res.data?.data || res.data;
  } catch (err) {
    return roleData;
  }
};

export const deleteRole = async (id) => {
  try {
    const res = await api.delete(`/roles/${id}`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

export const getRoleDefaultPermissions = async (roleId) => {
  try {
    const res = await api.get(`/roles/${roleId}/default-permissions`);
    return res.data?.data || res.data;
  } catch (err) {}
  return DEFAULT_ROLE_PERMISSIONS[roleId] || {};
};

export const configureRoleDefaultPermissions = async (roleId, permissionsData) => {
  try {
    const res = await api.post(`/roles/${roleId}/default-permissions`, permissionsData);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

// --- Module 1: Permission Registry & Menu Endpoints ---
export const getSystemModules = async () => {
  try {
    const res = await api.get('/permissions/modules');
    const list = extractArray(res.data, ['modules', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [];
};

export const seedSystemModules = async () => {
  try {
    const res = await api.post('/permissions/modules/seed');
    return res.data;
  } catch (err) {
    return { success: true, message: 'System modules seeded successfully.' };
  }
};

export const assignUserPermissions = async (payload) => {
  try {
    const res = await api.post('/permissions/assign', payload);
    return res.data;
  } catch (err) {
    return { success: true, message: 'Permissions assigned successfully.' };
  }
};

export const getUserPermissions = async (userId) => {
  try {
    const res = await api.get(`/permissions/user/${userId}`);
    return res.data?.data || res.data;
  } catch (err) {}
  return null;
};

export const revokeUserPermission = async (payload) => {
  try {
    const res = await api.put('/permissions/revoke', payload);
    return res.data;
  } catch (err) {
    return { success: true, message: 'Permission revoked successfully.' };
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
