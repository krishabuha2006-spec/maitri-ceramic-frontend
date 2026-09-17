import api, { extractArray } from './api';

const STORAGE_KEY = 'maitri_quotation_formats';


export const DEFAULT_8_FORMATS = [
  {
    id: 'FMT-01',
    name: 'Discounted Quotation',
    formatKey: 'DISCOUNT',
    formatType: 'Print Configuration',
    description: 'Quotation with explicit discounts displayed',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  },
  {
    id: 'FMT-02',
    name: 'MRP Quotation',
    formatKey: 'MRP',
    formatType: 'Print Configuration',
    description: 'Quotation highlighting product MRP rates',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  },
  {
    id: 'FMT-03',
    name: 'Pending Items Quotation',
    formatKey: 'PENDING',
    formatType: 'Print Configuration',
    description: 'Quotation tracking pending supply items',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  },
  {
    id: 'FMT-04',
    name: 'Plumber Quotation',
    formatKey: 'PLUMBER',
    formatType: 'Print Configuration',
    description: 'Tailored quotation for contractors & plumbers',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  },
  {
    id: 'FMT-05',
    name: 'Quotation With GST Breakdown',
    formatKey: 'WITH_GST',
    formatType: 'Print Configuration',
    description: 'Full tax breakdown quote with CGST/SGST/IGST details',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: true,
    status: 'Active'
  },
  {
    id: 'FMT-06',
    name: 'Quotation Without SKU Code',
    formatKey: 'WITHOUT_SKU',
    formatType: 'Print Configuration',
    description: 'Simplified customer-facing quote omitting internal SKU codes',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  },
  {
    id: 'FMT-07',
    name: 'Standard Customer Quotation',
    formatKey: 'STANDARD',
    formatType: 'Print Configuration',
    description: 'Standard presentation quotation with product name, qty, rate and total',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  },
  {
    id: 'FMT-08',
    name: 'Detailed Breakdown Quotation',
    formatKey: 'DETAILED',
    formatType: 'Print Configuration',
    description: 'Comprehensive line-item quotation with area groupings and dimensions',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    isDefault: false,
    status: 'Active'
  }
];

const getStoredFormats = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) { }
  return DEFAULT_8_FORMATS;
};

const saveStoredFormats = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) { }
};

/**
 * Normalizes any format structure from backend API into a clean UI format contract
 */
export const normalizeQuotationFormat = (fmt, index = 0) => {
  if (!fmt) return null;
  const features = Array.isArray(fmt.features) ? fmt.features : [];

  const showGst = fmt.showGst !== undefined
    ? Boolean(fmt.showGst)
    : (features.length > 0 ? features.includes('GST') : true);

  const showMrp = fmt.showMrp !== undefined
    ? Boolean(fmt.showMrp)
    : (features.length > 0 ? features.includes('MRP') : true);

  const showDiscount = fmt.showDiscount !== undefined
    ? Boolean(fmt.showDiscount)
    : (features.length > 0 ? (features.includes('Discount') || features.includes('DISCOUNT')) : true);

  const showHsn = fmt.showHsn !== undefined
    ? Boolean(fmt.showHsn)
    : (features.length > 0 ? features.includes('HSN') : true);

  return {
    id: fmt._id || fmt.id || `FMT-0${index + 1}`,
    _id: fmt._id || fmt.id,
    name: fmt.name || fmt.formatName || fmt.title || `Format ${index + 1}`,
    formatKey: (fmt.formatKey || fmt.key || fmt.type || 'WITH_GST').toUpperCase(),
    formatType: fmt.formatType || fmt.templateCategory || fmt.category || 'Print Configuration',
    description: fmt.description || fmt.desc || '',
    showGst,
    showMrp,
    showDiscount,
    showHsn,
    terms: fmt.terms || fmt.termsConditions || '',
    isDefault: Boolean(fmt.isDefault),
    status: (fmt.status === 'Active' || fmt.status === 'ACTIVE' || fmt.isActive === true || fmt.isActive === undefined)
      ? 'Active'
      : 'Inactive'
  };
};

/**
 * GET /quotation-formats - Fetch all quotation format configurations directly from backend API
 * Auto-seeds backend MongoDB if backend collection is empty
 */
export const getQuotationFormats = async (params = {}) => {
  try {
    const res = await api.get('/quotation-formats', { params });
    const rawList = extractArray(res.data, ['quotationFormats', 'formats', 'data']);

    if (Array.isArray(rawList)) {
      if (rawList.length > 0) {
        const normalized = rawList.map((item, idx) => normalizeQuotationFormat(item, idx));
        saveStoredFormats(normalized);
        return { data: normalized, total: normalized.length, isLive: true };
      }

      // If backend returns empty collection, auto-seed all 8 presets to backend API
      try {
        const seededList = [];
        for (const preset of DEFAULT_8_FORMATS) {
          try {
            const seedPayload = {
              name: preset.name,
              formatName: preset.name,
              formatKey: preset.formatKey,
              key: preset.formatKey,
              formatType: preset.formatType,
              templateCategory: preset.formatType,
              description: preset.description,
              showGst: preset.showGst,
              showMrp: preset.showMrp,
              showDiscount: preset.showDiscount,
              showHsn: preset.showHsn,
              features: ['GST', 'MRP', 'Discount', 'HSN'],
              status: 'Active',
              isDefault: preset.isDefault
            };
            const postRes = await api.post('/quotation-formats', seedPayload);
            const created = normalizeQuotationFormat(postRes.data?.data || postRes.data);
            if (created) seededList.push(created);
          } catch (e) { }
        }
        if (seededList.length > 0) {
          saveStoredFormats(seededList);
          return { data: seededList, total: seededList.length, isLive: true };
        }
      } catch (seedErr) {
        console.warn('Backend auto-seed attempt:', seedErr);
      }
    }
  } catch (err) {
    console.warn('GET /quotation-formats backend request error:', err?.response?.data || err.message);
  }

  // Fallback to local cache with exact 8 specification formats
  const localList = getStoredFormats();
  return { data: localList, total: localList.length, isLive: false };
};

