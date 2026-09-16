import api, { extractArray } from './api';
import { numberToWords } from '../utils/formatters';

let MOCK_INVOICES = [
  {
    id: 'INV-2026-001',
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
      },
      {
        sku: 'SN-WCB-002',
        productName: 'Wall Hung Water Closet Rimless Matte White',
        hsnCode: '69101000',
        quantity: 4,
        unit: 'Pcs',
        rate: 11200.00,
        discount: 10.0,
        gstPercent: 18,
        taxableAmount: 40320.00,
        gstAmount: 7257.60,
        amount: 47577.60
      }
    ],
    taxableTotal: 118980.00,
    cgstAmount: 10708.20,
    sgstAmount: 10708.20,
    igstAmount: 0.00,
    totalGst: 21416.40,
    finalTotal: 140396.40,
    paidAmount: 100000.00,
    outstandingAmount: 40396.40,
    status: 'Partially Paid',
    amountInWords: numberToWords(140396.40),
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    authorizedSignatory: 'For Maitri Ceramic'
  },
  {
    id: 'INV-2026-002',
    invoiceNumber: 'INV-2026-002',
    date: '2026-03-09',
    customerId: 'CUST-003',
    customerName: 'Mehta Interior Designers',
    customerMobile: '9712944332',
    buyerBillTo: 'Mehta Interior Designers, 201, Commerce House, Ashram Road, Ahmedabad. GSTIN: 24BBBPM5678K1Z2',
    consigneeShipTo: 'Client Villa, Bopele, Ahmedabad',
    refNumber: 'QT-2026-002',
    buyersOrderNo: 'ORD-9012',
    dispatchDocNo: 'CH-2026-002',
    deliveryNote: 'Direct site delivery',
    termsOfPayment: 'Net 15 Days',
    termsOfDelivery: 'Ex-Showroom',
    items: [
      {
        sku: 'CP-DIV-3WAY',
        productName: 'Single Lever 3-Way Concealed Diverter Complete',
        hsnCode: '84818020',
        quantity: 10,
        unit: 'Set',
        rate: 4400.00,
        discount: 8.0,
        gstPercent: 18,
        taxableAmount: 40480.00,
        gstAmount: 7286.40,
        amount: 47766.40
      }
    ],
    taxableTotal: 40480.00,
    cgstAmount: 3643.20,
    sgstAmount: 3643.20,
    igstAmount: 0.00,
    totalGst: 7286.40,
    finalTotal: 47766.40,
    paidAmount: 47766.40,
    outstandingAmount: 0.00,
    status: 'Paid',
    amountInWords: numberToWords(47766.40),
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    authorizedSignatory: 'For Maitri Ceramic'
  }
];

export const getInvoices = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/invoices', { params: queryParams });
    const rawList = extractArray(res.data, ['invoices']);
    return { data: rawList, total: res.data?.data?.pagination?.total || res.data?.total || rawList.length };
  } catch (err) {}

  return { data: [], total: 0 };
};

export const getInvoiceById = async (id) => {
  try {
    const res = await api.get(`/invoices/${id}`);
    return res.data;
  } catch (err) {}
  const inv = MOCK_INVOICES.find(i => i.id === id || i.invoiceNumber === id);
  if (!inv) throw new Error('Invoice not found');
  return inv;
};

export const createInvoice = async (invoiceData) => {
  try {
    const res = await api.post('/invoices', invoiceData);
    return res.data;
  } catch (err) {
    const total = Number(invoiceData.finalTotal || 0);
    const newInv = {
      id: `INV-2026-00${MOCK_INVOICES.length + 1}`,
      invoiceNumber: `INV-2026-00${MOCK_INVOICES.length + 1}`,
      date: invoiceData.date || new Date().toISOString().split('T')[0],
      paidAmount: 0,
      outstandingAmount: total,
      status: 'Unpaid',
      amountInWords: numberToWords(total),
      declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
      authorizedSignatory: 'For Maitri Ceramic',
      ...invoiceData
    };
    MOCK_INVOICES.unshift(newInv);
    return newInv;
  }
};
