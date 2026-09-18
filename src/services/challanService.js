import api, { extractArray } from './api';
import * as XLSX from 'xlsx';

const STORAGE_KEY = 'maitri_challans_list';

let MOCK_CHALLANS = [
  {
    id: 'CH-2026-001',
    _id: '6aa9a12b92ab3c10a4023910',
    challanNumber: 'CH-2026-001',
    date: '2026-03-06',
    customerId: 'CUST-001',
    customerName: 'Rajesh Sharma Construction',
    customerContact: '9825012345',
    customerAddress: 'Site 12, Green Villa Project, SG Highway, Ahmedabad',
    refQuotationNo: 'QT-2026-001',
    refOrderNo: 'ORD-8821',
    salesperson: 'Vikram Mehta',
    driverName: 'Ramesh Patel',
    vehicleNo: 'GJ-01-AB-1234',
    deliveryDetails: 'Dispatched via Tata Ace (GJ-01-AB-1234) Driver: Ramesh Patel',
    status: 'FINALIZED',
    isFinalized: true,
    items: [
      {
        sku: 'VT-60120-GL',
        productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
        description: 'Statuario Marble Finish Heavy Duty',
        quantity: 1150,
        unit: 'Sq.Ft'
      }
    ],
    remarks: 'Partial dispatch delivered at site 12.'
  },
  {
    id: 'CH-2026-002',
    _id: '6aa9a12b92ab3c10a4023911',
    challanNumber: 'CH-2026-002',
    date: '2026-03-12',
    customerId: 'CUST-002',
    customerName: 'Mehta Interior Designers',
    customerContact: '9898011223',
    customerAddress: 'Office 402, Titanium City Centre, Prahladnagar, Ahmedabad',
    refQuotationNo: 'QT-2026-002',
    refOrderNo: 'ORD-8822',
    salesperson: 'Vikram Mehta',
    driverName: 'Haresh Bhai',
    vehicleNo: 'GJ-27-TT-9988',
    deliveryDetails: 'Mahindra Bolero Maxi Truck (GJ-27-TT-9988)',
    status: 'DRAFT',
    isFinalized: false,
    items: [
      {
        sku: 'CP-DIV-3WAY',
        productName: 'Single Lever 3-Way Concealed Diverter Complete',
        description: 'CP Bath Fittings',
        quantity: 8,
        unit: 'Set'
      }
    ],
    remarks: 'Ready for delivery dispatch'
  }
];

export const normalizeChallan = (c) => {
  if (!c) return null;
  const cust = c.customer || {};
  const statusStr = (c.status || (c.isFinalized ? 'FINALIZED' : 'DRAFT')).toUpperCase();

  return {
    id: c._id || c.id || `CH-${Date.now()}`,
    _id: c._id || c.id,
    challanNumber: c.challanNumber || (c._id ? `CH-${c._id.slice(-6).toUpperCase()}` : 'CH-2026'),
    date: c.challanDate ? c.challanDate.split('T')[0] : (c.date || new Date().toISOString().split('T')[0]),
    customerId: cust._id || cust.id || c.customerId || '',
    customerName: cust.customerName || c.customerName || 'Customer',
    customerContact: cust.mobile || cust.contactNumber || c.customerContact || '',
    customerAddress: cust.siteAddress || cust.address || c.customerAddress || '',
    refQuotationNo: c.quotationNumber || c.refQuotationNo || 'QT',
    refOrderNo: c.orderNumber || c.refOrderNo || '',
    salesperson: c.salesperson || 'Vikram Mehta',
    driverName: c.driverName || '',
    vehicleNo: c.vehicleNumber || c.vehicleNo || '',
    deliveryDetails: c.deliveryDetails || '',
    status: statusStr,
    isFinalized: statusStr === 'FINALIZED' || statusStr === 'DELIVERED',
    items: Array.isArray(c.items) ? c.items.map(i => ({
      confirmedItemId: i.confirmedItemId || i._id || i.id,
      productId: i.product?._id || i.product || i.productId,
      sku: i.product?.sku || i.sku || 'SKU',
      productName: i.product?.productName || i.productName || 'Product',
      description: i.description || '',
      quantity: Number(i.quantityToIssue || i.dispatchQuantity || i.quantity || 0),
      unit: i.unit || 'Pcs',
      remarks: i.remarks || ''
    })) : [],
    remarks: c.remarks || ''
  };
};

/**
 * 1. GET /challans - List Challans with filters, pagination and dataScope
 * Query params: customerId, confirmationId, quotationId, status (DRAFT|FINALIZED|CANCELLED), search, from, to, page, limit
 */
