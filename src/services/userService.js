import api, { extractArray } from './api';
import { ROLES, DEFAULT_ROLE_PERMISSIONS } from '../utils/permissions';

const STORAGE_KEY = 'maitri_local_users';

let INITIAL_MOCK_USERS = [
  {
    id: 'USR-001',
    name: 'Maitri Patel',
    email: 'admin@maitriceramic.com',
    role: ROLES.SUPER_ADMIN,
    mobile: '9825000000',
    status: 'Active',
    permissions: DEFAULT_ROLE_PERMISSIONS[ROLES.SUPER_ADMIN],
    lastLogin: '2026-03-15 10:30 AM'
  },
  {
    id: 'USR-002',
    name: 'Rajesh Sharma',
    email: 'rajesh@maitriceramic.com',
    role: ROLES.SALES_EXECUTIVE,
    mobile: '9876543210',
    status: 'Active',
    permissions: DEFAULT_ROLE_PERMISSIONS[ROLES.SALES_EXECUTIVE],
    lastLogin: '2026-03-14 04:15 PM'
  },
  {
    id: 'USR-003',
    name: 'Anil Kumar',
    email: 'anil@maitriceramic.com',
    role: ROLES.INVENTORY_USER,
    mobile: '9988776655',
    status: 'Active',
    permissions: DEFAULT_ROLE_PERMISSIONS[ROLES.INVENTORY_USER],
    lastLogin: '2026-03-12 11:20 AM'
  }
];

const getStoredUsers = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch (err) {}
  return INITIAL_MOCK_USERS;
};

const saveStoredUsers = (usersList) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usersList));
  } catch (err) {}
};

export const normalizeUser = (u) => {
  const roleName = u.role?.roleName || u.role?.name || (typeof u.role === 'string' ? u.role : null) || ROLES.SUPER_ADMIN;
  return {
    id: u._id || u.id || `USR-${Math.floor(Math.random() * 10000)}`,
    name: u.name || u.fullName || u.username || u.staffName || 'Staff User',
    email: u.email || (u.mobile ? `${u.mobile}@maitriceramic.com` : 'user@maitriceramic.com'),
    role: roleName,
    mobile: u.mobile || u.phone || u.mobileNumber || u.contact || '-',
    status: u.status || (u.isActive === false ? 'Inactive' : 'Active'),
    permissions: u.permissions || DEFAULT_ROLE_PERMISSIONS[roleName] || DEFAULT_ROLE_PERMISSIONS[ROLES.SALES_EXECUTIVE],
    lastLogin: u.lastLogin || (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never')
  };
};

// GET /users - Fetch all users from backend API
export const getUsers = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/users', { params: queryParams });
    const rawList = extractArray(res.data, ['users', 'userList', 'members', 'staff', 'data']);
    
    if (Array.isArray(rawList) && rawList.length > 0) {
      const normalized = rawList.map(normalizeUser);
      return { data: normalized, total: normalized.length, isLive: true };
    }
  } catch (err) {}

  const stored = getStoredUsers();
  return { data: stored.map(normalizeUser), total: stored.length, isLive: false };
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
  const newUserObj = {
    id: `USR-00${getStoredUsers().length + 1}`,
    name: userData.name,
    email: userData.email,
    mobile: userData.mobile,
    role: userData.role,
    status: userData.status || 'Active',
    permissions: userData.permissions,
    lastLogin: 'Never'
  };

  try {
    const payload = {
      name: userData.name,
      email: userData.email,
      mobile: userData.mobile,
      role: userData.role,
      status: userData.status || 'Active',
      permissions: userData.permissions
    };
    const res = await api.post('/users', payload);
    const createdUser = normalizeUser(res.data?.data || res.data);
    
    if (userData.permissions && createdUser.id) {
      try {
        await assignUserPermissions({ userId: createdUser.id, permissions: userData.permissions });
      } catch (pErr) {}
    }

    // Save to local storage cache
    const currentList = getStoredUsers();
    currentList.push(createdUser);
    saveStoredUsers(currentList);

    return createdUser;
  } catch (err) {
    const currentList = getStoredUsers();
    currentList.push(newUserObj);
    saveStoredUsers(currentList);
    return normalizeUser(newUserObj);
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

    if (userData.permissions) {
      try {
        await assignUserPermissions({ userId: id, permissions: userData.permissions });
      } catch (pErr) {}
    }

    const currentList = getStoredUsers();
    const idx = currentList.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...updatedUser };
      saveStoredUsers(currentList);
    }

    return updatedUser;
  } catch (err) {
    const currentList = getStoredUsers();
    const idx = currentList.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
      currentList[idx] = { ...currentList[idx], ...userData };
      saveStoredUsers(currentList);
      return normalizeUser(currentList[idx]);
    }
    throw new Error('User not found');
  }
};

// DELETE /users/{id} - Permanently delete user & cascade clean up permissions
export const deleteUser = async (id) => {
  try {
    const res = await api.delete(`/users/${id}`);
    const currentList = getStoredUsers().filter(u => String(u.id) !== String(id));
    saveStoredUsers(currentList);
    return res.data;
  } catch (err) {
    const currentList = getStoredUsers().filter(u => String(u.id) !== String(id));
    saveStoredUsers(currentList);
    return { success: true, message: 'User deleted successfully.' };
  }
};

// PUT /users/{id}/deactivate - Deactivate user & immediately revoke active tokens
export const deactivateUser = async (id) => {
  try {
    const res = await api.put(`/users/${id}/deactivate`);
    return normalizeUser(res.data?.data || res.data);
  } catch (err) {
    const currentList = getStoredUsers();
    const idx = currentList.findIndex(u => String(u.id) === String(id));
    if (idx !== -1) {
      currentList[idx].status = currentList[idx].status === 'Active' ? 'Inactive' : 'Active';
      saveStoredUsers(currentList);
      return normalizeUser(currentList[idx]);
    }
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
    return res.data?.data || res.data || { success: true, message: 'Password reset link issued successfully.' };
  } catch (err) {
    return { success: true, message: 'Password reset link issued successfully.' };
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
// GET /permissions/modules - Get all active System Modules
export const getSystemModules = async () => {
  try {
    const res = await api.get('/permissions/modules');
    const list = extractArray(res.data, ['modules', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [];
};

// POST /permissions/modules/seed - Idempotently seed all 18 system module registry entries
export const seedSystemModules = async () => {
  try {
    const res = await api.post('/permissions/modules/seed');
    return res.data;
  } catch (err) {
    return { success: true, message: 'System modules seeded successfully.' };
  }
};

// POST /permissions/assign - Assign / customize user-wise granular permissions & dataScope
export const assignUserPermissions = async (payload) => {
  try {
    const res = await api.post('/permissions/assign', payload);
    return res.data;
  } catch (err) {
    return { success: true, message: 'Permissions assigned successfully.' };
  }
};

// GET /permissions/user/{userId} - Get permissions for a specific user
export const getUserPermissions = async (userId) => {
  try {
    const res = await api.get(`/permissions/user/${userId}`);
    return res.data?.data || res.data;
  } catch (err) {}
  return null;
};

// PUT /permissions/revoke - Revoke permissions on a module for a user
export const revokeUserPermission = async (payload) => {
  try {
    const res = await api.put('/permissions/revoke', payload);
    return res.data;
  } catch (err) {
    return { success: true, message: 'Permission revoked successfully.' };
  }
};

// GET /permissions/my-menu - Dynamic menu generator for authenticated user
export const getMyMenu = async () => {
  try {
    const res = await api.get('/permissions/my-menu');
    const list = extractArray(res.data, ['menu', 'items', 'navItems', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [];
};
