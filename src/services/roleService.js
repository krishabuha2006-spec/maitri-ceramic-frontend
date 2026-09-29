import api, { extractArray } from './api';
import { ROLES, normalizeRole } from '../utils/permissions';

const STANDARD_ROLES = [
  { roleName: 'Super Admin', description: 'System-level Super Administrator with full platform access' },
  { roleName: 'Sales Manager', description: 'Full access to sales pipeline, quotations, customers, and reports' },
  { roleName: 'Sales Executive', description: 'Access to customer management, creating quotations, and tracking follow-ups' },
  { roleName: 'Inventory User', description: 'Access to products catalog, stock management, challans, and returns' },
  { roleName: 'Accounts User', description: 'Access to billing invoices, payments receipts, and customer ledgers' },
  { roleName: 'Custom Permissions', description: 'Individually assigned granular user permissions' }
];

export const getRoles = async () => {
  try {
    const res = await api.get('/roles');
    let list = extractArray(res.data, ['roles', 'data']);

    // If backend returned valid list
    if (Array.isArray(list) && list.length > 0) {
      // Check if standard non-system roles need to be populated in backend
      const existingNames = new Set(list.map(r => (r.roleName || '').trim().toLowerCase()));
      
      for (const std of STANDARD_ROLES) {
        if (std.roleName !== 'Super Admin' && !existingNames.has(std.roleName.toLowerCase())) {
          try {
            const created = await api.post('/roles', {
              roleName: std.roleName,
              description: std.description,
              isActive: true
            });
            const newRoleDoc = created.data?.data?.role || created.data?.data || created.data;
            if (newRoleDoc && (newRoleDoc._id || newRoleDoc.id)) {
              list.push(newRoleDoc);
              existingNames.add(std.roleName.toLowerCase());
            }
          } catch (e) {
            // Role may already exist or race condition, ignore
          }
        }
      }
      return list;
    }

    return [];
  } catch (err) {
    console.error('GET /roles failed:', err?.response?.data || err.message);
    return [];
  }
};

export const resolveRoleId = async (roleNameOrId, existingRoles = []) => {
  if (!roleNameOrId) return null;
  const str = String(roleNameOrId).trim();
  // If already a 24-character hex MongoDB ObjectId
  if (/^[0-9a-fA-F]{24}$/.test(str)) {
    return str;
  }

  // Find in existing roles list
  let roles = existingRoles;
  if (!roles || roles.length === 0) {
    roles = await getRoles();
  }

  const normTarget = normalizeRole(str).toLowerCase();
  const matched = roles.find(r => {
    const rId = String(r._id || r.id || '');
    if (rId === str) return true;
    const rName = (r.roleName || r.name || '').trim().toLowerCase();
    return rName === str.toLowerCase() || normalizeRole(rName).toLowerCase() === normTarget;
  });

  if (matched && (matched._id || matched.id)) {
    return matched._id || matched.id;
  }

  // If not found, try creating role in backend
  try {
    const created = await createRole({ roleName: str, description: `Custom role: ${str}` });
    return created?._id || created?.id || null;
  } catch (e) {
    return null;
  }
};

export const createRole = async (roleData) => {
  const roleName = (roleData.roleName || roleData.name || '').trim();
  const payload = {
    roleName,
    name: roleName,
    description: (roleData.description || '').trim(),
    isActive: roleData.isActive !== false
  };
  try {
    const res = await api.post('/roles', payload);
    return res.data?.data?.role || res.data?.data || res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to create role.';
    throw new Error(msg);
  }
};

export const updateRole = async (id, roleData) => {
  const cleanId = typeof id === 'object' ? (id._id || id.id) : id;
  const roleName = (roleData.roleName || roleData.name || '').trim();
  const payload = {
    roleName,
    name: roleName,
    description: (roleData.description || '').trim(),
    isActive: roleData.isActive !== false
  };
  try {
    const res = await api.put(`/roles/${cleanId}`, payload);
    return res.data?.data?.role || res.data?.data || res.data;
  } catch (err) {
    try {
      const res2 = await api.patch(`/roles/${cleanId}`, payload);
      return res2.data?.data?.role || res2.data?.data || res2.data;
    } catch (err2) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to update role.';
      throw new Error(msg);
    }
  }
};

export const deleteRole = async (id) => {
  const cleanId = typeof id === 'object' ? (id._id || id.id) : id;
  try {
    const res = await api.delete(`/roles/${cleanId}`);
    return res.data;
  } catch (err) {
    const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to delete role.';
    throw new Error(msg);
  }
};

export const getRoleDefaultPermissions = async (roleId) => {
  const cleanId = typeof roleId === 'object' ? (roleId._id || roleId.id) : roleId;
  try {
    const res = await api.get(`/roles/${cleanId}/default-permissions`);
    const perms = extractArray(res.data, ['defaultPermissions', 'permissions', 'data']);
    return perms;
  } catch (err) {
    console.error(`GET /roles/${cleanId}/default-permissions failed:`, err?.response?.data || err.message);
    return [];
  }
};

export const setRoleDefaultPermissions = async (roleId, permissions) => {
  const cleanId = typeof roleId === 'object' ? (roleId._id || roleId.id) : roleId;
  const permissionsArray = Array.isArray(permissions)
    ? permissions
    : Object.entries(permissions).map(([moduleKey, actions]) => ({ moduleKey, actions }));

  const payload = {
    permissions: permissionsArray,
    defaultPermissions: permissionsArray,
    roleId: cleanId
  };

  try {
    const res = await api.post(`/roles/${cleanId}/default-permissions`, payload);
    return res.data?.data || res.data;
  } catch (err) {
    try {
      const res2 = await api.put(`/roles/${cleanId}/default-permissions`, payload);
      return res2.data?.data || res2.data;
    } catch (err2) {
      try {
        const res3 = await api.post('/permissions/role-default', payload);
        return res3.data?.data || res3.data;
      } catch (err3) {
        const msg = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to save role default permissions.';
        throw new Error(msg);
      }
    }
  }
};

