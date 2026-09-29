import api, { extractArray } from './api';

export const getSystemModules = async () => {
  try {
    const res = await api.get('/permissions/modules');
    const modules = extractArray(res.data, ['modules', 'data']);
    return modules;
  } catch (err) {
    console.error('GET /permissions/modules failed:', err?.response?.data || err.message);
    return [];
  }
};

export const getUserPermissions = async (userId) => {
  const cleanId = typeof userId === 'object' ? (userId._id || userId.id) : userId;
  try {
    const res = await api.get(`/permissions/user/${cleanId}`);
    const perms = extractArray(res.data, ['permissions', 'userPermissions', 'data']);
    return perms;
  } catch (err) {
    console.error(`GET /permissions/user/${cleanId} failed:`, err?.response?.data || err.message);
    return [];
  }
};

export const assignUserPermissions = async (userId, permissions) => {
  const cleanId = typeof userId === 'object' ? (userId._id || userId.id) : userId;
  const permissionsArray = Array.isArray(permissions)
    ? permissions
    : Object.entries(permissions).map(([moduleKey, actions]) => ({ moduleKey, actions }));

  const payload = { userId: cleanId, permissions: permissionsArray };
  try {
    const res = await api.post('/permissions/assign', payload);
    return res.data?.data || res.data;
  } catch (err) {
    try {
      const res2 = await api.put(`/users/${cleanId}/permissions`, { permissions: permissionsArray });
      return res2.data?.data || res2.data;
    } catch (err2) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to assign user permissions.';
      throw new Error(msg);
    }
  }
};

export const revokeUserPermission = async (userPermissionId) => {
  const cleanId = typeof userPermissionId === 'object' ? (userPermissionId._id || userPermissionId.id) : userPermissionId;
  try {
    const res = await api.put('/permissions/revoke', { userPermissionId: cleanId });
    return res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to revoke user permission.';
    throw new Error(msg);
  }
};
