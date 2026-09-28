import api, { extractArray } from './api';

export const getRoles = async () => {
  try {
    const res = await api.get('/roles');
    const list = extractArray(res.data, ['roles', 'data']);
    return list;
  } catch (err) {
    console.error('GET /roles failed:', err?.response?.data || err.message);
    return [];
  }
};

export const createRole = async (roleData) => {
  try {
    const res = await api.post('/roles', {
      roleName: roleData.roleName?.trim(),
      description: roleData.description?.trim(),
      isActive: roleData.isActive !== false
    });
    return res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to create role.';
    throw new Error(msg);
  }
};

export const updateRole = async (id, roleData) => {
  try {
    const res = await api.put(`/roles/${id}`, {
      roleName: roleData.roleName?.trim(),
      description: roleData.description?.trim(),
      isActive: roleData.isActive
    });
    return res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to update role.';
    throw new Error(msg);
  }
};

export const deleteRole = async (id) => {
  try {
    const res = await api.delete(`/roles/${id}`);
    return res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to delete role.';
    throw new Error(msg);
  }
};

export const getRoleDefaultPermissions = async (roleId) => {
  try {
    const res = await api.get(`/roles/${roleId}/default-permissions`);
    const perms = extractArray(res.data, ['defaultPermissions', 'permissions', 'data']);
    return perms;
  } catch (err) {
    console.error(`GET /roles/${roleId}/default-permissions failed:`, err?.response?.data || err.message);
    return [];
  }
};

export const setRoleDefaultPermissions = async (roleId, permissions) => {
  try {
    const res = await api.post(`/roles/${roleId}/default-permissions`, { permissions });
    return res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to save role default permissions.';
    throw new Error(msg);
  }
};
