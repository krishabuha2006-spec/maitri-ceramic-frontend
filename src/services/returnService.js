import api, { extractArray } from './api';

const STORAGE_KEY = 'maitri_returns_cache';

export const normalizeReturn = (r) => {
  if (!r) return null;
  const cust = typeof r.customer === 'object' && r.customer !== null ? r.customer : {};
  const custId = typeof r.customer === 'string' ? r.customer : (cust._id || cust.id || r.customerId || '');
  const vendorName = r.vendor?.vendorName || r.vendorName || (typeof r.vendor === 'string' ? r.vendor : '') || '-';
  const customerName = cust.customerName || cust.name || r.customerName || (typeof r.customer === 'string' && !/^[0-9a-fA-F]{24}$/.test(r.customer) ? r.customer : '') || '-';
  const productName = r.productNameSnapshot || r.product?.productName || r.productName || '-';
  const sku = r.skuCodeSnapshot || r.product?.companySkuCode || r.sku || '-';
  const unit = r.unit?.unitCode || r.unit || 'Sq.Ft';
  const status = (r.returnStatus || r.status || 'CONFIRMED').toUpperCase();
  const invoiceNumber = r.invoice?.invoiceNumber || r.invoiceNumber || (r.invoice && typeof r.invoice === 'string' ? r.invoice : '') || '-';
  const challanNumber = r.challan?.challanNumber || r.challanNumber || (r.challan && typeof r.challan === 'string' ? r.challan : '') || '-';
  const purchaseRef = r.purchaseReferenceNote || r.purchaseRef || '-';
  const refundAmount = Number(r.refundAmount || r.amount || r.totalAmount || (Number(r.quantity || 1) * Number(r.rate || r.unitPrice || 0)) || 0);

  return {
    ...r,
    _id: r._id || r.id,
    id: r.id || r._id,
    customerId: custId,
    customer: cust,
    returnType: r.returnType || (r.customer || r.customerName ? 'SALES_RETURN' : 'PURCHASE_RETURN'),
    returnNoteNumber: r.returnNoteNumber || `RN-${Date.now().toString().slice(-6)}`,
    date: r.returnDate ? r.returnDate.split('T')[0] : (r.date ? r.date.split('T')[0] : new Date().toISOString().split('T')[0]),
    returnDate: r.returnDate ? r.returnDate.split('T')[0] : (r.date ? r.date.split('T')[0] : new Date().toISOString().split('T')[0]),
    vendor: vendorName,
    vendorName: vendorName,
    customerName: customerName,
    productName: productName,
    sku: sku,
    quantity: Number(r.quantity || 1),
    unit: unit,
    refundAmount: refundAmount,
    status: status,
    returnStatus: status,
    invoiceNumber: invoiceNumber,
    challanNumber: challanNumber,
    purchaseRef: purchaseRef,
    purchaseReferenceNote: purchaseRef,
    returnReason: r.returnReason || r.reason || '',
    remarks: r.remarks || r.notes || ''
  };
};

const loadLocalReturns = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out legacy dummy items
        return parsed.filter(item => item && item.id !== 'PR-2026-001' && item.id !== 'SR-2026-001' && item._id !== 'PR-2026-001' && item._id !== 'SR-2026-001');
      }
    }
  } catch (e) {}
  return [];
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
    const total = res.data?.data?.pagination?.total || res.data?.pagination?.total || res.data?.total || (Array.isArray(items) ? items.length : 0);
    if (Array.isArray(items)) {
      const normalized = items.map(normalizeReturn).filter(Boolean);
      return { data: normalized, total, isLive: true };
    }
  } catch (err) {
    console.warn('Live /returns API fetch notice:', err?.response?.data || err.message);
  }

  let list = loadLocalReturns().map(normalizeReturn).filter(Boolean);
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
  return { data: list, total: list.length, isLive: false };
};

export const getReturnById = async (id) => {
  try {
    const res = await api.get(`/returns/${id}`);
    const raw = res.data?.data || res.data;
    if (raw) return normalizeReturn(raw);
  } catch (err) {
    console.warn(`Live GET /returns/${id} failed:`, err.message);
  }
  const list = loadLocalReturns().map(normalizeReturn).filter(Boolean);
  return list.find(r => r.id === id || r._id === id);
};

export const createPurchaseReturn = async (returnData) => {
  // Backend API payload
  const apiPayload = {
    vendorId: returnData.vendorId,
    productId: returnData.productId,
    quantity: Number(returnData.quantity || 1),
    purchaseReferenceNote: returnData.purchaseReferenceNote || returnData.purchaseRef || '',
    returnReason: returnData.returnReason || 'Defective / Excess material return',
    remarks: returnData.remarks || '',
    returnDate: returnData.returnDate || returnData.date || new Date().toISOString()
  };

  try {
    const res = await api.post('/returns/purchase-return', apiPayload);
    const saved = normalizeReturn(res.data?.data || res.data);
    return saved;
  } catch (err) {
    const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
    if (backendMsg) {
      throw new Error(backendMsg);
    }
    throw err;
  }
};

export const createSalesReturn = async (returnData) => {
  // Backend API payload
  const apiPayload = {
    customerId: returnData.customerId,
    productId: returnData.productId,
    quantity: Number(returnData.quantity || 1),
    invoiceId: returnData.invoiceId || undefined,
    challanId: returnData.challanId || undefined,
    returnReason: returnData.returnReason || 'Defective / Excess material return',
    remarks: returnData.remarks || '',
    returnDate: returnData.returnDate || returnData.date || new Date().toISOString()
  };

  try {
    const res = await api.post('/returns/sales-return', apiPayload);
    const saved = normalizeReturn(res.data?.data || res.data);
    return saved;
  } catch (err) {
    const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
    if (backendMsg) {
      throw new Error(backendMsg);
    }
    throw err;
  }
};

export const confirmReturn = async (id) => {
  try {
    const res = await api.put(`/returns/${id}/confirm`);
    const saved = normalizeReturn(res.data?.data || res.data);
    const list = loadLocalReturns();
    const idx = list.findIndex(r => r.id === id || r._id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], status: 'CONFIRMED', returnStatus: 'CONFIRMED' };
      saveLocalReturns(list);
    }
    return saved || { id, status: 'CONFIRMED', returnStatus: 'CONFIRMED' };
  } catch (err) {
    console.warn(`Live PUT /returns/${id}/confirm notice:`, err.message);
    const list = loadLocalReturns();
    const item = list.find(r => r.id === id || r._id === id);
    if (item) {
      item.status = 'CONFIRMED';
      item.returnStatus = 'CONFIRMED';
      saveLocalReturns(list);
      return item;
    }
    throw err;
  }
};

export const cancelReturn = async (id, cancellationReason = '') => {
  try {
    const res = await api.put(`/returns/${id}/cancel`, { cancellationReason });
    const saved = normalizeReturn(res.data?.data || res.data);
    const list = loadLocalReturns();
    const idx = list.findIndex(r => r.id === id || r._id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], status: 'CANCELLED', returnStatus: 'CANCELLED', cancellationReason };
      saveLocalReturns(list);
    }
    return saved || { id, status: 'CANCELLED', returnStatus: 'CANCELLED' };
  } catch (err) {
    console.warn(`Live PUT /returns/${id}/cancel notice:`, err.message);
    const list = loadLocalReturns();
    const item = list.find(r => r.id === id || r._id === id);
    if (item) {
      item.status = 'CANCELLED';
      item.returnStatus = 'CANCELLED';
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


