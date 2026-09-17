import api, { extractArray } from './api';

// --- Module 2: Unit Master ---
const UNIT_STORAGE_KEY = 'maitri_unit_master';
const TAX_STORAGE_KEY = 'maitri_tax_presets';

export const DEFAULT_UNITS = [
  { id: 'UNIT-01', unitCode: 'Sq.Ft', unitName: 'Square Feet', description: 'Tiles and surface floor coverage', isDecimalAllowed: true, status: 'Active' },
  { id: 'UNIT-02', unitCode: 'Sq.Mt', unitName: 'Square Meter', description: 'International tile coverage standard', isDecimalAllowed: true, status: 'Active' },
  { id: 'UNIT-03', unitCode: 'Box', unitName: 'Box / Carton', description: 'Standard packaged tile cartons', isDecimalAllowed: false, status: 'Active' },
  { id: 'UNIT-04', unitCode: 'Pcs', unitName: 'Pieces', description: 'Individual units for sanitaryware & CP fixtures', isDecimalAllowed: false, status: 'Active' },
  { id: 'UNIT-05', unitCode: 'Set', unitName: 'Set', description: 'Bathroom combo & accessories set', isDecimalAllowed: false, status: 'Active' },
  { id: 'UNIT-06', unitCode: 'Kg', unitName: 'Kilogram', description: 'Tile adhesive, grout and chemical bags', isDecimalAllowed: true, status: 'Active' },
  { id: 'UNIT-07', unitCode: 'Ltr', unitName: 'Liter', description: 'Cleaning chemical and liquid primers', isDecimalAllowed: true, status: 'Active' },
  { id: 'UNIT-08', unitCode: 'Bag', unitName: 'Bag', description: 'White cement & dry adhesive bags', isDecimalAllowed: false, status: 'Active' }
];

export const DEFAULT_TAX_PRESETS = [
  { id: 'TAX-01', name: 'GST 18%', gstPct: 18, cgstPct: 9, sgstPct: 9, igstPct: 18, cessPct: 0, description: 'Standard Ceramic Tiles & Sanitaryware Tax Rate', isDefault: true, status: 'Active' },
  { id: 'TAX-02', name: 'GST 28%', gstPct: 28, cgstPct: 14, sgstPct: 14, igstPct: 28, cessPct: 0, description: 'Luxury Ceramic & Premium Bath Fittings', isDefault: false, status: 'Active' },
  { id: 'TAX-03', name: 'GST 12%', gstPct: 12, cgstPct: 6, sgstPct: 6, igstPct: 12, cessPct: 0, description: 'Specified Construction Materials & Pipes', isDefault: false, status: 'Active' },
  { id: 'TAX-04', name: 'GST 5%', gstPct: 5, cgstPct: 2.5, sgstPct: 2.5, igstPct: 5, cessPct: 0, description: 'Sand, Basic Clay Bricks & Aggregates', isDefault: false, status: 'Active' },
  { id: 'TAX-05', name: 'Exempted (0%)', gstPct: 0, cgstPct: 0, sgstPct: 0, igstPct: 0, cessPct: 0, description: 'Exempted Construction Materials', isDefault: false, status: 'Active' }
];

