import api, { extractArray } from './api';

let MOCK_PURCHASE_RETURNS = [
  {
    id: 'PR-2026-001',
    returnNoteNumber: 'PRN-2026-001',
    date: '2026-03-02',
    vendor: 'Kajaria Ceramics Ltd',
    purchaseRef: 'PO-KJ-8821',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    quantity: 50,
    unit: 'Sq.Ft',
    returnReason: 'Corner breakage in transit box',
    remarks: 'Approved by area sales manager',
    status: 'Confirmed'
  }
];

let MOCK_SALES_RETURNS = [
  {
    id: 'SR-2026-001',
    returnNoteNumber: 'SRN-2026-001',
    date: '2026-03-11',
    customerName: 'Rajesh Sharma Construction',
    invoiceNumber: 'INV-2026-001',
    challanNumber: 'CH-2026-001',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    quantity: 20,
    unit: 'Sq.Ft',
    returnReason: 'Excess box returned from site',
    remarks: 'Stock returned to godown rack B4',
    status: 'Confirmed'
  }
];

export const getPurchaseReturns = async () => {
  return { data: MOCK_PURCHASE_RETURNS, total: MOCK_PURCHASE_RETURNS.length };
};

export const createPurchaseReturn = async (returnData) => {
  const newRet = {
    id: `PR-2026-00${MOCK_PURCHASE_RETURNS.length + 1}`,
    returnNoteNumber: `PRN-2026-00${MOCK_PURCHASE_RETURNS.length + 1}`,
    date: returnData.date || new Date().toISOString().split('T')[0],
    status: 'Confirmed',
    ...returnData
  };
  MOCK_PURCHASE_RETURNS.unshift(newRet);
  return newRet;
};

export const getSalesReturns = async () => {
  return { data: MOCK_SALES_RETURNS, total: MOCK_SALES_RETURNS.length };
};

export const createSalesReturn = async (returnData) => {
  const newRet = {
    id: `SR-2026-00${MOCK_SALES_RETURNS.length + 1}`,
    returnNoteNumber: `SRN-2026-00${MOCK_SALES_RETURNS.length + 1}`,
    date: returnData.date || new Date().toISOString().split('T')[0],
    status: 'Confirmed',
    ...returnData
  };
  MOCK_SALES_RETURNS.unshift(newRet);
  return newRet;
};