/**
 * GET /quotation-formats/{id} - Get single format details from backend API
 */
export const getQuotationFormatById = async (id) => {
  try {
    const res = await api.get(`/quotation-formats/${id}`);
    const raw = res.data?.data?.quotationFormat || res.data?.data || res.data;
    if (raw) return normalizeQuotationFormat(raw);
  } catch (err) {
    console.warn('GET /quotation-formats/:id error:', err?.response?.data || err.message);
  }

  const localList = getStoredFormats();
  const found = localList.find(f => String(f.id) === String(id) || f.formatKey === id);
  if (found) return found;
  throw new Error('Quotation format not found');
};

/**
 * POST /quotation-formats - Create new print format configuration on backend API
 */
export const createQuotationFormat = async (data) => {
  const payload = {
    name: data.name,
    formatName: data.name,
    formatKey: (data.formatKey || 'WITH_GST').toUpperCase(),
    key: (data.formatKey || 'WITH_GST').toUpperCase(),
    formatType: data.formatType || 'Print Configuration',
    templateCategory: data.formatType || 'Print Configuration',
    description: data.description || '',
    showGst: data.showGst !== false,
    showMrp: data.showMrp !== false,
    showDiscount: data.showDiscount !== false,
    showHsn: data.showHsn !== false,
    features: [
      data.showGst !== false ? 'GST' : null,
      data.showMrp !== false ? 'MRP' : null,
      data.showDiscount !== false ? 'Discount' : null,
      data.showHsn !== false ? 'HSN' : null
    ].filter(Boolean),
    terms: data.terms || '',
    status: data.status || 'Active',
    isDefault: Boolean(data.isDefault)
  };

  try {
    const res = await api.post('/quotation-formats', payload);
    const created = normalizeQuotationFormat(res.data?.data || res.data);
    const list = getStoredFormats();
    saveStoredFormats([created, ...list]);
    return created;
  } catch (err) {
    console.warn('POST /quotation-formats fallback:', err?.response?.data || err.message);
    const fallback = {
      ...payload,
      id: `FMT-${Date.now()}`
    };
    const list = getStoredFormats();
    saveStoredFormats([fallback, ...list]);
    return fallback;
  }
};

/**
 * PUT /quotation-formats/{id} - Update quotation format on backend API
 */
export const updateQuotationFormat = async (id, data) => {
  const payload = {
    name: data.name,
    formatName: data.name,
    formatKey: (data.formatKey || 'WITH_GST').toUpperCase(),
    key: (data.formatKey || 'WITH_GST').toUpperCase(),
    formatType: data.formatType || 'Print Configuration',
    templateCategory: data.formatType || 'Print Configuration',
    description: data.description || '',
    showGst: data.showGst !== false,
    showMrp: data.showMrp !== false,
    showDiscount: data.showDiscount !== false,
    showHsn: data.showHsn !== false,
    features: [
      data.showGst !== false ? 'GST' : null,
      data.showMrp !== false ? 'MRP' : null,
      data.showDiscount !== false ? 'Discount' : null,
      data.showHsn !== false ? 'HSN' : null
    ].filter(Boolean),
    terms: data.terms || '',
    status: data.status || 'Active',
    isDefault: Boolean(data.isDefault)
  };

  try {
    const res = await api.put(`/quotation-formats/${id}`, payload);
    const updated = normalizeQuotationFormat(res.data?.data || res.data);
    const list = getStoredFormats().map(f => String(f.id) === String(id) ? { ...f, ...updated } : f);
    saveStoredFormats(list);
    return updated;
  } catch (err) {
    console.warn('PUT /quotation-formats/:id fallback:', err?.response?.data || err.message);
    const list = getStoredFormats().map(f => String(f.id) === String(id) ? { ...f, ...payload } : f);
    saveStoredFormats(list);
    return { id, ...payload };
  }
};

/**
 * DELETE /quotation-formats/{id} - Delete quotation format on backend API
 */
export const deleteQuotationFormat = async (id) => {
  try {
    const res = await api.delete(`/quotation-formats/${id}`);
    const list = getStoredFormats().filter(f => String(f.id) !== String(id));
    saveStoredFormats(list);
    return res.data;
  } catch (err) {
    console.warn('DELETE /quotation-formats/:id fallback:', err?.response?.data || err.message);
    const list = getStoredFormats().filter(f => String(f.id) !== String(id));
    saveStoredFormats(list);
    return { success: true };
  }
};

/**
 * PUT /quotation-formats/{id}/deactivate - Soft-deactivate quotation format on backend API
 */
export const deactivateQuotationFormat = async (id, newStatus = 'Inactive') => {
  try {
    const res = await api.put(`/quotation-formats/${id}/deactivate`);
    const list = getStoredFormats().map(f => String(f.id) === String(id) ? { ...f, status: newStatus } : f);
    saveStoredFormats(list);
    return res.data;
  } catch (err) {
    console.warn('PUT /quotation-formats/:id/deactivate fallback:', err?.response?.data || err.message);
    try {
      await api.put(`/quotation-formats/${id}`, { status: newStatus });
    } catch (e) { }
    const list = getStoredFormats().map(f => String(f.id) === String(id) ? { ...f, status: newStatus } : f);
    saveStoredFormats(list);
    return { success: true };
  }
};
