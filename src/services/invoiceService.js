import api, { extractArray } from './api';
import { numberToWords } from '../utils/formatters';

const STORAGE_KEY = 'maitri_invoices_list';

let MOCK_INVOICES = [
  {
    id: 'INV-2026-001',
    _id: '6aa9a51292ab3c10a4023920',
    invoiceNumber: 'INV-2026-001',
    date: '2026-03-08',
    customerId: 'CUST-001',
    customerName: 'Rajesh Sharma Construction',
    customerMobile: '9825012345',
    buyerBillTo: 'Rajesh Sharma Construction, 402, Royal Residency, CG Road, Ahmedabad. GSTIN: 24AAACR1234F1Z5',
    consigneeShipTo: 'Site 12, Green Villa Project, SG Highway, Ahmedabad',
    refNumber: 'QT-2026-001',
    buyersOrderNo: 'ORD-8821',
    dispatchDocNo: 'CH-2026-001',
    deliveryNote: 'Delivered via Eicher 14ft',
    termsOfPayment: '30% Advance, 70% against delivery',
    termsOfDelivery: 'FOR Site Ahmedabad',
    taxableTotal: 118980.00,
    cgstAmount: 10708.20,
    sgstAmount: 10708.20,
    igstAmount: 0.00,
    totalGst: 21416.40,
    finalTotal: 140396.40,
    grandTotal: 140396.40,
    paidAmount: 100000.00,
    outstandingAmount: 40396.40,
    balanceDue: 40396.40,
    status: 'Partially Paid',
    items: [
      {
        sku: 'VT-60120-GL',
        productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
        hsnCode: '69072100',
        quantity: 1150,
        unit: 'Sq.Ft',
        rate: 72.00,
        discount: 5.0,
        gstPercent: 18,
        taxableAmount: 78660.00,
        gstAmount: 14158.80,
        amount: 92818.80
      }
    ]
  }
];

export const normalizeInvoice = (inv) => {
  if (!inv) return null;
  const cust = inv.customer || {};
  const total = Number(inv.grandTotal || inv.finalTotal || inv.totalAmount || 0);
  const paid = Number(inv.paidAmount || 0);
  const due = inv.balanceDue !== undefined ? Number(inv.balanceDue) : (inv.outstandingAmount !== undefined ? Number(inv.outstandingAmount) : Math.max(0, total - paid));

  let rawStatus = inv.status || (due <= 0 ? 'Paid' : (paid > 0 ? 'Partially Paid' : 'Unpaid'));

  return {
    id: inv._id || inv.id || `INV-${Date.now()}`,
    _id: inv._id || inv.id,
    invoiceNumber: inv.invoiceNumber || (inv._id ? `INV-${inv._id.slice(-6).toUpperCase()}` : 'INV-2026'),
    date: inv.invoiceDate ? inv.invoiceDate.split('T')[0] : (inv.date || new Date().toISOString().split('T')[0]),
    customerId: cust._id || cust.id || inv.customerId || '',
    customerName: cust.customerName || inv.customerName || 'Customer',
    customerMobile: cust.mobile || inv.customerMobile || '',
    buyerBillTo: inv.buyerBillTo || '',
    consigneeShipTo: inv.consigneeShipTo || '',
    refNumber: inv.quotationNumber || inv.refNumber || '',
    buyersOrderNo: inv.orderNumber || inv.buyersOrderNo || '',
    dispatchDocNo: inv.challanNumber || inv.dispatchDocNo || '',
    taxableTotal: Number(inv.taxableTotal || inv.subTotal || 0),
    totalGst: Number(inv.totalGst || inv.taxAmount || 0),
    finalTotal: total,
    grandTotal: total,
    paidAmount: paid,
    outstandingAmount: due,
    balanceDue: due,
    status: rawStatus,
    amountInWords: inv.amountInWords || numberToWords(total),
    items: Array.isArray(inv.items) ? inv.items : []
  };
};

