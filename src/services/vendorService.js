import api, { extractArray } from './api';

export const normalizeVendor = (v) => {
  if (!v) return null;
  return {
    _id: v._id || v.id,
    id: v._id || v.id,
    vendorName: v.vendorName || v.name || 'Unnamed Vendor',
    mobile: v.mobile || '',
    email: v.email || '',
    address: v.address || '',
    gstNumber: v.gstNumber || '',
    status: v.status || (v.isActive === false ? 'Inactive' : 'Active'),
    isActive: v.isActive !== false && v.status !== 'Inactive',
    createdAt: v.createdAt,
    updatedAt: v.updatedAt
  };
};

/**
 * GET /vendors - Retrieve all vendors with optional search and isActive filter
 */
export const getVendors = async (params = {}) => {
  try {
    const res = await api.get('/vendors', { params });
    const rawList = extractArray(res.data, ['vendors', 'suppliers', 'data']);
    const list = Array.isArray(rawList) ? rawList.map(normalizeVendor).filter(Boolean) : [];
    return list;
  } catch (err) {
    console.error('GET /vendors error:', err?.message);
    return [];
  }
};

/**
 * GET /vendors/:id - Retrieve single vendor details
 */
export const getVendorById = async (id) => {
  try {
    const res = await api.get(`/vendors/${id}`);
    const raw = res.data?.data?.vendor || res.data?.data || res.data;
    return normalizeVendor(raw);
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Vendor not found.');
  }
};

/**
 * POST /vendors - Create new vendor record
 */
export const createVendor = async (data) => {
  const payload = {
    vendorName: data.vendorName ? data.vendorName.trim() : (data.name ? data.name.trim() : ''),
    mobile: data.mobile ? data.mobile.trim() : null,
    email: data.email ? data.email.trim().toLowerCase() : null,
    address: data.address ? data.address.trim() : null,
    gstNumber: data.gstNumber ? data.gstNumber.trim().toUpperCase() : null,
    isActive: data.isActive !== undefined ? data.isActive : (data.status ? data.status === 'Active' : true)
  };

  try {
    const res = await api.post('/vendors', payload);
    const created = res.data?.data || res.data;
    return normalizeVendor(created);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create vendor.';
    throw new Error(serverMsg);
  }
};

/**
 * PUT /vendors/:id - Update existing vendor
 */
export const updateVendor = async (id, data) => {
  const payload = {
    vendorName: data.vendorName ? data.vendorName.trim() : (data.name ? data.name.trim() : ''),
    mobile: data.mobile !== undefined ? (data.mobile ? data.mobile.trim() : null) : undefined,
    email: data.email !== undefined ? (data.email ? data.email.trim().toLowerCase() : null) : undefined,
    address: data.address !== undefined ? (data.address ? data.address.trim() : null) : undefined,
    gstNumber: data.gstNumber !== undefined ? (data.gstNumber ? data.gstNumber.trim().toUpperCase() : null) : undefined,
    isActive: data.isActive !== undefined ? data.isActive : (data.status ? data.status === 'Active' : undefined)
  };

  try {
    const res = await api.put(`/vendors/${id}`, payload);
    const updated = res.data?.data || res.data;
    return normalizeVendor(updated);
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to update vendor.';
    throw new Error(serverMsg);
  }
};

/**
 * Toggle Vendor Status: soft deactivation / reactivation
 */
export const toggleVendorStatus = async (id, currentIsActive) => {
  try {
    if (currentIsActive) {
      const res = await api.put(`/vendors/${id}/deactivate`);
      return res.data;
    } else {
      const res = await api.put(`/vendors/${id}`, { isActive: true });
      return res.data;
    }
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to toggle vendor status.';
    throw new Error(serverMsg);
  }
};

/**
 * Soft delete vendor
 */
export const deactivateVendor = async (id) => {
  try {
    const res = await api.put(`/vendors/${id}/deactivate`);
    return res.data;
  } catch (err) {
    throw new Error(err?.response?.data?.message || 'Failed to deactivate vendor.');
  }
};
