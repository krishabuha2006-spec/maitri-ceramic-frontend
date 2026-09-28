import api, { extractArray } from './api';

export const COMMUNICATION_TYPES = [
  { value: 'CALL', label: 'Phone Call (CALL)' },
  { value: 'WHATSAPP', label: 'WhatsApp (WHATSAPP)' },
  { value: 'EMAIL', label: 'Email (EMAIL)' },
  { value: 'IN_PERSON', label: 'In-Person Visit (IN_PERSON)' },
  { value: 'OTHER', label: 'Other (OTHER)' }
];

export const RESULTING_STATUSES = [
  { value: 'CUSTOMER_INTERESTED', label: 'Customer Interested' },
  { value: 'FOLLOW_UP_PENDING', label: 'Follow-Up Pending' },
  { value: 'FOLLOW_UP_COMPLETED', label: 'Follow-Up Completed' },
  { value: 'NEGOTIATION', label: 'Negotiation' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CLOSED', label: 'Closed' }
];

/**
 * Standardize follow-up object structure from live backend
 */
export const normalizeFollowUp = (f) => {
  if (!f) return null;
  const q = f.quotation || {};
  const u = f.followUpUser || {};
  const c = q.customer || f.customer || {};

  const rawStatus = f.resultingStatus || f.status || 'CUSTOMER_INTERESTED';
  const displayStatus = String(rawStatus).replace(/_/g, ' ');

  const commType = (f.communicationType || 'CALL').toUpperCase();

  return {
    id: f._id || f.id || `FLW-${Date.now()}`,
    _id: f._id || f.id,
    quotationId: q._id || q.id || f.quotationId || (typeof f.quotation === 'string' ? f.quotation : ''),
    quotationNumber: q.quotationNumber || f.quotationNumber || 'QT',
    customerName: c.customerName || c.name || f.customerName || q.customerName || 'Customer',
    quotationAmount: Number(q.grandTotal || q.quotationAmount || f.quotationAmount || 0),
    followUpDate: f.followUpDate ? f.followUpDate.split('T')[0] : new Date().toISOString().split('T')[0],
    nextFollowUpDate: f.nextFollowUpDate ? f.nextFollowUpDate.split('T')[0] : '',
    salesperson: u.name || u.userName || f.salesperson || 'Vikram Mehta',
    communicationType: commType,
    customerResponse: f.customerResponse || '',
    remarks: f.remarks || '',
    expectedOrderValue: Number(f.expectedOrderValue || 0),
    nextAction: f.nextAction || '',
    resultingStatus: rawStatus,
    status: displayStatus,
    isActive: f.isActive !== false,
    createdAt: f.createdAt ? f.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
  };
};

/**
 * 1. POST /follow-ups - Log a new follow-up and drive quotation status
 */
export const createFollowUp = async (followUpData) => {
  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);

  // Map communicationType to enum ['CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER']
  let commType = (followUpData.communicationType || 'CALL').toUpperCase();
  if (commType.includes('PHONE') || commType.includes('CALL')) commType = 'CALL';
  else if (commType.includes('WHATSAPP')) commType = 'WHATSAPP';
  else if (commType.includes('EMAIL')) commType = 'EMAIL';
  else if (commType.includes('VISIT') || commType.includes('PERSON')) commType = 'IN_PERSON';
  else if (!['CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER'].includes(commType)) commType = 'OTHER';

  // Map resultingStatus to enum ['FOLLOW_UP_PENDING', 'FOLLOW_UP_COMPLETED', 'CUSTOMER_INTERESTED', 'NEGOTIATION', 'REJECTED', 'EXPIRED', 'CLOSED']
  let resStatus = (followUpData.resultingStatus || followUpData.status || 'CUSTOMER_INTERESTED').toUpperCase().replace(/\s+/g, '_');
  if (!['FOLLOW_UP_PENDING', 'FOLLOW_UP_COMPLETED', 'CUSTOMER_INTERESTED', 'NEGOTIATION', 'REJECTED', 'EXPIRED', 'CLOSED'].includes(resStatus)) {
    if (resStatus.includes('INTEREST')) resStatus = 'CUSTOMER_INTERESTED';
    else if (resStatus.includes('NEGOTIAT')) resStatus = 'NEGOTIATION';
    else if (resStatus.includes('REJECT')) resStatus = 'REJECTED';
    else if (resStatus.includes('EXPIRE')) resStatus = 'EXPIRED';
    else if (resStatus.includes('CLOSE')) resStatus = 'CLOSED';
    else if (resStatus.includes('COMPLETE')) resStatus = 'FOLLOW_UP_COMPLETED';
    else resStatus = 'FOLLOW_UP_PENDING';
  }

  const payload = {
    quotationId: followUpData.quotationId,
    communicationType: commType,
    resultingStatus: resStatus,
    followUpDate: followUpData.followUpDate ? new Date(followUpData.followUpDate).toISOString() : new Date().toISOString(),
    customerResponse: followUpData.customerResponse || '',
    remarks: followUpData.remarks || '',
    expectedOrderValue: Number(followUpData.expectedOrderValue || 0),
    nextAction: followUpData.nextAction || ''
  };

  if (followUpData.nextFollowUpDate) {
    payload.nextFollowUpDate = new Date(followUpData.nextFollowUpDate).toISOString();
  }
  if (isMongoId(followUpData.followUpUser)) {
    payload.followUpUser = followUpData.followUpUser;
  }

  try {
    const res = await api.post('/follow-ups', payload);
    const created = normalizeFollowUp(res.data?.data?.followUp || res.data?.data || res.data);
    return created;
  } catch (err) {
    const serverErr = err?.response?.data?.message || err?.message || 'Failed to create follow-up on backend.';
    throw new Error(serverErr);
  }
};

