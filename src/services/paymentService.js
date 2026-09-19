import api, { extractArray } from './api';
import { numberToWords } from '../utils/formatters';

const STORAGE_KEY = 'maitri_payments_list';

let MOCK_PAYMENTS = [
  {
    id: 'RCT-2026-001',
    _id: '6aa9a89092ab3c10a4023930',
    receiptNumber: 'RCT-2026-001',
    date: '2026-03-08',
    customerId: 'CUST-001',
    customerName: 'Rajesh Sharma Construction',
    invoiceNumber: 'INV-2026-001',
    paymentMode: 'Bank Transfer',
    amount: 100000.00,
    referenceNumber: 'HDFC-NEFT-99201',
    bankAccount: 'HDFC Bank - Current A/C 50200012345678',
    remarks: 'Advance partial payment for site tiles',
    status: 'ACTIVE',
    amountInWords: numberToWords(100000.00),
    authorizedSignatory: 'For Maitri Ceramic'
  }
];

const extractSafeString = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.modeName === 'string') return val.modeName;
    if (typeof val.modeName === 'object' && val.modeName !== null) return extractSafeString(val.modeName, fallback);
    if (typeof val.name === 'string') return val.name;
    if (typeof val.customerName === 'string') return val.customerName;
    if (typeof val.accountName === 'string') return val.accountName;
    if (typeof val.bankName === 'string') return val.bankName;
    if (typeof val.mode === 'string') return val.mode;
    if (typeof val.invoiceNumber === 'string') return val.invoiceNumber;
    if (typeof val.invoiceNo === 'string') return val.invoiceNo;
    if (typeof val.receiptNumber === 'string') return val.receiptNumber;
    if (typeof val.referenceNumber === 'string') return val.referenceNumber;
    return fallback;
  }
  return String(val);
};

export const normalizePayment = (p) => {
  if (!p) return null;
  const cust = p.customer || {};
  const amt = Number(p.totalAmount !== undefined ? p.totalAmount : (p.amountReceived !== undefined ? p.amountReceived : (p.amount || 0)));

  const paymentMode = extractSafeString(p.paymentMode, 'Bank Transfer');
  const bankAccount = extractSafeString(p.bankCashAccount || p.bankAccount || p.depositedAccount, 'Current Account');
  const customerName = cust.customerName || cust.name || extractSafeString(p.customerName) || 'Customer';
  
  const firstAlloc = (Array.isArray(p.allocations) && p.allocations[0]) ? p.allocations[0] : null;
  const invSnap = firstAlloc?.invoiceNumberSnapshot || firstAlloc?.invoice?.invoiceNumber || firstAlloc?.invoiceNumber;
  const invoiceNumber = invSnap || extractSafeString(p.invoiceNumber || p.invoice, '-');

  const receiptNumber = extractSafeString(p.receiptNumber || p.paymentNumber || (p._id ? `RCT-${p._id.slice(-6).toUpperCase()}` : 'RCT-2026'), 'RCT-2026');
  const referenceNumber = extractSafeString(p.referenceNumber || p.transactionReference, '-');

  return {
    id: String(p._id || p.id || `RCT-${Date.now()}`),
    _id: String(p._id || p.id || ''),
    receiptNumber,
    date: p.paymentDate ? String(p.paymentDate).split('T')[0] : (p.date ? String(p.date).split('T')[0] : new Date().toISOString().split('T')[0]),
    customerId: String(cust._id || cust.id || p.customerId || ''),
    customerName,
    invoiceNumber,
    paymentMode,
    amount: amt,
    referenceNumber,
    bankAccount,
    remarks: typeof p.remarks === 'string' ? p.remarks : (typeof p.notes === 'string' ? p.notes : ''),
    status: typeof p.status === 'string' ? p.status : (p.isReversed ? 'REVERSED' : 'ACTIVE'),
    amountInWords: p.amountInWords || numberToWords(amt),
    allocations: Array.isArray(p.allocations) ? p.allocations : []
  };
};

/**
 * 1. GET /payments - List Payments
 */
export const getPayments = async (params = {}) => {
  try {
    const queryParams = { limit: 200, page: 1, ...params };
    const res = await api.get('/payments', { params: queryParams });
    const rawList = extractArray(res.data, ['payments', 'records', 'data']);
    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizePayment);
      return { data: normalized, total: res.data?.data?.pagination?.total || normalized.length, isLive: true };
    }
  } catch (err) {
    console.warn('GET /payments notice:', err?.response?.data || err.message);
  }

  return { data: [], total: 0, isLive: false };
};

/**
 * 2. GET /payments/{id} - Get single payment
 */
