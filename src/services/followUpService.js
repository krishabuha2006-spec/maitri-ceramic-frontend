import api, { extractArray } from './api';

let MOCK_FOLLOWUPS = [
  {
    id: 'FLW-001',
    quotationId: 'QT-2026-001',
    quotationNumber: 'QT-2026-001',
    customerName: 'Rajesh Sharma Construction',
    quotationAmount: 144432.00,
    followUpDate: '2026-03-05',
    nextFollowUpDate: '2026-03-16',
    salesperson: 'Vikram Mehta',
    status: 'Customer Interested',
    remarks: 'Customer reviewed Statuario tile sample. Requested final 2% discount approval.',
    contactMode: 'Call',
    priority: 'High'
  }
];

export const getFollowUps = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/follow-ups', { params: queryParams });
    const list = extractArray(res.data, ['followUps', 'followups', 'list']);
    if (Array.isArray(list)) {
      return { data: list, total: res.data?.data?.pagination?.total || list.length };
    }
  } catch (err) {}
  return { data: MOCK_FOLLOWUPS, total: MOCK_FOLLOWUPS.length };
};

export const getFollowUpAlerts = async () => {
  try {
    const res = await api.get('/follow-ups/alerts');
    if (res.data?.data || res.data) {
      return res.data?.data || res.data;
    }
  } catch (err) {}
  return {
    dueToday: MOCK_FOLLOWUPS,
    overdue: [],
    upcoming: [],
    noFollowUpSet: [],
    closedRecently: []
  };
};

export const createFollowUp = async (followUpData) => {
  try {
    const res = await api.post('/follow-ups', followUpData);
    return res.data?.data || res.data;
  } catch (err) {
    const newFlw = {
      id: `FLW-00${MOCK_FOLLOWUPS.length + 1}`,
      followUpDate: new Date().toISOString().split('T')[0],
      ...followUpData
    };
    MOCK_FOLLOWUPS.unshift(newFlw);
    return newFlw;
  }
};

export const getQuotationFollowUpTimeline = async (quotationId) => {
  try {
    const res = await api.get(`/follow-ups/quotation/${quotationId}/timeline`);
    return extractArray(res.data, ['timeline', 'followUps']);
  } catch (err) {}
  return MOCK_FOLLOWUPS.filter(f => f.quotationId === quotationId);
};

export const getFollowUpById = async (id) => {
  try {
    const res = await api.get(`/follow-ups/${id}`);
    return res.data?.data || res.data;
  } catch (err) {}
  const flw = MOCK_FOLLOWUPS.find(f => f.id === id);
  if (flw) return flw;
  return { id, quotationId: 'QT-2026-001', customerName: 'Rajesh Sharma Construction', status: 'Pending' };
};

export const updateFollowUp = async (id, followUpData) => {
  try {
    const res = await api.put(`/follow-ups/${id}`, followUpData);
    return res.data?.data || res.data;
  } catch (err) {
    const idx = MOCK_FOLLOWUPS.findIndex(f => f.id === id);
    if (idx !== -1) {
      MOCK_FOLLOWUPS[idx] = { ...MOCK_FOLLOWUPS[idx], ...followUpData };
      return MOCK_FOLLOWUPS[idx];
    }
    throw new Error('Follow-up not found');
  }
};

export const deactivateFollowUp = async (id) => {
  try {
    const res = await api.put(`/follow-ups/${id}/deactivate`);
    return res.data;
  } catch (err) {
    const idx = MOCK_FOLLOWUPS.findIndex(f => f.id === id);
    if (idx !== -1) {
      MOCK_FOLLOWUPS.splice(idx, 1);
    }
    return { success: true };
  }
};

export const exportFollowUps = async (params = {}) => {
  try {
    const res = await api.get('/follow-ups/export', { params, responseType: 'blob' });
    return res.data;
  } catch (err) {}
};
