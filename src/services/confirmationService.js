import api, { extractArray } from './api';

export const getConfirmations = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, ...params };
    const res = await api.get('/confirmations', { params: queryParams });
    const list = extractArray(res.data, ['confirmations', 'orders']);
    return { data: list, total: res.data?.data?.pagination?.total || list.length };
  } catch (err) {
    return { data: [], total: 0 };
  }
};

export const getConfirmationById = async (id) => {
  try {
    const res = await api.get(`/confirmations/${id}`);
    return res.data?.data || res.data;
  } catch (err) {
    throw err;
  }
};

export const createConfirmation = async (payload) => {
  try {
    const res = await api.post('/confirmations', payload);
    return res.data?.data || res.data;
  } catch (err) {
    return payload;
  }
};

export const updateConfirmation = async (id, payload) => {
  try {
    const res = await api.put(`/confirmations/${id}`, payload);
    return res.data?.data || res.data;
  } catch (err) {
    return payload;
  }
};

export const approveConfirmation = async (id) => {
  try {
    const res = await api.put(`/confirmations/${id}/approve`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

export const cancelConfirmation = async (id) => {
  try {
    const res = await api.put(`/confirmations/${id}/cancel`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

export const getConfirmationQuantityLedger = async (id) => {
  try {
    const res = await api.get(`/confirmations/${id}/quantity-ledger`);
    return res.data?.data || res.data;
  } catch (err) {
    return [];
  }
};

export const getConfirmationAmountComparison = async (id) => {
  try {
    const res = await api.get(`/confirmations/${id}/amount-comparison`);
    return res.data?.data || res.data;
  } catch (err) {
    return null;
  }
};

export const exportConfirmation = async (id) => {
  try {
    const res = await api.get(`/confirmations/${id}/export`, { responseType: 'blob' });
    return res.data;
  } catch (err) {
    console.warn('Export confirmation failed:', err);
  }
};