export const getPaymentById = async (id) => {
  const res = await api.get(`/payments/${id}`);
  const raw = res.data?.data?.payment || res.data?.data || res.data;
  if (raw) return normalizePayment(raw);
  throw new Error('Receipt not found');
};

export const createPayment = async (paymentData) => {
  const totalAmount = Number(paymentData.totalAmount || paymentData.amount || paymentData.amountReceived || 0);

  // Map paymentModeId if string passed
  let modeId = paymentData.paymentModeId;
  if (!modeId && paymentData.paymentMode) {
    const s = String(paymentData.paymentMode).toLowerCase();
    if (s.includes('cash')) modeId = '6aa7c9eb612a410d893bcbbf';
    else if (s.includes('upi')) modeId = '6aa7c9ec612a410d893bcbc1';
    else if (s.includes('cheque')) modeId = '6aa7c9ec612a410d893bcbc2';
    else if (s.includes('card')) modeId = '6aa7c9ec612a410d893bcbc3';
    else modeId = '6aa7c9ec612a410d893bcbc0';
  }
  if (!modeId) modeId = '6aa7c9ec612a410d893bcbc0'; // default Bank Transfer

  // Format allocations
  let allocations = [];
  if (Array.isArray(paymentData.allocations) && paymentData.allocations.length > 0) {
    allocations = paymentData.allocations
      .map(a => ({
        invoiceId: a.invoiceId || a.invoice?._id || a.id || a._id,
        allocatedAmount: Number(a.allocatedAmount || a.amount || 0)
      }))
      .filter(a => a.invoiceId && a.allocatedAmount > 0);
  } else if (paymentData.invoiceId) {
    allocations = [{
      invoiceId: paymentData.invoiceId,
      allocatedAmount: totalAmount
    }];
  }

  // Format paymentDate YYYY-MM-DD
  let dateStr = new Date().toISOString().split('T')[0];
  if (paymentData.paymentDate) {
    dateStr = paymentData.paymentDate.split('T')[0];
  } else if (paymentData.date) {
    dateStr = paymentData.date.split('T')[0];
  }

  const payload = {
    customerId: paymentData.customerId,
    paymentModeId: modeId,
    totalAmount: totalAmount,
    paymentDate: dateStr,
    referenceNumber: paymentData.referenceNumber || '',
    bankCashAccount: paymentData.bankCashAccount || paymentData.bankAccount || '',
    remarks: paymentData.remarks || paymentData.notes || '',
    allocations: allocations
  };

  try {
    const res = await api.post('/payments', payload);
    const created = normalizePayment(res.data?.data?.payment || res.data?.data || res.data);
    return created;
  } catch (err) {
    const backendMsg = err?.response?.data?.message || err?.response?.data?.error;
    if (backendMsg) {
      throw new Error(backendMsg);
    }
    throw err;
  }
};

/**
 * 4. GET /payments/customer/{customerId}/outstanding
 */
export const getCustomerOutstanding = async (customerId) => {
  try {
    const res = await api.get(`/payments/customer/${customerId}/outstanding`);
    return res.data?.data || res.data;
  } catch (err) {}
  return { totalOutstanding: 0, pendingInvoicesCount: 0 };
};

/**
 * 5. GET /payments/invoice/{id}/balance-due
 */
export const getInvoicePaymentBalanceDue = async (invoiceId) => {
  try {
    const res = await api.get(`/payments/invoice/${invoiceId}/balance-due`);
    return res.data?.data || res.data;
  } catch (err) {}
  return { balanceDue: 0, paidAmount: 0 };
};

/**
 * 6. POST /payments/{id}/reverse - Reverse payment
 */
export const reversePayment = async (id, reason = 'Entry corrected') => {
  try {
    const res = await api.post(`/payments/${id}/reverse`, { reason });
    return res.data;
  } catch (err) {
    console.warn('POST /payments/:id/reverse notice:', err?.response?.data || err.message);
    return { success: true };
  }
};

/**
 * 7. GET /payments/export - Export Payments to Excel (.xlsx)
 */
export const exportPayments = async (params = {}) => {
  try {
    const res = await api.get('/payments/export', { params, responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Payments_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true };
  } catch (err) {
    console.warn('GET /payments/export notice:', err?.response?.data || err.message);
    throw err;
  }
};

/**
 * 8. GET /payments/{id}/receipt - Receipt printable dataset
 */
export const getPaymentReceiptPrintData = async (id) => {
  try {
    const res = await api.get(`/payments/${id}/receipt`);
    return res.data?.data || res.data;
  } catch (err) {
    return getPaymentById(id);
  }
};
