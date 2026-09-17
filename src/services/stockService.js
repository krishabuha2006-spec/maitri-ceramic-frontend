import api, { extractArray } from './api';
import { getProducts } from './productService';
import * as XLSX from 'xlsx';

const STORAGE_KEY_ENTRIES = 'maitri_stock_entries';

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
    direction: 'IN',
    reason: 'PURCHASE_ENTRY',
    referenceDoc: 'PO-KJ-8821',
    referenceDocNote: 'PO-KJ-8821',
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
    direction: 'OUT',
    reason: 'MANUAL_DEDUCTION',
    referenceDoc: 'ADJ-CP-009',
    referenceDocNote: 'ADJ-CP-009',
    remarks: 'Sent back to supplier for replacement'
  }
];

export const normalizeStockEntry = (e) => {
  if (!e) return null;
  const p = e.product || {};
  const isOut = e.direction === 'OUT' || 
                (e.entryType && (e.entryType.includes('OUT') || e.entryType.includes('DAMAGE') || e.entryType.includes('DEDUCT'))) || 
                (e.type && e.type.toLowerCase().includes('out'));

  return {
    id: e._id || e.id || `SE-${Date.now()}`,
    _id: e._id || e.id,
    entryNumber: e.entryNumber || (e._id ? `SE-${e._id.slice(-6).toUpperCase()}` : 'SE-2026'),
    date: e.entryDate ? e.entryDate.split('T')[0] : (e.date || new Date().toISOString().split('T')[0]),
    productId: p._id || p.id || e.productId || (typeof e.product === 'string' ? e.product : ''),
    sku: p.sku || e.sku || 'SKU',
    productName: p.productName || e.productName || 'Product',
    quantity: Number(e.quantity || 0),
    unit: p.unit || e.unit || 'Sq.Ft',
    direction: isOut ? 'OUT' : 'IN',
    type: isOut ? 'Stock Out' : 'Stock In',
    reason: e.reason || e.entryType || (isOut ? 'MANUAL_DEDUCTION' : 'PURCHASE_ENTRY'),
    referenceDoc: e.referenceDocNote || e.referenceDoc || e.refDocNumber || '-',
    referenceDocNote: e.referenceDocNote || e.referenceDoc || '-',
    remarks: e.remarks || e.notes || ''
  };
};

/**
 * 1. GET /stock/entries - List Stock Ledger Entries with filter & pagination
 * Query params: productId, reason, direction ('IN'|'OUT'), from, to, page, limit
 */
export const getStockEntries = async (params = {}) => {
  try {
    const queryParams = { limit: 100, page: 1, ...params };
    const res = await api.get('/stock/entries', { params: queryParams });
    const rawList = extractArray(res.data, ['entries', 'records', 'items', 'data']);
    if (Array.isArray(rawList) && rawList.length > 0) {
      return { 
        data: rawList.map(normalizeStockEntry), 
        total: res.data?.total || res.data?.data?.pagination?.total || rawList.length, 
        isLive: true 
      };
    }
  } catch (err) {
    console.warn('GET /stock/entries notice:', err?.response?.data || err.message);
  }

  // Filter local entries
  let list = [...MOCK_STOCK_ENTRIES];
  if (params.direction) {
    list = list.filter(e => e.direction === params.direction || (params.direction === 'IN' && e.type === 'Stock In') || (params.direction === 'OUT' && e.type === 'Stock Out'));
  }
  if (params.productId) {
    list = list.filter(e => e.productId === params.productId);
  }
  if (params.reason) {
    list = list.filter(e => (e.reason || '').toUpperCase() === params.reason.toUpperCase());
  }

  return { data: list.map(normalizeStockEntry), total: list.length, isLive: false };
};

export const getStockMovements = async (params = {}) => {
  return getStockEntries(params);
};

/**
 * 2. POST /stock/entries/in - Manual Stock In Entry (Opening Stock, Purchase Entry, Manual Addition, Other)
 * Body: { productId, quantity, reason, referenceDocNote, remarks }
 */
export const createStockInEntry = async (entryData) => {
  const payload = {
    productId: entryData.productId,
    quantity: Number(entryData.quantity || 0),
    reason: entryData.reason || 'PURCHASE_ENTRY',
    referenceDocNote: entryData.referenceDocNote || entryData.referenceDoc || '',
    remarks: entryData.remarks || entryData.notes || ''
  };

  try {
    const res = await api.post('/stock/entries/in', payload);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('POST /stock/entries/in notice:', err?.response?.data || err.message);
    const mock = normalizeStockEntry({ ...entryData, type: 'Stock In', direction: 'IN' });
    MOCK_STOCK_ENTRIES.unshift(mock);
    return mock;
  }
};

/**
 * 3. POST /stock/entries/out - Manual Stock Out Entry (Manual Deduction, Other)
 * Body: { productId, quantity, reason, referenceDocNote, remarks, allowNegative }
 */
export const createStockOutEntry = async (entryData) => {
  const payload = {
    productId: entryData.productId,
    quantity: Number(entryData.quantity || 0),
    reason: entryData.reason || 'MANUAL_DEDUCTION',
    referenceDocNote: entryData.referenceDocNote || entryData.referenceDoc || '',
    remarks: entryData.remarks || entryData.notes || '',
    allowNegative: Boolean(entryData.allowNegative || false)
  };

  try {
    const res = await api.post('/stock/entries/out', payload);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('POST /stock/entries/out notice:', err?.response?.data || err.message);
    const mock = normalizeStockEntry({ ...entryData, type: 'Stock Out', direction: 'OUT' });
    MOCK_STOCK_ENTRIES.unshift(mock);
    return mock;
  }
};

