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
  try {
    const res = await api.get(`/permissions/user/${userId}`);
    const perms = extractArray(res.data, ['permissions', 'userPermissions', 'data']);
    return perms;
  } catch (err) {
    console.error(`GET /permissions/user/${userId} failed:`, err?.response?.data || err.message);
    return [];
  }
};

export const assignUserPermissions = async (userId, permissions) => {
  try {
    const res = await api.post('/permissions/assign', { userId, permissions });
    return res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to assign user permissions.';
    throw new Error(msg);
  }
};

export const revokeUserPermission = async (userPermissionId) => {
  try {
    const res = await api.put('/permissions/revoke', { userPermissionId });
    return res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to revoke user permission.';
    throw new Error(msg);
  }
};