const getStoredUnits = () => {
  try {
    const raw = localStorage.getItem(UNIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_UNITS;
};

const saveStoredUnits = (list) => {
  try {
    localStorage.setItem(UNIT_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
};

const getStoredTaxes = () => {
  try {
    const raw = localStorage.getItem(TAX_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_TAX_PRESETS;
};

const saveStoredTaxes = (list) => {
  try {
    localStorage.setItem(TAX_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
};

export const normalizeUnit = (u, idx = 0) => ({
  id: u._id || u.id || `UNIT-0${idx + 1}`,
  unitCode: u.unitCode || u.code || u.name || 'Pcs',
  unitName: u.unitName || u.name || u.unitCode || 'Pieces',
  description: u.description || '',
  isDecimalAllowed: u.isDecimalAllowed !== undefined ? Boolean(u.isDecimalAllowed) : true,
  status: u.status || (u.isActive === false ? 'Inactive' : 'Active')
});

export const normalizeTaxPreset = (t, idx = 0) => {
  const gstPct = Number(t.gstPct ?? t.taxRate ?? t.percentage ?? 18);
  return {
    id: t._id || t.id || `TAX-0${idx + 1}`,
    name: t.name || t.presetName || `GST ${gstPct}%`,
    gstPct: gstPct,
    cgstPct: Number(t.cgstPct ?? (gstPct / 2)),
    sgstPct: Number(t.sgstPct ?? (gstPct / 2)),
    igstPct: Number(t.igstPct ?? gstPct),
    cessPct: Number(t.cessPct ?? 0),
    description: t.description || '',
    isDefault: Boolean(t.isDefault),
    status: t.status || (t.isActive === false ? 'Inactive' : 'Active')
  };
};

/**
 * Unit Master Endpoints
 */
export const getUnits = async () => {
  try {
    const res = await api.get('/units');
    const list = extractArray(res.data, ['units', 'data']);
    if (Array.isArray(list) && list.length > 0) {
      const normalized = list.map(normalizeUnit);
      saveStoredUnits(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('GET /units fallback:', err?.response?.data || err.message);
  }
  return getStoredUnits();
};

export const getUnitById = async (id) => {
  try {
    const res = await api.get(`/units/${id}`);
    const raw = res.data?.data?.unit || res.data?.data || res.data;
    if (raw) return normalizeUnit(raw);
  } catch (err) {}
  const list = getStoredUnits();
  return list.find(u => String(u.id) === String(id) || u.unitCode === id) || null;
};

export const createUnit = async (unitData) => {
  const payload = {
    unitCode: unitData.unitCode,
    unitName: unitData.unitName,
    description: unitData.description || '',
    isDecimalAllowed: unitData.isDecimalAllowed !== false,
    status: unitData.status || 'Active'
  };

  try {
    const res = await api.post('/units', payload);
    const created = normalizeUnit(res.data?.data?.unit || res.data?.data || res.data);
    const list = getStoredUnits();
    saveStoredUnits([created, ...list]);
    return created;
  } catch (err) {
    console.warn('POST /units fallback:', err?.response?.data || err.message);
    const fallback = { ...payload, id: `UNIT-${Date.now()}` };
    const list = getStoredUnits();
    saveStoredUnits([fallback, ...list]);
    return fallback;
  }
};

export const updateUnit = async (id, unitData) => {
  const payload = {
    unitCode: unitData.unitCode,
    unitName: unitData.unitName,
    description: unitData.description || '',
    isDecimalAllowed: unitData.isDecimalAllowed !== false,
    status: unitData.status || 'Active'
  };

  try {
    const res = await api.put(`/units/${id}`, payload);
    const updated = normalizeUnit(res.data?.data?.unit || res.data?.data || res.data);
    const list = getStoredUnits().map(u => String(u.id) === String(id) ? updated : u);
    saveStoredUnits(list);
    return updated;
  } catch (err) {
    console.warn('PUT /units/:id fallback:', err?.response?.data || err.message);
    const list = getStoredUnits().map(u => String(u.id) === String(id) ? { ...u, ...payload } : u);
    saveStoredUnits(list);
    return { id, ...payload };
  }
};

export const deleteUnit = async (id) => {
  try {
    const res = await api.delete(`/units/${id}`);
    const list = getStoredUnits().filter(u => String(u.id) !== String(id));
    saveStoredUnits(list);
    return res.data;
  } catch (err) {
    console.warn('DELETE /units/:id fallback:', err?.response?.data || err.message);
    const list = getStoredUnits().filter(u => String(u.id) !== String(id));
    saveStoredUnits(list);
    return { success: true };
  }
};

export const deactivateUnit = async (id, status = 'Inactive') => {
  try {
    const res = await api.put(`/units/${id}/deactivate`);
    const list = getStoredUnits().map(u => String(u.id) === String(id) ? { ...u, status } : u);
    saveStoredUnits(list);
    return res.data;
  } catch (err) {
    console.warn('PUT /units/:id/deactivate fallback:', err?.response?.data || err.message);
    try {
      await api.put(`/units/${id}`, { status });
    } catch (e) {}
    const list = getStoredUnits().map(u => String(u.id) === String(id) ? { ...u, status } : u);
    saveStoredUnits(list);
    return { success: true };
  }
};

/**
 * Tax Master Endpoints
 */
export const getTaxPresets = async () => {
  try {
    const res = await api.get('/tax-presets');
    const list = extractArray(res.data, ['taxPresets', 'presets', 'taxes', 'data']);
    if (Array.isArray(list) && list.length > 0) {
      const normalized = list.map(normalizeTaxPreset);
      saveStoredTaxes(normalized);
      return normalized;
    }
  } catch (err) {
    console.warn('GET /tax-presets fallback:', err?.response?.data || err.message);
  }
  return getStoredTaxes();
};

export const getTaxPresetById = async (id) => {
  try {
    const res = await api.get(`/tax-presets/${id}`);
    const raw = res.data?.data?.taxPreset || res.data?.data || res.data;
    if (raw) return normalizeTaxPreset(raw);
  } catch (err) {}
  const list = getStoredTaxes();
  return list.find(t => String(t.id) === String(id)) || null;
};

export const createTaxPreset = async (taxData) => {
  const gstPct = Number(taxData.gstPct ?? 18);
  const payload = {
    name: taxData.name || `GST ${gstPct}%`,
    gstPct: gstPct,
    cgstPct: Number(taxData.cgstPct ?? (gstPct / 2)),
    sgstPct: Number(taxData.sgstPct ?? (gstPct / 2)),
    igstPct: Number(taxData.igstPct ?? gstPct),
    cessPct: Number(taxData.cessPct ?? 0),
    description: taxData.description || '',
    isDefault: Boolean(taxData.isDefault),
    status: taxData.status || 'Active'
  };

  try {
    const res = await api.post('/tax-presets', payload);
    const created = normalizeTaxPreset(res.data?.data?.taxPreset || res.data?.data || res.data);
    const list = getStoredTaxes();
    saveStoredTaxes([created, ...list]);
    return created;
  } catch (err) {
    console.warn('POST /tax-presets fallback:', err?.response?.data || err.message);
    const fallback = { ...payload, id: `TAX-${Date.now()}` };
    const list = getStoredTaxes();
    saveStoredTaxes([fallback, ...list]);
    return fallback;
  }
};

export const updateTaxPreset = async (id, taxData) => {
  const gstPct = Number(taxData.gstPct ?? 18);
  const payload = {
    name: taxData.name,
    gstPct: gstPct,
    cgstPct: Number(taxData.cgstPct ?? (gstPct / 2)),
    sgstPct: Number(taxData.sgstPct ?? (gstPct / 2)),
    igstPct: Number(taxData.igstPct ?? gstPct),
    cessPct: Number(taxData.cessPct ?? 0),
    description: taxData.description || '',
    isDefault: Boolean(taxData.isDefault),
    status: taxData.status
  };

  try {
    const res = await api.put(`/tax-presets/${id}`, payload);
    const updated = normalizeTaxPreset(res.data?.data?.taxPreset || res.data?.data || res.data);
    const list = getStoredTaxes().map(t => String(t.id) === String(id) ? updated : t);
    saveStoredTaxes(list);
    return updated;
  } catch (err) {
    console.warn('PUT /tax-presets/:id fallback:', err?.response?.data || err.message);
    const list = getStoredTaxes().map(t => String(t.id) === String(id) ? { ...t, ...payload } : t);
    saveStoredTaxes(list);
    return { id, ...payload };
  }
};

export const deleteTaxPreset = async (id) => {
  try {
    const res = await api.delete(`/tax-presets/${id}`);
    const list = getStoredTaxes().filter(t => String(t.id) !== String(id));
    saveStoredTaxes(list);
    return res.data;
  } catch (err) {
    console.warn('DELETE /tax-presets/:id fallback:', err?.response?.data || err.message);
    const list = getStoredTaxes().filter(t => String(t.id) !== String(id));
    saveStoredTaxes(list);
    return { success: true };
  }
};

export const deactivateTaxPreset = async (id, status = 'Inactive') => {
  try {
    const res = await api.put(`/tax-presets/${id}/deactivate`);
    const list = getStoredTaxes().map(t => String(t.id) === String(id) ? { ...t, status } : t);
    saveStoredTaxes(list);
    return res.data;
  } catch (err) {
    console.warn('PUT /tax-presets/:id/deactivate fallback:', err?.response?.data || err.message);
    try {
      await api.put(`/tax-presets/${id}`, { status });
    } catch (e) {}
    const list = getStoredTaxes().map(t => String(t.id) === String(id) ? { ...t, status } : t);
    saveStoredTaxes(list);
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

// --- Module 2: Quotation Format Master (Re-exported from quotationFormatService) ---
export { 
  getQuotationFormats, 
  createQuotationFormat, 
  updateQuotationFormat, 
  deleteQuotationFormat, 
  deactivateQuotationFormat 
} from './quotationFormatService';

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