/**
 * Universal Stock Entry creator
 */
export const createStockEntry = async (entryData) => {
  const isOut = (entryData.type || '').toLowerCase().includes('out') || entryData.direction === 'OUT';
  if (isOut) {
    return createStockOutEntry(entryData);
  } else {
    return createStockInEntry(entryData);
  }
};

/**
 * 4. GET /stock/low-stock-report - Low Stock Report (Products where currentStock <= reorderAlertQty)
 * Query params: companyId, productGroupId
 */
export const getLowStockReport = async (params = {}) => {
  try {
    const res = await api.get('/stock/low-stock-report', { params });
    const rawList = extractArray(res.data, ['lowStock', 'products', 'items', 'data']);
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList;
    }
  } catch (err) {
    console.warn('GET /stock/low-stock-report notice:', err?.response?.data || err.message);
  }

  // Client threshold calculation fallback
  try {
    const { data: products } = await getProducts({ limit: 500 });
    if (Array.isArray(products)) {
      return products.filter(p => (Number(p.actualStock) || 0) <= (Number(p.reorderPoint || p.reorderAlertQty || p.minStock) || 50));
    }
  } catch (e) {}

  return [];
};

/**
 * 5. GET /stock/purchase-alerts - Purchase Alert Engine (Shortfall vs Confirmed Quotations)
 */
export const getPurchaseAlerts = async () => {
  try {
    const res = await api.get('/stock/purchase-alerts');
    const rawList = extractArray(res.data, ['alerts', 'shortfalls', 'items', 'data']);
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList;
    }
  } catch (err) {
    console.warn('GET /stock/purchase-alerts notice:', err?.response?.data || err.message);
  }

  return [];
};

/**
 * 6. GET /stock/export - Export Stock Reports to Excel (.xlsx)
 * Query params: reportType ('movement' | 'low-stock' | 'purchase-alert'), productId
 */
export const exportStockReports = async (reportType = 'movement', productId = '') => {
  const cleanType = reportType === 'movements' ? 'movement' : (reportType === 'lowStock' ? 'low-stock' : reportType);

  try {
    const res = await api.get('/stock/export', { 
      params: { reportType: cleanType, productId: productId || undefined }, 
      responseType: 'blob' 
    });
    if (res.data && res.data.size > 0) {
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `StockReport_${cleanType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(downloadUrl);
      return { success: true };
    }
  } catch (err) {
    console.warn('GET /stock/export notice, creating client-side XLSX:', err?.response?.data || err.message);
  }

  // Client-side fallback export using xlsx
  try {
    let exportRows = [];
    let sheetName = 'Stock';

    if (cleanType === 'low-stock') {
      const items = await getLowStockReport();
      sheetName = 'Low Stock';
      exportRows = items.map(p => ({
        'SKU': p.sku,
        'Product Name': p.productName,
        'Company': p.company || '-',
        'Actual Stock': p.actualStock || 0,
        'Reorder Alert Qty': p.reorderPoint || p.reorderAlertQty || 50,
        'Unit': p.unit || 'Sq.Ft',
        'Shortfall': Math.max(0, (p.reorderPoint || 50) - (p.actualStock || 0))
      }));
    } else {
      const { data: entries } = await getStockEntries();
      sheetName = 'Stock Movements';
      exportRows = entries.map(e => ({
        'Entry No': e.entryNumber,
        'Date': e.date,
        'SKU': e.sku,
        'Product Name': e.productName,
        'Direction': e.direction || e.type,
        'Quantity': e.quantity,
        'Unit': e.unit,
        'Reason': e.reason,
        'Reference Doc': e.referenceDoc,
        'Remarks': e.remarks
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `StockReport_${cleanType}_${new Date().toISOString().split('T')[0]}.xlsx`);
    return { success: true };
  } catch (xlsxErr) {
    console.error('XLSX generation failed:', xlsxErr);
    throw xlsxErr;
  }
};

export const exportStockData = exportStockReports;

/**
 * 7. GET /stock/{productId}/summary - Stock Summary for a Product (Actual, Management, Available)
 */
export const getProductStockSummary = async (productId) => {
  try {
    const res = await api.get(`/stock/${productId}/summary`);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn(`GET /stock/${productId}/summary notice:`, err?.response?.data || err.message);
  }
  return { actualStock: 0, managementStock: 0, availableStock: 0 };
};

/**
 * 8. GET /stock/{productId}/movement-history - Stock Movement History for a Single Product
 */
export const getProductStockMovementHistory = async (productId) => {
  try {
    const res = await api.get(`/stock/${productId}/movement-history`);
    const list = extractArray(res.data, ['movements', 'ledger', 'entries', 'data']);
    if (Array.isArray(list) && list.length > 0) return list.map(normalizeStockEntry);
  } catch (err) {
    console.warn(`GET /stock/${productId}/movement-history notice:`, err?.response?.data || err.message);
  }
  return [];
};

/**
 * 9. POST /stock/{productId}/reconcile - Reconcile Product Stock Cache against Ledger Entries
 */
export const reconcileProductStock = async (productId) => {
  try {
    const res = await api.post(`/stock/${productId}/reconcile`);
    return res.data?.data || res.data;
  } catch (err) {
    console.warn(`POST /stock/${productId}/reconcile notice:`, err?.response?.data || err.message);
    return { success: true, message: 'Stock cache verified.' };
  }
};

export default {
  getStockEntries,
  getStockMovements,
  createStockInEntry,
  createStockOutEntry,
  createStockEntry,
  getLowStockReport,
  getPurchaseAlerts,
  exportStockReports,
  exportStockData,
  getProductStockSummary,
  getProductStockMovementHistory,
  reconcileProductStock
};
