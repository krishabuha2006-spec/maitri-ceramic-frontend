import api, { extractArray } from './api';

/**
 * 1. GET /api/audit-log - List paginated activity / audit logs with search and filter
 */
export const getAuditLogs = async (params = {}) => {
  try {
    const res = await api.get('/audit-log', { params });
    const rawData = res.data?.data || res.data;
    const rawList = Array.isArray(rawData) ? rawData : (rawData?.logs || rawData?.records || rawData?.items || extractArray(res.data, ['logs', 'data']));
    
    return {
      data: Array.isArray(rawList) ? rawList : [],
      pagination: rawData?.pagination || { total: Array.isArray(rawList) ? rawList.length : 0, page: 1, limit: 50 },
      isLive: true
    };
  } catch (err) {
    console.warn('GET /audit-log error:', err.message);
    return { data: [], pagination: { total: 0, page: 1, limit: 50 }, isLive: false };
  }
};

/**
 * 2. GET /api/audit-log/:id - Single audit log entry detail
 */
export const getAuditLogById = async (id) => {
  const res = await api.get(`/audit-log/${id}`);
  return res.data?.data || res.data;
};

/**
 * 3. GET /api/audit-log/entity/:entityType/:entityId - Chronological activity timeline for entity
 */
export const getEntityAuditLogs = async (entityType, entityId, params = {}) => {
  const res = await api.get(`/audit-log/entity/${entityType}/${entityId}`, { params });
  return res.data?.data || res.data;
};

/**
 * 4. GET /api/audit-log/user/:userId - Chronological activity timeline for user
 */
export const getUserAuditLogs = async (userId, params = {}) => {
  const res = await api.get(`/audit-log/user/${userId}`, { params });
  return res.data?.data || res.data;
};

/**
 * 5. GET /api/audit-log/export - Export activity logs to Excel
 */
export const exportAuditLogExcel = async (params = {}) => {
  const res = await api.get('/audit-log/export', { params, responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `Audit_Log_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
  return { success: true };
};

export default {
  getAuditLogs,
  getAuditLogById,
  getEntityAuditLogs,
  getUserAuditLogs,
  exportAuditLogExcel
};