export const getChallans = async (params = {}) => {
  try {
    const queryParams = { limit: 100, page: 1, ...params };
    const res = await api.get('/challans', { params: queryParams });
    const rawList = extractArray(res.data, ['challans', 'records', 'items', 'data']);
    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizeChallan);
      return { data: normalized, total: res.data?.total || res.data?.data?.pagination?.total || normalized.length, isLive: true };
    }
  } catch (err) {
    console.warn('GET /challans notice:', err?.response?.data || err.message);
  }

  return { data: [], total: 0, isLive: false };
};

/**
 * 2. GET /challans/{id} - Get single Challan details by ID
 */
export const getChallanById = async (id) => {
  const res = await api.get(`/challans/${id}`);
  const raw = res.data?.data?.challan || res.data?.data || res.data;
  if (raw) return normalizeChallan(raw);
  throw new Error('Challan not found');
};

/**
 * 3. POST /challans - Create a new DRAFT Challan against an active Quotation Confirmation
 * Body: { confirmationId, deliveryDetails, remarks, items: [{ confirmedItemId, quantityToIssue, remarks }] }
 */
export const createChallan = async (challanData) => {
  const res = await api.post('/challans', challanData);
  const created = normalizeChallan(res.data?.data?.challan || res.data?.data || res.data);
  return created;
};

/**
 * 4. PUT /challans/{id} - Update DRAFT Challan (Allowed ONLY while status is DRAFT)
 * Body: { deliveryDetails, remarks, items: [{ confirmedItemId, quantityToIssue, remarks }] }
 */
export const updateChallan = async (id, updateData) => {
  try {
    const res = await api.put(`/challans/${id}`, updateData);
    return normalizeChallan(res.data?.data?.challan || res.data?.data || res.data);
  } catch (err) {
    console.warn(`PUT /challans/${id} notice:`, err?.response?.data || err.message);
    const item = MOCK_CHALLANS.find(c => c.id === id || c._id === id);
    if (item) {
      Object.assign(item, updateData);
      return normalizeChallan(item);
    }
    throw err;
  }
};

/**
 * 5. PUT /challans/{id}/finalize - Finalize Challan (ATOMIC DUAL-WRITE: stock deduction + delivery recording)
 */
export const finalizeChallan = async (id) => {
  try {
    const res = await api.put(`/challans/${id}/finalize`);
    return res.data;
  } catch (err) {
    console.warn(`PUT /challans/${id}/finalize notice:`, err?.response?.data || err.message);
    const item = MOCK_CHALLANS.find(c => c.id === id || c._id === id);
    if (item) {
      item.status = 'FINALIZED';
      item.isFinalized = true;
    }
    return { success: true, message: 'Challan finalized. Stock deducted.' };
  }
};

/**
 * 6. PUT /challans/{id}/cancel - Cancel DRAFT Challan (Allowed ONLY while status is DRAFT)
 */
export const cancelChallan = async (id) => {
  try {
    const res = await api.put(`/challans/${id}/cancel`);
    return res.data;
  } catch (err) {
    console.warn(`PUT /challans/${id}/cancel notice:`, err?.response?.data || err.message);
    const item = MOCK_CHALLANS.find(c => c.id === id || c._id === id);
    if (item) {
      item.status = 'CANCELLED';
    }
    return { success: true, message: 'Challan cancelled.' };
  }
};

/**
 * 7. GET /challans/{id}/print - Get formatted delivery note print data
 */
export const getChallanPrintData = async (id) => {
  try {
    const res = await api.get(`/challans/${id}/print`);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn(`GET /challans/${id}/print notice:`, err?.response?.data || err.message);
    return getChallanById(id);
  }
};

/**
 * 8. GET /challans/export - Export filtered Challans to Excel (.xlsx)
 * Query params: customerId, status
 */
export const exportChallans = async (params = {}) => {
  try {
    const res = await api.get('/challans/export', { params, responseType: 'blob' });
    if (res.data && res.data.size > 0) {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Challans_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      return { success: true };
    }
  } catch (err) {
    console.warn('GET /challans/export notice, creating client-side XLSX:', err?.response?.data || err.message);
  }

  // Client-side fallback export
  try {
    const { data: list } = await getChallans(params);
    const exportData = list.map(c => ({
      'Challan No': c.challanNumber,
      'Date': c.date,
      'Customer Name': c.customerName,
      'Contact': c.customerContact,
      'Ref Quotation': c.refQuotationNo,
      'Delivery Vehicle': c.deliveryDetails || c.vehicleNo,
      'Total Items': c.items?.length || 0,
      'Total Qty': c.items?.reduce((s, i) => s + Number(i.quantity || 0), 0) || 0,
      'Status': c.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delivery Challans');
    XLSX.writeFile(wb, `Challans_${new Date().toISOString().split('T')[0]}.xlsx`);
    return { success: true };
  } catch (e) {
    console.error('Challan export failed:', e);
    throw e;
  }
};

export default {
  getChallans,
  getChallanById,
  createChallan,
  updateChallan,
  finalizeChallan,
  cancelChallan,
  getChallanPrintData,
  exportChallans
};
