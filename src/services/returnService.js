import api, { extractArray } from './api';

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
    console.error('GET /returns error:', err?.response?.data || err.message);
  }

  return { data: [], total: 0, isLive: false };
};

export const getReturnById = async (id) => {
  try {
    const res = await api.get(`/returns/${id}`);
    const raw = res.data?.data || res.data;
    if (raw) return normalizeReturn(raw);
  } catch (err) {
    console.error(`GET /returns/${id} error:`, err.message);
  }
  throw new Error('Return record not found');
};

export const createPurchaseReturn = async (returnData) => {
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
    const backendMsg = err?.response?.data?.message || err?.response?.data?.error || err.message;
    throw new Error(backendMsg);
  }
};

export const createSalesReturn = async (returnData) => {
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
    const backendMsg = err?.response?.data?.message || err?.response?.data?.error || err.message;
    throw new Error(backendMsg);
  }
};

export const confirmReturn = async (id) => {
  try {
    const res = await api.put(`/returns/${id}/confirm`);
    const saved = normalizeReturn(res.data?.data || res.data);
    return saved || { id, status: 'CONFIRMED', returnStatus: 'CONFIRMED' };
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to confirm return.';
    throw new Error(serverMsg);
  }
};

export const cancelReturn = async (id, cancellationReason = '') => {
  try {
    const res = await api.put(`/returns/${id}/cancel`, { cancellationReason });
    const saved = normalizeReturn(res.data?.data || res.data);
    return saved || { id, status: 'CANCELLED', returnStatus: 'CANCELLED' };
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message || 'Failed to cancel return.';
    throw new Error(serverMsg);
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
    console.error('Backend returns export failed:', err.message);
    return null;
  }
};

export const getPurchaseReturns = async (params = {}) => {
  return getReturns({ ...params, returnType: 'PURCHASE_RETURN' });
};

export const getSalesReturns = async (params = {}) => {
  return getReturns({ ...params, returnType: 'SALES_RETURN' });
};
