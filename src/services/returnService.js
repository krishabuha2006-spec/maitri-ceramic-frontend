import api, { extractArray } from './api';

const STORAGE_KEY = 'maitri_returns_cache';

const INITIAL_RETURNS = [
  {
    _id: 'PR-2026-001',
    id: 'PR-2026-001',
    returnType: 'PURCHASE_RETURN',
    returnNoteNumber: 'PRN-2026-001',
    date: '2026-03-02',
    vendor: 'Kajaria Ceramics Ltd',
    purchaseRef: 'PO-KJ-8821',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    quantity: 50,
    unit: 'Sq.Ft',
    returnReason: 'Corner breakage in transit box',
    remarks: 'Approved by area sales manager',
    status: 'CONFIRMED'
  },
  {
    _id: 'SR-2026-001',
    id: 'SR-2026-001',
    returnType: 'SALES_RETURN',
    returnNoteNumber: 'SRN-2026-001',
    date: '2026-03-11',
    customerName: 'Rajesh Sharma Construction',
    invoiceNumber: 'INV-2026-001',
    challanNumber: 'CH-2026-001',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    quantity: 20,
    unit: 'Sq.Ft',
    returnReason: 'Excess box returned from site',
    remarks: 'Stock returned to godown rack B4',
    status: 'CONFIRMED'
  }
];

const loadLocalReturns = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [...INITIAL_RETURNS];
};

const saveLocalReturns = (items) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (e) {}
};

export const getReturns = async (params = {}) => {
  try {
    const res = await api.get('/returns', { params });
    const items = extractArray(res.data, ['returns', 'returnNotes', 'records', 'items']);
    const total = res.data?.total || res.data?.count || res.data?.data?.total || items.length;
    if (items && items.length > 0) {
      return { data: items, total };
    }
  } catch (err) {
    console.warn('Live /returns API fetch failed, using fallback:', err.message);
  }

  let list = loadLocalReturns();
  if (params.returnType) {
    list = list.filter(r => {
      const type = (r.returnType || '').toUpperCase();
      const pType = params.returnType.toUpperCase();
      return type === pType || (pType === 'PURCHASE_RETURN' && type === 'PURCHASE') || (pType === 'SALES_RETURN' && type === 'SALES');
    });
  }
  if (params.returnStatus) {
    list = list.filter(r => (r.status || '').toUpperCase() === params.returnStatus.toUpperCase());
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(r =>
      (r.returnNoteNumber || '').toLowerCase().includes(q) ||
      (r.customerName || '').toLowerCase().includes(q) ||
      (r.vendor || '').toLowerCase().includes(q) ||
      (r.sku || '').toLowerCase().includes(q) ||
      (r.productName || '').toLowerCase().includes(q)
    );
  }
  return { data: list, total: list.length };
};

export const getReturnById = async (id) => {
  try {
    const res = await api.get(`/returns/${id}`);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn(`Live GET /returns/${id} failed, finding in local store:`, err.message);
    const list = loadLocalReturns();
    return list.find(r => r.id === id || r._id === id);
  }
};

export const createPurchaseReturn = async (returnData) => {
  try {
    const res = await api.post('/returns/purchase-return', returnData);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('Live POST /returns/purchase-return failed, saving to local store:', err.message);
    const list = loadLocalReturns();
    const newRet = {
      _id: 'PR-' + Date.now(),
      id: 'PR-' + Date.now(),
      returnType: 'PURCHASE_RETURN',
      returnNoteNumber: returnData.returnNoteNumber || `PRN-${Date.now().toString().slice(-6)}`,
      date: returnData.returnDate || returnData.date || new Date().toISOString().split('T')[0],
      vendor: returnData.vendor || 'Vendor',
      purchaseRef: returnData.purchaseReferenceNote || returnData.purchaseRef || '-',
      sku: returnData.sku || 'SKU-UNKNOWN',
      productName: returnData.productName || 'Product',
      quantity: Number(returnData.quantity || 1),
      unit: returnData.unit || 'Sq.Ft',
      returnReason: returnData.returnReason || 'Goods return',
      remarks: returnData.remarks || '',
      status: 'CONFIRMED',
      ...returnData
    };
    list.unshift(newRet);
    saveLocalReturns(list);
    return newRet;
  }
};

export const createSalesReturn = async (returnData) => {
  try {
    const res = await api.post('/returns/sales-return', returnData);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('Live POST /returns/sales-return failed, saving to local store:', err.message);
    const list = loadLocalReturns();
    const newRet = {
      _id: 'SR-' + Date.now(),
      id: 'SR-' + Date.now(),
      returnType: 'SALES_RETURN',
      returnNoteNumber: returnData.returnNoteNumber || `SRN-${Date.now().toString().slice(-6)}`,
      date: returnData.returnDate || returnData.date || new Date().toISOString().split('T')[0],
      customerName: returnData.customerName || 'Customer',
      invoiceNumber: returnData.invoiceNumber || '-',
      challanNumber: returnData.challanNumber || '-',
      sku: returnData.sku || 'SKU-UNKNOWN',
      productName: returnData.productName || 'Product',
      quantity: Number(returnData.quantity || 1),
      unit: returnData.unit || 'Sq.Ft',
      returnReason: returnData.returnReason || 'Goods return',
      remarks: returnData.remarks || '',
      status: 'CONFIRMED',
      ...returnData
    };
    list.unshift(newRet);
    saveLocalReturns(list);
    return newRet;
  }
};

export const confirmReturn = async (id) => {
  try {
    const res = await api.put(`/returns/${id}/confirm`);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn(`Live PUT /returns/${id}/confirm failed, updating local store:`, err.message);
    const list = loadLocalReturns();
    const item = list.find(r => r.id === id || r._id === id);
    if (item) {
      item.status = 'CONFIRMED';
      saveLocalReturns(list);
      return item;
    }
    throw err;
  }
};

export const cancelReturn = async (id, cancellationReason = '') => {
  try {
    const res = await api.put(`/returns/${id}/cancel`, { cancellationReason });
    return res.data?.data || res.data;
  } catch (err) {
    console.warn(`Live PUT /returns/${id}/cancel failed, updating local store:`, err.message);
    const list = loadLocalReturns();
    const item = list.find(r => r.id === id || r._id === id);
    if (item) {
      item.status = 'CANCELLED';
      item.cancellationReason = cancellationReason;
      saveLocalReturns(list);
      return item;
    }
    throw err;
  }
};

export const exportReturns = async (params = {}) => {
  try {
    const res = await api.get('/returns/export', {
      params,
      responseType: 'blob'
    });
    return res.data;
  } catch (err) {
    console.warn('Backend returns export failed:', err.message);
    return null;
  }
};

export const getPurchaseReturns = async (params = {}) => {
  return getReturns({ ...params, returnType: 'PURCHASE_RETURN' });
};

export const getSalesReturns = async (params = {}) => {
  return getReturns({ ...params, returnType: 'SALES_RETURN' });
};
