import api, { extractArray } from './api';

const STORAGE_KEY = 'maitri_local_followups';

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

let INITIAL_MOCK_FOLLOWUPS = [
  {
    id: 'FLW-001',
    _id: '6aa8e52a92ab3c10a4023901',
    quotationId: '6aa8e9ba9f4e2dfd4bc01550',
    quotationNumber: 'QT-2026-001',
    customerName: 'Rajesh Sharma Construction',
    quotationAmount: 144432.00,
    followUpDate: '2026-03-05',
    nextFollowUpDate: '2026-03-18',
    salesperson: 'Vikram Mehta',
    communicationType: 'CALL',
    resultingStatus: 'CUSTOMER_INTERESTED',
    status: 'Customer Interested',
    customerResponse: 'Customer reviewed Statuario tile sample. Requested final 2% discount approval.',
    remarks: 'Needs glossy finish sample delivery at site.',
    expectedOrderValue: 140000,
    nextAction: 'Call site engineer after sample delivery.',
    isActive: true,
    createdAt: '2026-03-05'
  }
];

export const getStoredFollowUps = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return INITIAL_MOCK_FOLLOWUPS;
};

export const saveStoredFollowUps = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
};

/**
 * Standardize follow-up object structure from live backend or local cache
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
    
    // Save to local cache
    const current = getStoredFollowUps();
    saveStoredFollowUps([created, ...current]);
    return created;
  } catch (err) {
    const serverErr = err?.response?.data?.message || err?.message;
    console.warn('POST /follow-ups notice:', serverErr);
    
    const fallback = normalizeFollowUp({
      id: `FLW-${Date.now()}`,
      ...followUpData,
      communicationType: commType,
      resultingStatus: resStatus,
      createdAt: new Date().toISOString()
    });
    const current = getStoredFollowUps();
    saveStoredFollowUps([fallback, ...current]);
    return fallback;
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
      saveStoredFollowUps(normalized);
      return { 
        data: normalized, 
        total: res.data?.data?.pagination?.total || res.data?.total || normalized.length, 
        pagination: res.data?.data?.pagination,
        isLive: true 
      };
    }
  } catch (err) {
    console.warn('GET /follow-ups notice:', err?.response?.data || err.message);
  }

  // Fallback to local storage
  let list = getStoredFollowUps().map(normalizeFollowUp);
  if (params.resultingStatus) {
    list = list.filter(f => f.resultingStatus === params.resultingStatus);
  }
  if (params.communicationType) {
    list = list.filter(f => f.communicationType === params.communicationType);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(f => 
      f.quotationNumber.toLowerCase().includes(q) || 
      f.customerName.toLowerCase().includes(q) ||
      (f.customerResponse && f.customerResponse.toLowerCase().includes(q))
    );
  }
  return { data: list, total: list.length, isLive: false };
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
    console.warn('GET /follow-ups/alerts notice:', err?.response?.data || err.message);
  }

  // Client-side fallback categorization from stored follow-ups
  const all = getStoredFollowUps().map(normalizeFollowUp);
  const today = new Date().toISOString().split('T')[0];

  return {
    dueToday: all.filter(f => f.nextFollowUpDate === today),
    overdue: all.filter(f => f.nextFollowUpDate && f.nextFollowUpDate < today && !['REJECTED', 'CLOSED', 'EXPIRED'].includes(f.resultingStatus)),
    upcoming: all.filter(f => f.nextFollowUpDate && f.nextFollowUpDate > today),
    noFollowUpSet: all.filter(f => !f.nextFollowUpDate),
    closedRecently: all.filter(f => ['CLOSED', 'REJECTED', 'EXPIRED'].includes(f.resultingStatus))
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
    console.warn('GET /follow-ups/export notice:', err?.response?.data || err.message);
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
      // 404 indicates no backend timeline collection yet, fallback seamlessly
    }
  }

  const cleanQId = String(quotationId || '');
  return getStoredFollowUps()
    .map(normalizeFollowUp)
    .filter(f => String(f.quotationId) === cleanQId || (f.quotationNumber && cleanQId && f.quotationNumber.toLowerCase() === cleanQId.toLowerCase()));
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
    console.warn('GET /follow-ups/:id notice:', err?.response?.data || err.message);
  }
  const flw = getStoredFollowUps().find(f => String(f.id) === String(id) || String(f._id) === String(id));
  if (flw) return normalizeFollowUp(flw);
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
    
    const current = getStoredFollowUps();
    saveStoredFollowUps(current.map(f => String(f.id) === String(id) || String(f._id) === String(id) ? updated : f));
    return updated;
  } catch (err) {
    console.warn('PUT /follow-ups/:id notice:', err?.response?.data || err.message);
    const current = getStoredFollowUps();
    const updated = normalizeFollowUp({ ...updateData, id });
    saveStoredFollowUps(current.map(f => String(f.id) === String(id) || String(f._id) === String(id) ? updated : f));
    return updated;
  }
};

/**
 * 8. DELETE /follow-ups/{id} - Deactivate / Soft-delete a follow-up record
 */
export const deleteFollowUp = async (id) => {
  try {
    const res = await api.delete(`/follow-ups/${id}`);
    const current = getStoredFollowUps();
    saveStoredFollowUps(current.filter(f => String(f.id) !== String(id) && String(f._id) !== String(id)));
    return res.data;
  } catch (err) {
    console.warn('DELETE /follow-ups/:id notice:', err?.response?.data || err.message);
    const current = getStoredFollowUps();
    saveStoredFollowUps(current.filter(f => String(f.id) !== String(id) && String(f._id) !== String(id)));
    return { success: true };
  }
};

/**
 * 9. PUT /follow-ups/{id}/deactivate - Soft-delete a follow-up record
 */
export const deactivateFollowUp = async (id) => {
  try {
    const res = await api.put(`/follow-ups/${id}/deactivate`);
    const current = getStoredFollowUps();
    const updated = current.map(f => (String(f.id) === String(id) || String(f._id) === String(id)) ? { ...f, isActive: false } : f);
    saveStoredFollowUps(updated);
    return res.data;
  } catch (err) {
    console.warn('PUT /follow-ups/:id/deactivate notice:', err?.response?.data || err.message);
    const current = getStoredFollowUps();
    const updated = current.map(f => (String(f.id) === String(id) || String(f._id) === String(id)) ? { ...f, isActive: false } : f);
    saveStoredFollowUps(updated);
    return { success: true };
  }
};
