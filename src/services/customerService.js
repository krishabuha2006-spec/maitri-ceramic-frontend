import api, { extractArray, hasRealJwtToken } from './api';

const STORAGE_KEY = 'maitri_local_customers';

// Read stored customers from localStorage (no mock fallback — backend is source of truth)
export const getStoredCustomers = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.error('Failed to read stored customers:', err);
  }
  return [];
};

// Save updated customer list to localStorage
export const saveStoredCustomers = (customersList) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customersList));
  } catch (err) {
    console.error('Failed to save customers to local storage:', err);
  }
};

// Helper to normalize live backend / frontend Customer object
export const normalizeCustomer = (c) => {
  if (!c) return null;
  const isAct = c.isActive !== undefined ? Boolean(c.isActive) : (c.status !== 'Inactive');
  const custId = c._id || c.id || `CUST-${Math.floor(Math.random() * 10000)}`;
  return {
    id: custId,
    _id: c._id || custId,
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

// GET /customers - Get list of customers with search, filters & local storage persistence fallback
export const getCustomers = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, ...params };
    const res = await api.get('/customers', { params: queryParams });
    const rawList = extractArray(res.data, ['customers', 'customerList', 'records', 'data']);

    if (Array.isArray(rawList)) {
      const normalized = rawList.map(normalizeCustomer);
      saveStoredCustomers(normalized);
      return {
        data: normalized,
        total: res.data?.data?.pagination?.total || res.data?.total || normalized.length,
        pagination: res.data?.data?.pagination,
        isLive: true
      };
    }
  } catch (err) {
    console.warn('API /customers call failed, relying on local storage cache:', err.message);
  }

  // Local storage fallback only if server call failed completely
  let list = getStoredCustomers().map(normalizeCustomer);

  if (params.search) {
    const q = String(params.search).toLowerCase();
    list = list.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.mobile.includes(q) ||
      c.city.toLowerCase().includes(q) ||
      (c.gstNumber && c.gstNumber.toLowerCase().includes(q))
    );
  }

  if (params.customerType) {
    list = list.filter(c => c.customerType === params.customerType.toUpperCase());
  }

  if (params.status) {
    list = list.filter(c => c.status === params.status);
  }

  return { data: list, total: list.length, isLive: false };
};

// GET /customers/{id} - Get single customer profile by ID
export const getCustomerById = async (id) => {
  if (!id) throw new Error('Customer ID required');

  try {
    const res = await api.get(`/customers/${id}`);
    const raw = res.data?.data?.customer || res.data?.data || res.data;
    if (raw) return normalizeCustomer(raw);
  } catch (err) {
    console.warn(`API /customers/${id} failed, checking local cache:`, err.message);
  }

  const stored = getStoredCustomers();
  const found = stored.find(c => String(c.id) === String(id) || String(c._id) === String(id));
  if (found) return normalizeCustomer(found);

  throw new Error('Customer not found');
};

// POST /customers - Create a new customer profile
export const createCustomer = async (customerData) => {
  const payload = {
    customerName: customerData.name || customerData.customerName,
    mobile: customerData.mobile,
    alternateNumber: customerData.altMobile || customerData.alternateNumber,
    email: customerData.email,
    billingAddress: customerData.billingAddress,
    shippingAddress: customerData.shippingAddress,
    city: customerData.city || 'Ahmedabad',
    state: customerData.state || 'Gujarat',
    gstNumber: customerData.gstNumber,
    customerType: customerData.customerType || 'RETAIL',
    notes: customerData.notes
  };

  const newId = `CUST-${Date.now()}`;
  const localCustomer = normalizeCustomer({ id: newId, _id: newId, ...payload, ...customerData });

  if (hasRealJwtToken()) {
    try {
      const res = await api.post('/customers', payload);
      const data = res.data?.data;
      const created = normalizeCustomer(data?.customer || data || payload);

      // Save into local storage cache
      const current = getStoredCustomers();
      current.unshift(created);
      saveStoredCustomers(current);

      return {
        customer: created,
        duplicateWarning: data?.duplicateWarning || null
      };
    } catch (err) {
      console.warn('POST /customers live call failed, persisting locally:', err.message);
    }
  }

  // Fallback to local storage
  const current = getStoredCustomers();
  current.unshift(localCustomer);
  saveStoredCustomers(current);

  return {
    customer: localCustomer,
    duplicateWarning: null
  };
};

// PUT /customers/{id} - Update customer profile
export const updateCustomer = async (id, customerData) => {
  const payload = {
    customerName: customerData.name || customerData.customerName,
    mobile: customerData.mobile,
    alternateNumber: customerData.altMobile || customerData.alternateNumber,
    email: customerData.email,
    billingAddress: customerData.billingAddress,
    shippingAddress: customerData.shippingAddress,
    city: customerData.city,
    state: customerData.state,
    gstNumber: customerData.gstNumber,
    customerType: customerData.customerType,
    notes: customerData.notes
  };

  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());

  if (hasRealJwtToken() && isMongoId(id)) {
    try {
      const res = await api.put(`/customers/${id}`, payload);
      const updated = normalizeCustomer(res.data?.data || res.data || { id, ...customerData });

      const current = getStoredCustomers();
      const idx = current.findIndex(c => String(c.id) === String(id) || String(c._id) === String(id));
      if (idx !== -1) {
        current[idx] = { ...current[idx], ...updated };
        saveStoredCustomers(current);
      }

      return updated;
    } catch (err) {
      console.warn('PUT /customers/:id live call failed, persisting locally:', err.message);
    }
  }

  const updatedLocal = normalizeCustomer({ id, _id: id, ...customerData, ...payload });
  const current = getStoredCustomers();
  const idx = current.findIndex(c => String(c.id) === String(id) || String(c._id) === String(id));
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...updatedLocal };
    saveStoredCustomers(current);
  } else {
    current.unshift(updatedLocal);
    saveStoredCustomers(current);
  }
  return updatedLocal;
};