/**
 * 2. GET /follow-ups - List all follow-up entries with filtering & pagination
 */
export const getFollowUps = async (params = {}) => {
  try {
    const queryParams = { limit: 100, page: 1, ...params };
    const res = await api.get('/follow-ups', { params: queryParams });
    const rawList = extractArray(res.data, ['followUps', 'records', 'data']);
    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizeFollowUp);
      return { 
        data: normalized, 
        total: res.data?.data?.pagination?.total || res.data?.total || normalized.length, 
        pagination: res.data?.data?.pagination,
        isLive: true 
      };
    }
  } catch (err) {
    console.error('GET /follow-ups error:', err?.response?.data || err.message);
  }

  return { data: [], total: 0, isLive: false };
};

/**
 * 3. GET /follow-ups/alerts - Follow-Up Alert Engine (5 Categories)
 */
export const getFollowUpAlerts = async (salespersonId = null) => {
  try {
    const params = {};
    if (salespersonId) params.salespersonId = salespersonId;
    const res = await api.get('/follow-ups/alerts', { params });
    const alerts = res.data?.data?.alerts || res.data?.data || res.data;
    if (alerts && typeof alerts === 'object') return alerts;
  } catch (err) {
    console.warn('GET /follow-ups/alerts error:', err?.response?.data || err.message);
  }

  return {
    dueToday: [],
    overdue: [],
    upcoming: [],
    noFollowUpSet: [],
    closedRecently: []
  };
};

/**
 * 4. GET /follow-ups/export - Export filtered follow-up records to Excel (.xlsx)
 */
