import api, { extractArray } from './api';

// --- Module 2: Unit Master ---
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

export const normalizeUnit = (u, idx = 0) => ({
  _id: u._id || (typeof u.id === 'string' && /^[0-9a-fA-F]{24}$/.test(u.id) ? u.id : undefined),
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
      return list.map(normalizeUnit);
    }
  } catch (err) {
    console.warn('GET /units notice:', err?.response?.data || err.message);
  }
  return DEFAULT_UNITS.map(normalizeUnit);
};

export const getUnitById = async (id) => {
  try {
    const res = await api.get(`/units/${id}`);
    const raw = res.data?.data?.unit || res.data?.data || res.data;
    if (raw) return normalizeUnit(raw);
  } catch (err) {}
  const found = DEFAULT_UNITS.find(u => String(u.id) === String(id) || u.unitCode === id);
  return found ? normalizeUnit(found) : null;
};

export const createUnit = async (unitData) => {
  const payload = {
    unitCode: unitData.unitCode,
    unitName: unitData.unitName,
    description: unitData.description || '',
    isDecimalAllowed: unitData.isDecimalAllowed !== false,
    status: unitData.status || 'Active'
  };

  const res = await api.post('/units', payload);
  return normalizeUnit(res.data?.data?.unit || res.data?.data || res.data);
};

export const updateUnit = async (id, unitData) => {
  const payload = {
    unitCode: unitData.unitCode,
    unitName: unitData.unitName,
    description: unitData.description || '',
    isDecimalAllowed: unitData.isDecimalAllowed !== false,
    status: unitData.status || 'Active'
  };

  const res = await api.put(`/units/${id}`, payload);
  return normalizeUnit(res.data?.data?.unit || res.data?.data || res.data);
};

export const deleteUnit = async (id) => {
  const res = await api.delete(`/units/${id}`);
  return res.data;
};

export const deactivateUnit = async (id, status = 'Inactive') => {
  try {
    const res = await api.put(`/units/${id}/deactivate`);
    return res.data;
  } catch (err) {
    const res = await api.put(`/units/${id}`, { status });
    return res.data;
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
      return list.map(normalizeTaxPreset);
    }
  } catch (err) {
    console.warn('GET /tax-presets notice:', err?.response?.data || err.message);
  }
  return DEFAULT_TAX_PRESETS.map(normalizeTaxPreset);
};

export const getTaxPresetById = async (id) => {
  try {
    const res = await api.get(`/tax-presets/${id}`);
    const raw = res.data?.data?.taxPreset || res.data?.data || res.data;
    if (raw) return normalizeTaxPreset(raw);
  } catch (err) {}
  const found = DEFAULT_TAX_PRESETS.find(t => String(t.id) === String(id));
  return found ? normalizeTaxPreset(found) : null;
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

  const res = await api.post('/tax-presets', payload);
  return normalizeTaxPreset(res.data?.data?.taxPreset || res.data?.data || res.data);
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

  const res = await api.put(`/tax-presets/${id}`, payload);
  return normalizeTaxPreset(res.data?.data?.taxPreset || res.data?.data || res.data);
};

export const deleteTaxPreset = async (id) => {
  const res = await api.delete(`/tax-presets/${id}`);
  return res.data;
};

export const deactivateTaxPreset = async (id, status = 'Inactive') => {
  try {
    const res = await api.put(`/tax-presets/${id}/deactivate`);
    return res.data;
  } catch (err) {
    const res = await api.put(`/tax-presets/${id}`, { status });
    return res.data;
  }
};

// --- Module 2: Payment Mode Master ---
export const getPaymentModes = async () => {
  try {
    const res = await api.get('/payment-modes');
    const list = extractArray(res.data, ['paymentModes', 'modes', 'data']);
    if (Array.isArray(list) && list.length > 0) {
      return list.map(m => ({
        _id: m._id || m.id,
        id: m._id || m.id,
        modeName: m.modeName || m.name || 'Bank Transfer',
        modeCode: m.modeCode || '',
        requiresReference: m.requiresReference !== undefined ? m.requiresReference : true
      }));
    }
  } catch (err) {}
  return [
    { _id: '6aa7c9ec612a410d893bcbc0', id: '6aa7c9ec612a410d893bcbc0', modeName: 'Bank Transfer', modeCode: 'BANK_TRANSFER', requiresReference: true },
    { _id: '6aa7c9eb612a410d893bcbbf', id: '6aa7c9eb612a410d893bcbbf', modeName: 'Cash', modeCode: 'CASH', requiresReference: false },
    { _id: '6aa7c9ec612a410d893bcbc1', id: '6aa7c9ec612a410d893bcbc1', modeName: 'UPI', modeCode: 'UPI', requiresReference: true },
    { _id: '6aa7c9ec612a410d893bcbc2', id: '6aa7c9ec612a410d893bcbc2', modeName: 'Cheque', modeCode: 'CHEQUE', requiresReference: true },
    { _id: '6aa7c9ec612a410d893bcbc3', id: '6aa7c9ec612a410d893bcbc3', modeName: 'Debit/Credit Card', modeCode: 'CARD', requiresReference: true }
  ];
};

export const createPaymentMode = async (data) => {
  const res = await api.post('/payment-modes', data);
  return res.data?.data || res.data;
};

export const updatePaymentMode = async (id, data) => {
  const res = await api.put(`/payment-modes/${id}`, data);
  return res.data?.data || res.data;
};

export const deactivatePaymentMode = async (id) => {
  const res = await api.put(`/payment-modes/${id}/deactivate`);
  return res.data;
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
    return {
      data: Array.isArray(list) ? list : [],
      total: res.data?.data?.pagination?.total || (Array.isArray(list) ? list.length : 0)
    };
  } catch (err) {
    console.error('GET /vendors error:', err);
    return { data: [], total: 0 };
  }
};

export const getVendorById = async (id) => {
  try {
    const res = await api.get(`/vendors/${id}`);
    return res.data?.data || res.data;
  } catch (err) {
    console.error('GET /vendors/:id error:', err);
    return null;
  }
};

export const createVendor = async (data) => {
  const res = await api.post('/vendors', data);
  return res.data?.data || res.data;
};

export const updateVendor = async (id, data) => {
  const res = await api.put(`/vendors/${id}`, data);
  return res.data?.data || res.data;
};

export const deactivateVendor = async (id) => {
  const res = await api.put(`/vendors/${id}/deactivate`);
  return res.data;
};
