import api, { extractArray } from './api';

// Helper to normalize live backend Customer object
export const normalizeCustomer = (c) => {
  if (!c) return null;
  const isAct = c.isActive !== undefined ? Boolean(c.isActive) : (c.status !== 'Inactive');
  const custId = c._id || c.id || '';
  return {
    id: custId,
    _id: custId,
    name: c.customerName || c.name || 'Unnamed Customer',
    customerName: c.customerName || c.name || 'Unnamed Customer',
    mobile: c.mobile || '-',
    altMobile: c.alternateNumber || c.altMobile || '',
    email: c.email || '',
    billingAddress: c.billingAddress || '',
    shippingAddress: c.shippingAddress || '',
    city: c.city || 'Ahmedabad',
    state: c.state || 'Gujarat',
    gstNumber: c.gstNumber || '',
    customerType: (c.customerType || 'RETAIL').toUpperCase(),
    notes: c.notes || '',
    totalSales: Number(c.totalSales || c.totalInvoiced || 0),
    totalInvoiced: Number(c.totalInvoiced || c.totalSales || 0),
    totalPaid: Number(c.totalPaid || 0),
    totalOutstanding: Number(c.totalOutstanding || c.outstanding || c.outstandingBalance || 0),
    credit: Number(c.credit || 0),
    debit: Number(c.debit || 0),
    isActive: isAct,
    status: isAct ? 'Active' : 'Inactive',
    createdAt: c.createdAt ? String(c.createdAt).split('T')[0] : new Date().toISOString().split('T')[0]
  };
};

// GET /customers - Get list of customers with search, filters & pagination
export const getCustomers = async (params = {}) => {
  const queryParams = { limit: 1000, page: 1, ...params };
  const res = await api.get('/customers', { params: queryParams });
  const rawList = extractArray(res.data, ['customers', 'customerList', 'records', 'data']);

  if (Array.isArray(rawList)) {
    const normalized = rawList.map(normalizeCustomer).filter(Boolean);
    return {
      data: normalized,
      total: res.data?.data?.pagination?.total || res.data?.total || normalized.length,
      pagination: res.data?.data?.pagination,
      isLive: true
    };
  }

  return { data: [], total: 0, isLive: true };
};

// GET /customers/{id} - Get single customer profile by ID
export const getCustomerById = async (id) => {
  if (!id) throw new Error('Customer ID required');
  const res = await api.get(`/customers/${id}`);
  const raw = res.data?.data?.customer || res.data?.data || res.data;
  if (raw) return normalizeCustomer(raw);
  throw new Error('Customer not found');
};

const mapCustomerType = (type) => {
  if (!type) return 'RETAIL';
  const t = String(type).trim().toUpperCase();
  if (t.includes('BUILDER') || t.includes('DEALER')) return 'DEALER';
  if (t.includes('CONTRACTOR') || t.includes('ARCHITECT') || t.includes('TILING')) return 'CONTRACTOR';
  if (t.includes('PLUMB')) return 'PLUMBER';
  if (t === 'OTHER') return 'OTHER';
  return 'RETAIL';
};

const formatCustomerPayload = (customerData) => {
  const name = (customerData.customerName || customerData.name || '').trim();
  const mobile = String(customerData.mobile || '').trim();
  const altMobile = customerData.alternateNumber || customerData.altMobile;
  const email = customerData.email;
  const billing = customerData.billingAddress;
  const shipping = customerData.shippingAddress;
  const city = customerData.city;
  const state = customerData.state;
  const gst = customerData.gstNumber;
  const notes = customerData.notes;

  return {
    customerName: name,
    mobile: mobile,
    alternateNumber: altMobile && String(altMobile).trim() ? String(altMobile).trim() : null,
    email: email && String(email).trim() ? String(email).trim().toLowerCase() : null,
    billingAddress: billing && String(billing).trim() ? String(billing).trim() : null,
    shippingAddress: shipping && String(shipping).trim() ? String(shipping).trim() : null,
    city: city && String(city).trim() ? String(city).trim() : null,
    state: state && String(state).trim() ? String(state).trim() : null,
    gstNumber: gst && String(gst).trim() ? String(gst).trim().toUpperCase() : null,
    customerType: mapCustomerType(customerData.customerType),
    notes: notes && String(notes).trim() ? String(notes).trim() : null
  };
};

// POST /customers - Create a new customer profile
export const createCustomer = async (customerData) => {
  const payload = formatCustomerPayload(customerData);
  const res = await api.post('/customers', payload);
  const data = res.data?.data;
  const created = normalizeCustomer(data?.customer || data || payload);
  return {
    customer: created,
    duplicateWarning: data?.duplicateWarning || null
  };
};

// PUT /customers/{id} - Update customer profile
export const updateCustomer = async (id, customerData) => {
  const payload = formatCustomerPayload(customerData);
  const res = await api.put(`/customers/${id}`, payload);
  return normalizeCustomer(res.data?.data?.customer || res.data?.data || res.data || { id, ...customerData });
};

// DELETE /customers/{id} - Deactivate / Soft-delete customer profile
export const deleteCustomer = async (id) => {
  const res = await api.delete(`/customers/${id}`);
  return res.data || { success: true, message: 'Customer profile deleted successfully.' };
};

// PUT /customers/{id}/deactivate - Deactivate customer (Soft-delete only)
export const deactivateCustomer = async (id) => {
  const res = await api.put(`/customers/${id}/deactivate`);
  const data = res.data?.data || res.data;
  return normalizeCustomer(data);
};

// PUT /customers/{id}/reactivate - Reactivate previously deactivated customer
export const reactivateCustomer = async (id) => {
  const res = await api.put(`/customers/${id}/reactivate`);
  const data = res.data?.data || res.data;
  return normalizeCustomer(data);
};

// GET /customers/{id}/history - Get 360° Customer Journey History
export const getCustomer360History = async (id) => {
  const res = await api.get(`/customers/${id}/history`);
  return res.data?.data || res.data || {
    profile: null,
    salesHistory: { quotations: [], confirmedOrders: [], followUps: [], challans: [], invoices: [], payments: [] },
    financialHistory: { totalQuotationValue: 0, actualConvertedValue: 0, totalInvoiceValue: 0, totalPaymentReceived: 0, outstanding: 0, credit: 0, debit: 0 },
    productHistory: { productsPurchased: [], quantityPurchased: 0, productWiseHistory: [], lastPurchaseDate: null }
  };
};

// GET /customers/{id}/outstanding - Get fast outstanding financial summary
export const getCustomerOutstandingSummary = async (id) => {
  const res = await api.get(`/customers/${id}/outstanding`);
  return res.data?.data || res.data || { totalInvoiced: 0, totalPaid: 0, outstanding: 0 };
};

// GET /customers/export - Export filtered customer list to Excel (.xlsx)
export const exportCustomerList = async (params = {}) => {
  const res = await api.get('/customers/export', { params, responseType: 'blob' });
  return res.data;
};

// Backward-compat stubs (no-op)
export const getStoredCustomers = () => [];
export const saveStoredCustomers = () => {};

export default {
  normalizeCustomer,
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  deactivateCustomer,
  reactivateCustomer,
  getCustomer360History,
  getCustomerOutstandingSummary,
  exportCustomerList,
  getStoredCustomers,
  saveStoredCustomers
};