export const exportFollowUps = async (params = {}) => {
  try {
    const res = await api.get('/follow-ups/export', { params, responseType: 'blob' });
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `FollowUps_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true };
  } catch (err) {
    console.error('GET /follow-ups/export error:', err?.response?.data || err.message);
    throw err;
  }
};

/**
 * 5. GET /follow-ups/quotation/{quotationId}/timeline - Get chronological follow-up timeline for one Quotation
 */
export const getQuotationFollowUpTimeline = async (quotationId) => {
  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);

  if (quotationId && isMongoId(quotationId)) {
    try {
      const res = await api.get(`/follow-ups/quotation/${quotationId}/timeline`);
      const list = extractArray(res.data, ['timeline', 'followUps', 'data']);
      if (Array.isArray(list) && list.length > 0) {
        return list.map(normalizeFollowUp);
      }
    } catch (err) {
      console.warn('GET timeline error:', err.message);
    }
  }

  return [];
};

/**
 * 6. GET /follow-ups/{id} - Get single follow-up details by ID
 */
export const getFollowUpById = async (id) => {
  try {
    const res = await api.get(`/follow-ups/${id}`);
    const raw = res.data?.data?.followUp || res.data?.data || res.data;
    if (raw) return normalizeFollowUp(raw);
  } catch (err) {
    console.error('GET /follow-ups/:id error:', err?.response?.data || err.message);
  }
  throw new Error('Follow-up record not found');
};

/**
 * 7. PUT /follow-ups/{id} - Update follow-up record (Recency-aware status re-application)
 */
export const updateFollowUp = async (id, updateData) => {
  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);

  let commType = updateData.communicationType ? updateData.communicationType.toUpperCase() : undefined;
  if (commType) {
    if (commType.includes('PHONE') || commType.includes('CALL')) commType = 'CALL';
    else if (commType.includes('WHATSAPP')) commType = 'WHATSAPP';
    else if (commType.includes('EMAIL')) commType = 'EMAIL';
    else if (commType.includes('VISIT') || commType.includes('PERSON')) commType = 'IN_PERSON';
    else if (!['CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER'].includes(commType)) commType = 'OTHER';
  }

  let resStatus = updateData.resultingStatus || updateData.status;
  if (resStatus) {
    resStatus = resStatus.toUpperCase().replace(/\s+/g, '_');
    if (!['FOLLOW_UP_PENDING', 'FOLLOW_UP_COMPLETED', 'CUSTOMER_INTERESTED', 'NEGOTIATION', 'REJECTED', 'EXPIRED', 'CLOSED'].includes(resStatus)) {
      if (resStatus.includes('INTEREST')) resStatus = 'CUSTOMER_INTERESTED';
      else if (resStatus.includes('NEGOTIAT')) resStatus = 'NEGOTIATION';
      else if (resStatus.includes('REJECT')) resStatus = 'REJECTED';
      else if (resStatus.includes('EXPIRE')) resStatus = 'EXPIRED';
      else if (resStatus.includes('CLOSE')) resStatus = 'CLOSED';
      else if (resStatus.includes('COMPLETE')) resStatus = 'FOLLOW_UP_COMPLETED';
      else resStatus = 'FOLLOW_UP_PENDING';
    }
  }

  const payload = {};
  if (updateData.followUpDate) payload.followUpDate = new Date(updateData.followUpDate).toISOString();
  if (updateData.nextFollowUpDate) payload.nextFollowUpDate = new Date(updateData.nextFollowUpDate).toISOString();
  if (commType) payload.communicationType = commType;
  if (resStatus) payload.resultingStatus = resStatus;
  if (updateData.customerResponse !== undefined) payload.customerResponse = updateData.customerResponse;
  if (updateData.remarks !== undefined) payload.remarks = updateData.remarks;
  if (updateData.expectedOrderValue !== undefined) payload.expectedOrderValue = Number(updateData.expectedOrderValue);
  if (updateData.nextAction !== undefined) payload.nextAction = updateData.nextAction;
  if (isMongoId(updateData.followUpUser)) payload.followUpUser = updateData.followUpUser;

  try {
    const res = await api.put(`/follow-ups/${id}`, payload);
    const updated = normalizeFollowUp(res.data?.data?.followUp || res.data?.data || res.data);
    return updated;
  } catch (err) {
    const serverErr = err?.response?.data?.message || err?.message || 'Failed to update follow-up on backend.';
    throw new Error(serverErr);
  }
};

/**
 * 8. DELETE /follow-ups/{id} - Deactivate / Soft-delete a follow-up record
 */
export const deleteFollowUp = async (id) => {
  try {
    const res = await api.delete(`/follow-ups/${id}`);
    return res.data;
  } catch (err) {
    const serverErr = err?.response?.data?.message || err?.message || 'Failed to delete follow-up.';
    throw new Error(serverErr);
  }
};

/**
 * 9. PUT /follow-ups/{id}/deactivate - Soft-delete a follow-up record
 */
export const deactivateFollowUp = async (id) => {
  try {
    const res = await api.put(`/follow-ups/${id}/deactivate`);
    return res.data;
  } catch (err) {
    const serverErr = err?.response?.data?.message || err?.message || 'Failed to deactivate follow-up.';
    throw new Error(serverErr);
  }
};