// DELETE /customers/{id} - Deactivate / Soft-delete customer profile permanently from view
export const deleteCustomer = async (id) => {
  const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
  if (hasRealJwtToken() && isMongoId(id)) {
    try {
      await api.delete(`/customers/${id}`);
    } catch (err) {
      console.warn('DELETE /customers/:id live call failed:', err.message);
    }
  }

  const current = getStoredCustomers().filter(c => String(c.id) !== String(id) && String(c._id) !== String(id));
  saveStoredCustomers(current);
  return { success: true, message: 'Customer profile deleted successfully.' };
};

// PUT /customers/{id}/deactivate - Deactivate customer (Soft-delete only)
export const deactivateCustomer = async (id) => {
  try {
    const res = await api.put(`/customers/${id}/deactivate`);
    const data = res.data?.data || res.data;
    if (data) {
      const norm = normalizeCustomer(data);
      const current = getStoredCustomers();
      const idx = current.findIndex(c => String(c.id) === String(id));
      if (idx !== -1) {
        current[idx] = norm;
        saveStoredCustomers(current);
      }
      return norm;
    }
  } catch (err) {
    console.warn(`PUT /customers/${id}/deactivate API notice:`, err.message);
  }

  const current = getStoredCustomers();
  const idx = current.findIndex(c => String(c.id) === String(id) || String(c._id) === String(id));
  if (idx !== -1) {
    current[idx].isActive = false;
    current[idx].status = 'Inactive';
    saveStoredCustomers(current);
    return normalizeCustomer(current[idx]);
  }
};

// PUT /customers/{id}/reactivate - Reactivate previously deactivated customer
export const reactivateCustomer = async (id) => {
  try {
    const res = await api.put(`/customers/${id}/reactivate`);
    const data = res.data?.data || res.data;
    if (data) {
      const norm = normalizeCustomer(data);
      const current = getStoredCustomers();
      const idx = current.findIndex(c => String(c.id) === String(id));
      if (idx !== -1) {
        current[idx] = norm;
        saveStoredCustomers(current);
      }
      return norm;
    }
  } catch (err) {
    console.warn(`PUT /customers/${id}/reactivate API notice:`, err.message);
  }

  const current = getStoredCustomers();
  const idx = current.findIndex(c => String(c.id) === String(id) || String(c._id) === String(id));
  if (idx !== -1) {
    current[idx].isActive = true;
    current[idx].status = 'Active';
    saveStoredCustomers(current);
    return normalizeCustomer(current[idx]);
  }
};

// GET /customers/{id}/history - Get 360° Customer Journey History (Aggregated across Quotations, Invoices, Payments, Ledger)
export const getCustomer360History = async (id) => {
  try {
    const res = await api.get(`/customers/${id}/history`);
    if (res.data?.data || res.data) {
      return res.data?.data || res.data;
    }
  } catch (err) {
    console.warn(`GET /customers/${id}/history API notice:`, err.message);
  }

  return {
    profile: null,
    salesHistory: { quotations: [], confirmedOrders: [], followUps: [], challans: [], invoices: [], payments: [] },
    financialHistory: { totalQuotationValue: 0, actualConvertedValue: 0, totalInvoiceValue: 0, totalPaymentReceived: 0, outstanding: 0, credit: 0, debit: 0 },
    productHistory: { productsPurchased: [], quantityPurchased: 0, productWiseHistory: [], lastPurchaseDate: null }
  };
};

// GET /customers/{id}/outstanding - Get fast outstanding financial summary
export const getCustomerOutstandingSummary = async (id) => {
  try {
    const res = await api.get(`/customers/${id}/outstanding`);
    if (res.data?.data || res.data) {
      return res.data?.data || res.data;
    }
  } catch (err) {
    console.warn(`GET /customers/${id}/outstanding API notice:`, err.message);
  }

  return { totalInvoiced: 0, totalPaid: 0, outstanding: 0 };
};

// GET /customers/export - Export filtered customer list to Excel (.xlsx)
export const exportCustomerList = async (params = {}) => {
  try {
    const res = await api.get('/customers/export', { params, responseType: 'blob' });
    if (res.data) return res.data;
  } catch (err) {
    console.warn('GET /customers/export API notice:', err.message);
  }

  // Fallback: generate CSV from cached (not mock) customers
  const customers = getStoredCustomers();
  if (!customers.length) return null;
  const csvContent = 'Customer ID,Name,Mobile,City,State,GST,Customer Type,Outstanding\n' +
    customers.map(c => `"${c.id}","${c.name}","${c.mobile}","${c.city}","${c.state}","${c.gstNumber || ''}","${c.customerType}","${c.totalOutstanding}"`).join('\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

export default {
  getStoredCustomers,
  saveStoredCustomers,
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
  exportCustomerList
};
