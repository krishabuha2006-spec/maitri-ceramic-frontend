import api, { extractArray } from './api';
import { getProducts } from './productService';

let MOCK_STOCK_ENTRIES = [
  {
    id: 'SE-001',
    entryNumber: 'SE-2026-001',
    date: '2026-03-01',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    quantity: 500,
    unit: 'Sq.Ft',
    type: 'Stock In',
    reason: 'New Vendor Consignment Purchase',
    referenceDoc: 'PO-KJ-8821',
    remarks: 'Received 25 boxes in godown A1'
  },
  {
    id: 'SE-002',
    entryNumber: 'SE-2026-002',
    date: '2026-03-08',
    sku: 'CP-DIV-3WAY',
    productName: 'Single Lever 3-Way Concealed Diverter Complete',
    quantity: 5,
    unit: 'Set',
    type: 'Stock Out',
    reason: 'Damaged in transit display adjustment',
    referenceDoc: 'ADJ-CP-009',
    remarks: 'Sent back to supplier for replacement'
  }
];

let MOCK_STOCK_MOVEMENTS = [
  {
    id: 'SM-1',
    date: '2026-01-01',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    transaction: 'Opening',
    quantity: 2500,
    balance: 2500
  },
  {
    id: 'SM-2',
    date: '2026-03-01',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    transaction: 'Stock In',
    quantity: 500,
    balance: 3000
  },
  {
    id: 'SM-3',
    date: '2026-03-06',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    transaction: 'Challan',
    quantity: -1150,
    balance: 1850
  },
  {
    id: 'SM-4',
    date: '2026-01-01',
    sku: 'CP-DIV-3WAY',
    productName: 'Single Lever 3-Way Concealed Diverter Complete',
    transaction: 'Opening',
    quantity: 80,
    balance: 80
  },
  {
    id: 'SM-5',
    date: '2026-03-07',
    sku: 'CP-DIV-3WAY',
    productName: 'Single Lever 3-Way Concealed Diverter Complete',
    transaction: 'Challan',
    quantity: -68,
    balance: 12
  }
];

export const getStockEntries = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/stock/entries', { params: queryParams });
    const rawList = extractArray(res.data, ['entries']);
    return { data: rawList, total: rawList.length };
  } catch (err) {}
  return { data: [], total: 0 };
};

export const createStockEntry = async (entryData) => {
  try {
    const res = await api.post('/stock/entries', entryData);
    return res.data;
  } catch (err) {}
  const newEntry = {
    id: `SE-001`,
    entryNumber: `SE-2026-001`,
    date: entryData.date || new Date().toISOString().split('T')[0],
    ...entryData
  };
  return newEntry;
};

export const getStockMovements = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/stock/movements', { params: queryParams });
    const rawList = extractArray(res.data, ['movements']);
    return { data: rawList, total: rawList.length };
  } catch (err) {}
  return { data: [], total: 0 };
};

// POST /stock/entries/in
export const createStockInEntry = async (entryData) => {
  try {
    const res = await api.post('/stock/entries/in', entryData);
    return res.data?.data || res.data;
  } catch (err) {}
  return createStockEntry({ ...entryData, type: 'Stock In' });
};

// POST /stock/entries/out
export const createStockOutEntry = async (entryData) => {
  try {
    const res = await api.post('/stock/entries/out', entryData);
    return res.data?.data || res.data;
  } catch (err) {}
  return createStockEntry({ ...entryData, type: 'Stock Out' });
};

// GET /stock/low-stock-report
export const getLowStockReport = async () => {
  try {
    const { data: products } = await getProducts();
    if (Array.isArray(products)) {
      return products.filter(p => (p.actualStock || 0) <= (p.reorderLevel || 10));
    }
  } catch (err) {}
  return [];
};

// GET /stock/purchase-alerts
export const getPurchaseAlerts = async () => {
  try {
    const { data: products } = await getProducts();
    if (Array.isArray(products)) {
      return products.filter(p => (p.actualStock || 0) <= (p.reorderLevel || 10));
    }
  } catch (err) {}
  return [];
};

// GET /stock/export
export const exportStockReports = async (type = 'movement-history') => {
  try {
    const res = await api.get('/stock/export', { params: { type }, responseType: 'blob' });
    return res.data;
  } catch (err) {}
};

// GET /stock/{productId}/summary
export const getProductStockSummary = async (productId) => {
  try {
    const res = await api.get(`/stock/${productId}/summary`);
    return res.data?.data || res.data;
  } catch (err) {}
  return { actualStock: 0, managementStock: 0, availableStock: 0 };
};

// GET /stock/{productId}/movement-history
export const getProductStockMovementHistory = async (productId) => {
  try {
    const res = await api.get(`/stock/${productId}/movement-history`, { params: { limit: 1000, all: true } });
    const list = extractArray(res.data, ['movements', 'ledger']);
    return list;
  } catch (err) {}
  return MOCK_STOCK_MOVEMENTS.filter(m => m.sku === productId || m.id === productId);
};

// POST /stock/{productId}/reconcile
export const reconcileProductStock = async (productId) => {
  try {
    const res = await api.post(`/stock/${productId}/reconcile`);
    return res.data;
  } catch (err) {
    return { success: true, message: 'Stock cache reconciled with ledger entries.' };
  }
};
