import api, { extractArray } from './api';
import * as XLSX from 'xlsx';

/**
 * Normalizes a Challan document from the backend API into a consistent shape
 * used across the frontend UI.
 */
export const normalizeChallan = (c) => {
  if (!c) return null;
  const cust = c.customer || {};
  const statusStr = (c.status || (c.isFinalized ? 'FINALIZED' : 'DRAFT')).toUpperCase();
  const salespersonName = typeof c.salesperson === 'object' ? (c.salesperson?.name || 'Lax Savani') : (c.salesperson || 'Vikram Mehta');
  const quotNo = c.quotation?.quotationNumber || c.quotationNumber || c.refQuotationNo || (typeof c.quotation === 'string' ? c.quotation : '—');
  const confId = c.confirmation?._id || c.confirmation || c.confirmationId || '';

  return {
    id: c._id || c.id || `CH-${Date.now()}`,
    _id: c._id || c.id,
    challanNumber: c.challanNumber || (c._id ? `CH-${c._id.slice(-6).toUpperCase()}` : 'CH-2026'),
    date: c.challanDate ? c.challanDate.split('T')[0] : (c.date ? c.date.split('T')[0] : new Date().toISOString().split('T')[0]),
    challanDate: c.challanDate || c.date || new Date().toISOString(),
    customerId: cust._id || cust.id || c.customerId || '',
    customerName: cust.customerName || c.customerName || 'Customer',
    customerContact: c.customerContact || cust.mobile || cust.contactNumber || '',
    customerAddress: c.customerAddress || cust.shippingAddress || cust.billingAddress || cust.siteAddress || cust.address || '',
    customerCity: cust.city || '',
    customerType: cust.customerType || '',
    customerGst: cust.gstNumber || 'N/A',
    refQuotationNo: quotNo,
    quotationId: c.quotation?._id || c.quotation || '',
    confirmationId: confId,
    salesperson: salespersonName,
    salespersonMobile: c.salesperson?.mobile || '',
    salespersonEmail: c.salesperson?.email || '',
    driverName: c.driverName || '',
    vehicleNo: c.vehicleNumber || c.vehicleNo || '',
    deliveryDetails: c.deliveryDetails || '',
    status: statusStr,
    isFinalized: statusStr === 'FINALIZED' || statusStr === 'DELIVERED',
    invoiced: Boolean(c.invoiced),
    finalizedAt: c.finalizedAt || null,
    finalizedBy: typeof c.finalizedBy === 'object' ? c.finalizedBy?.name : (c.finalizedBy || null),
    items: Array.isArray(c.items) ? c.items.map(i => {
      const prod = i.product || {};
      const unitVal = i.unit?.unitName || i.unit?.unitCode || prod.unit?.unitName || prod.unit?.unitCode || (typeof i.unit === 'string' && i.unit.length <= 12 ? i.unit : 'Boxes');
      return {
        confirmedItemId: i.confirmedItem || i.confirmedItemId || i._id || i.id,
        productId: prod._id || prod.id || i.product || i.productId,
        sku: i.skuCodeSnapshot || prod.companySkuCode || prod.sku || i.sku || 'SKU',
        productName: i.productNameSnapshot || prod.productName || i.productName || 'Product',
        description: i.description || (prod.hsnCode ? `HSN: ${prod.hsnCode}` : ''),
        quantity: Number(i.quantityToIssue != null ? i.quantityToIssue : (i.dispatchQuantity != null ? i.dispatchQuantity : (i.quantity || 0))),
        unit: unitVal || 'Pcs',
        remarks: i.remarks || '',
        stock: prod.currentStock != null ? prod.currentStock : null,
        mrp: prod.mrp || i.unitPriceSnapshot || 0
      };
    }) : [],
    remarks: c.remarks || '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt
  };
};

/**
 * 1. GET /challans - List Challans with filters, pagination and dataScope
 * Query params: customerId, confirmationId, quotationId, status (DRAFT|FINALIZED|CANCELLED), search, from, to, page, limit
 */
export const getChallans = async (params = {}) => {
  try {
    const queryParams = { limit: 100, page: 1, ...params };
    if (queryParams.status === 'ALL') delete queryParams.status;
    if (!queryParams.search) delete queryParams.search;

    const res = await api.get('/challans', { params: queryParams });
    const rawList = res.data?.data?.challans || extractArray(res.data, ['challans', 'records', 'items', 'data']);
    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizeChallan);
      return {
        data: normalized,
        total: res.data?.data?.pagination?.total || res.data?.total || normalized.length,
        pagination: res.data?.data?.pagination || null,
        isLive: true
      };
    }
  } catch (err) {
    console.error('GET /challans notice:', err?.response?.data || err.message);
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
  const payload = {
    confirmationId: challanData.confirmationId,
    deliveryDetails: challanData.deliveryDetails || '',
    remarks: challanData.remarks || '',
    items: (challanData.items || []).map(i => ({
      confirmedItemId: i.confirmedItemId || i.confirmedItem || i.id || i._id,
      quantityToIssue: Number(i.quantityToIssue || i.quantity || 0),
      remarks: i.remarks || ''
    }))
  };

  const res = await api.post('/challans', payload);
  const created = res.data?.data?.challan || res.data?.data || res.data;
  return normalizeChallan(created);
};