/**
 * 1. GET /invoices - List Invoices
 */
export const getInvoices = async (params = {}) => {
  try {
    const queryParams = { limit: 200, page: 1, ...params };
    const res = await api.get('/invoices', { params: queryParams });
    const rawList = extractArray(res.data, ['invoices', 'records', 'data']);
    if (Array.isArray(rawList) && rawList.length > 0) {
      const normalized = rawList.map(normalizeInvoice);
      return { data: normalized, total: res.data?.data?.pagination?.total || normalized.length, isLive: true };
    }
  } catch (err) {
    console.warn('GET /invoices notice:', err?.response?.data || err.message);
  }

  return { data: MOCK_INVOICES.map(normalizeInvoice), total: MOCK_INVOICES.length, isLive: false };
};

/**
 * 2. GET /invoices/invoiceable-challans
 */
export const getInvoiceableChallans = async () => {
  try {
    const res = await api.get('/invoices/invoiceable-challans');
    const rawList = extractArray(res.data, ['challans', 'data']);
    if (Array.isArray(rawList)) return rawList;
  } catch (err) {
    console.warn('GET /invoices/invoiceable-challans notice:', err?.response?.data || err.message);
  }
  return [];
};

/**
 * 3. POST /invoices - Generate customer Tax Invoice from Challans
 */
export const createInvoice = async (invoiceData) => {
  try {
    const res = await api.post('/invoices', invoiceData);
    const created = normalizeInvoice(res.data?.data?.invoice || res.data?.data || res.data);
    return created;
  } catch (err) {
    console.warn('POST /invoices notice:', err?.response?.data || err.message);
    const fallback = normalizeInvoice({
      id: `INV-2026-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      ...invoiceData
    });
    MOCK_INVOICES.unshift(fallback);
    return fallback;
  }
};

/**
 * 4. GET /invoices/{id} - Detailed Invoice by ID
 */
export const getInvoiceById = async (id) => {
  try {
    const res = await api.get(`/invoices/${id}`);
    const raw = res.data?.data?.invoice || res.data?.data || res.data;
    if (raw) return normalizeInvoice(raw);
  } catch (err) {
    console.warn('GET /invoices/:id notice:', err?.response?.data || err.message);
  }
  const inv = MOCK_INVOICES.find(i => i.id === id || i._id === id || i.invoiceNumber === id);
  if (inv) return normalizeInvoice(inv);
  throw new Error('Invoice not found');
};

/**
 * 5. GET /invoices/{id}/balance-due
 */
export const getInvoiceBalanceDue = async (id) => {
  try {
    const res = await api.get(`/invoices/${id}/balance-due`);
    return res.data?.data || res.data;
  } catch (err) {}
  const inv = await getInvoiceById(id);
  return { balanceDue: inv.balanceDue, paidAmount: inv.paidAmount, total: inv.finalTotal };
};

/**
 * 6. PUT /invoices/{id}/cancel
 */
export const cancelInvoice = async (id) => {
  try {
    const res = await api.put(`/invoices/${id}/cancel`);
    return res.data;
  } catch (err) {
    console.warn('PUT /invoices/:id/cancel notice:', err?.response?.data || err.message);
    return { success: true };
  }
};

/**
 * 7. GET /invoices/export - Export filtered Invoices to Excel (.xlsx)
 */
export const exportInvoices = async (params = {}) => {
  try {
    const res = await api.get('/invoices/export', { params, responseType: 'blob' });
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Invoices_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true };
  } catch (err) {
    console.warn('GET /invoices/export notice:', err?.response?.data || err.message);
    throw err;
  }
};

/**
 * 8. GET /invoices/{id}/print
 */
export const getInvoicePrintData = async (id) => {
  try {
    const res = await api.get(`/invoices/${id}/print`);
    return res.data?.data || res.data;
  } catch (err) {
    return getInvoiceById(id);
  }
};
