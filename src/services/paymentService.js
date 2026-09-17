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

export const normalizePayment = (p) => {
  if (!p) return null;
  const cust = p.customer || {};
  const amt = Number(p.amountReceived || p.amount || 0);

  return {
    id: p._id || p.id || `RCT-${Date.now()}`,
    _id: p._id || p.id,
    receiptNumber: p.receiptNumber || p.paymentNumber || (p._id ? `RCT-${p._id.slice(-6).toUpperCase()}` : 'RCT-2026'),
    date: p.paymentDate ? p.paymentDate.split('T')[0] : (p.date || new Date().toISOString().split('T')[0]),
    customerId: cust._id || cust.id || p.customerId || '',
    customerName: cust.customerName || p.customerName || 'Customer',
    invoiceNumber: p.invoiceNumber || (p.allocations && p.allocations[0]?.invoiceNumber) || '-',
    paymentMode: p.paymentMode || 'Bank Transfer',
    amount: amt,
    referenceNumber: p.referenceNumber || p.transactionReference || '-',
    bankAccount: p.bankAccount || p.depositedAccount || 'Current Account',
    remarks: p.remarks || p.notes || '',
    status: p.status || (p.isReversed ? 'REVERSED' : 'ACTIVE'),
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
    if (Array.isArray(rawList) && rawList.length > 0) {
      const normalized = rawList.map(normalizePayment);
      return { data: normalized, total: res.data?.data?.pagination?.total || normalized.length, isLive: true };
    }
  } catch (err) {
    console.warn('GET /payments notice:', err?.response?.data || err.message);
  }

  return { data: MOCK_PAYMENTS.map(normalizePayment), total: MOCK_PAYMENTS.length, isLive: false };
};

/**
 * 2. GET /payments/{id} - Get single payment
 */
export const getPaymentById = async (id) => {
  try {
    const res = await api.get(`/payments/${id}`);
    const raw = res.data?.data?.payment || res.data?.data || res.data;
    if (raw) return normalizePayment(raw);
  } catch (err) {
    console.warn('GET /payments/:id notice:', err?.response?.data || err.message);
  }
  const pmt = MOCK_PAYMENTS.find(p => p.id === id || p._id === id || p.receiptNumber === id);
  if (pmt) return normalizePayment(pmt);
  throw new Error('Receipt not found');
};

/**
 * 3. POST /payments - Record customer payment
 */
export const createPayment = async (paymentData) => {
  const amt = Number(paymentData.amount || paymentData.amountReceived || 0);
  const payload = {
    customerId: paymentData.customerId,
    amountReceived: amt,
    paymentDate: paymentData.date ? new Date(paymentData.date).toISOString() : new Date().toISOString(),
    paymentMode: paymentData.paymentMode || 'BANK_TRANSFER',
    referenceNumber: paymentData.referenceNumber || '',
    depositedAccount: paymentData.bankAccount || '',
    notes: paymentData.remarks || '',
    allocations: paymentData.allocations || []
  };

  try {
    const res = await api.post('/payments', payload);
    const created = normalizePayment(res.data?.data?.payment || res.data?.data || res.data);
    return created;
  } catch (err) {
    console.warn('POST /payments notice:', err?.response?.data || err.message);
    const fallback = normalizePayment({
      id: `RCT-2026-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      amount: amt,
      ...paymentData
    });
    MOCK_PAYMENTS.unshift(fallback);
    return fallback;
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