/**
 * 4. PUT /challans/{id} - Update DRAFT Challan (Allowed ONLY while status is DRAFT)
 * Body: { deliveryDetails, remarks, items: [{ confirmedItemId, quantityToIssue, remarks }] }
 */
export const updateChallan = async (id, updateData) => {
  const payload = {
    deliveryDetails: updateData.deliveryDetails,
    remarks: updateData.remarks,
    ...(updateData.items ? {
      items: updateData.items.map(i => ({
        confirmedItemId: i.confirmedItemId || i.confirmedItem || i.id || i._id,
        quantityToIssue: Number(i.quantityToIssue || i.quantity || 0),
        remarks: i.remarks || ''
      }))
    } : {})
  };

  const res = await api.put(`/challans/${id}`, payload);
  const updated = res.data?.data?.challan || res.data?.data || res.data;
  return normalizeChallan(updated);
};

/**
 * 5. PUT /challans/{id}/finalize - Finalize Challan (ATOMIC DUAL-WRITE: stock deduction + delivery recording)
 */
export const finalizeChallan = async (id) => {
  const res = await api.put(`/challans/${id}/finalize`);
  return res.data;
};

/**
 * 6. PUT /challans/{id}/cancel - Cancel DRAFT Challan (Allowed ONLY while status is DRAFT)
 */
export const cancelChallan = async (id) => {
  const res = await api.put(`/challans/${id}/cancel`);
  return res.data;
};

/**
 * 7. GET /challans/{id}/print - Get formatted delivery note print data
 */
export const getChallanPrintData = async (id) => {
  try {
    const res = await api.get(`/challans/${id}/print`);
    const printData = res.data?.data || res.data;
    if (printData) {
      const cust = printData.customer || {};
      return {
        ...printData,
        id,
        _id: id,
        challanNumber: printData.challanNumber,
        challanDate: printData.challanDate,
        date: printData.challanDate ? printData.challanDate.split('T')[0] : '',
        status: printData.status || 'DRAFT',
        customerName: cust.name || cust.customerName || 'Customer',
        customerContact: cust.contact || cust.mobile || '',
        customerAddress: cust.address || cust.shippingAddress || '',
        customerGst: cust.gstNumber || 'N/A',
        refQuotationNo: printData.quotationNumber || 'N/A',
        refConfirmationNo: printData.confirmationNumber || 'N/A',
        salesperson: printData.salesperson || 'Sales Rep',
        deliveryDetails: printData.deliveryDetails || '',
        remarks: printData.remarks || '',
        finalizedAt: printData.finalizedAt || null,
        finalizedBy: printData.finalizedBy || null,
        items: Array.isArray(printData.items) ? printData.items.map(i => ({
          sku: i.skuCodeSnapshot || i.sku || 'SKU',
          productName: i.productNameSnapshot || i.productName || 'Product',
          description: i.description || '',
          quantity: Number(i.quantityToIssue != null ? i.quantityToIssue : (i.quantity || 0)),
          unit: i.unit?.unitName || (typeof i.unit === 'string' && i.unit.length <= 10 ? i.unit : 'Boxes') || 'Pcs',
          remarks: i.remarks || ''
        })) : []
      };
    }
  } catch (err) {
    console.warn(`GET /challans/${id}/print notice:`, err?.response?.data || err.message);
  }
  return getChallanById(id);
};

/**
 * 8. GET /challans/export - Export filtered Challans to Excel (.xlsx)
 * Query params: customerId, status
 */
export const exportChallans = async (params = {}) => {
  try {
    const cleanParams = {};
    if (params.customerId) cleanParams.customerId = params.customerId;
    if (params.status && params.status !== 'ALL') cleanParams.status = params.status;

    const res = await api.get('/challans/export', { params: cleanParams, responseType: 'blob' });
    if (res.data && res.data.size > 0) {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `Delivery_Challans_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      return { success: true };
    }
  } catch (err) {
    console.warn('Backend GET /challans/export notice, falling back to client-side XLSX:', err?.message);
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
    XLSX.writeFile(wb, `Delivery_Challans_${new Date().toISOString().split('T')[0]}.xlsx`);
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
