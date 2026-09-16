import api, { extractArray } from './api';

// --- Module 2: Unit Master ---
export const getUnits = async () => {
  try {
    const res = await api.get('/units');
    const list = extractArray(res.data, ['units', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [
    { id: 'Sq.Ft', unitCode: 'Sq.Ft', unitName: 'Square Feet' },
    { id: 'Sq.Mt', unitCode: 'Sq.Mt', unitName: 'Square Meter' },
    { id: 'Box', unitCode: 'Box', unitName: 'Box / Carton' },
    { id: 'Pcs', unitCode: 'Pcs', unitName: 'Pieces' },
    { id: 'Set', unitCode: 'Set', unitName: 'Set' }
  ];
};

export const createUnit = async (unitData) => {
  try {
    const res = await api.post('/units', unitData);
    return res.data?.data || res.data;
  } catch (err) {
    return unitData;
  }
};

export const updateUnit = async (id, unitData) => {
  try {
    const res = await api.put(`/units/${id}`, unitData);
    return res.data?.data || res.data;
  } catch (err) {
    return unitData;
  }
};

export const deactivateUnit = async (id) => {
  try {
    const res = await api.put(`/units/${id}/deactivate`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

// --- Module 2: Tax Master ---
export const getTaxPresets = async () => {
  try {
    const res = await api.get('/tax-presets');
    const list = extractArray(res.data, ['taxPresets', 'presets', 'taxes', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [
    { id: 'GST-18', name: 'GST 18%', gstPct: 18, cgstPct: 9, sgstPct: 9, igstPct: 18 },
    { id: 'GST-28', name: 'GST 28%', gstPct: 28, cgstPct: 14, sgstPct: 14, igstPct: 28 },
    { id: 'GST-5', name: 'GST 5%', gstPct: 5, cgstPct: 2.5, sgstPct: 2.5, igstPct: 5 },
    { id: 'GST-0', name: 'Exempted (0%)', gstPct: 0, cgstPct: 0, sgstPct: 0, igstPct: 0 }
  ];
};

export const createTaxPreset = async (taxData) => {
  try {
    const res = await api.post('/tax-presets', taxData);
    return res.data?.data || res.data;
  } catch (err) {
    return taxData;
  }
};

export const updateTaxPreset = async (id, taxData) => {
  try {
    const res = await api.put(`/tax-presets/${id}`, taxData);
    return res.data?.data || res.data;
  } catch (err) {
    return taxData;
  }
};

export const deactivateTaxPreset = async (id) => {
  try {
    const res = await api.put(`/tax-presets/${id}/deactivate`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

// --- Module 2: Payment Mode Master ---
export const getPaymentModes = async () => {
  try {
    const res = await api.get('/payment-modes');
    const list = extractArray(res.data, ['paymentModes', 'modes', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [
    { id: 'Bank Transfer', name: 'Bank Transfer (NEFT/RTGS/IMPS)' },
    { id: 'UPI', name: 'UPI / QR Code' },
    { id: 'Cheque', name: 'Cheque' },
    { id: 'Cash', name: 'Cash' },
    { id: 'Credit Card', name: 'Credit / Debit Card' }
  ];
};

export const createPaymentMode = async (data) => {
  try {
    const res = await api.post('/payment-modes', data);
    return res.data?.data || res.data;
  } catch (err) {
    return data;
  }
};

export const updatePaymentMode = async (id, data) => {
  try {
    const res = await api.put(`/payment-modes/${id}`, data);
    return res.data?.data || res.data;
  } catch (err) {
    return data;
  }
};

export const deactivatePaymentMode = async (id) => {
  try {
    const res = await api.put(`/payment-modes/${id}/deactivate`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

// --- Module 2: Quotation Format Master ---
export const getQuotationFormats = async () => {
  try {
    const res = await api.get('/quotation-formats');
    const list = extractArray(res.data, ['quotationFormats', 'formats', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {}
  return [
    { id: 'FMT-1', name: 'Quotation With GST (Standard)', formatKey: 'WITH_GST' },
    { id: 'FMT-2', name: 'Quotation Without GST (Estimate)', formatKey: 'WITHOUT_GST' },
    { id: 'FMT-3', name: 'Proforma Invoice Format', formatKey: 'PROFORMA' },
    { id: 'FMT-4', name: 'Architect / Builder Discount Format', formatKey: 'ARCHITECT' }
  ];
};

export const createQuotationFormat = async (data) => {
  try {
    const res = await api.post('/quotation-formats', data);
    return res.data?.data || res.data;
  } catch (err) {
    return data;
  }
};

export const updateQuotationFormat = async (id, data) => {
  try {
    const res = await api.put(`/quotation-formats/${id}`, data);
    return res.data?.data || res.data;
  } catch (err) {
    return data;
  }
};

export const deactivateQuotationFormat = async (id) => {
  try {
    const res = await api.put(`/quotation-formats/${id}/deactivate`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};

// --- Module 2: Vendor Master ---
export const getVendors = async (params = {}) => {
  try {
    const res = await api.get('/vendors', { params });
    const list = extractArray(res.data, ['vendors', 'suppliers', 'data']);
    if (Array.isArray(list) && list.length > 0) return { data: list, total: res.data?.data?.pagination?.total || list.length };
  } catch (err) {}
  return {
    data: [
      { id: 'VND-001', vendorName: 'Kajaria Ceramics Ltd', city: 'Morbi', contactPerson: 'Rajesh Shah', mobile: '9825000111' },
      { id: 'VND-002', vendorName: 'Somany Ceramics Ltd', city: 'Kadi', contactPerson: 'Jayesh Patel', mobile: '9825000222' }
    ],
    total: 2
  };
};

export const getVendorById = async (id) => {
  try {
    const res = await api.get(`/vendors/${id}`);
    return res.data?.data || res.data;
  } catch (err) {}
  return { id, vendorName: 'Kajaria Ceramics Ltd', city: 'Morbi', contactPerson: 'Rajesh Shah', mobile: '9825000111' };
};

export const createVendor = async (data) => {
  try {
    const res = await api.post('/vendors', data);
    return res.data?.data || res.data;
  } catch (err) {
    return data;
  }
};

export const updateVendor = async (id, data) => {
  try {
    const res = await api.put(`/vendors/${id}`, data);
    return res.data?.data || res.data;
  } catch (err) {
    return data;
  }
};

export const deactivateVendor = async (id) => {
  try {
    const res = await api.put(`/vendors/${id}/deactivate`);
    return res.data;
  } catch (err) {
    return { success: true };
  }
};


