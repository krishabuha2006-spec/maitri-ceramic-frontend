import api, { extractArray } from './api';
import { numberToWords } from '../utils/formatters';

let MOCK_PAYMENTS = [
  {
    id: 'RCT-2026-001',
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
    amountInWords: numberToWords(100000.00),
    authorizedSignatory: 'For Maitri Ceramic'
  },
  {
    id: 'RCT-2026-002',
    receiptNumber: 'RCT-2026-002',
    date: '2026-03-10',
    customerId: 'CUST-003',
    customerName: 'Mehta Interior Designers',
    invoiceNumber: 'INV-2026-002',
    paymentMode: 'UPI',
    amount: 47766.40,
    referenceNumber: 'UPI/6078123901/PAY',
    bankAccount: 'ICICI Bank - Current A/C 001105009876',
    remarks: 'Full payment against invoice INV-2026-002',
    amountInWords: numberToWords(47766.40),
    authorizedSignatory: 'For Maitri Ceramic'
  }
];

export const getPayments = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/payments', { params: queryParams });
    const rawList = extractArray(res.data, ['payments']);
    return { data: rawList, total: res.data?.data?.pagination?.total || res.data?.total || rawList.length };
  } catch (err) {}

  return { data: [], total: 0 };
};

export const getPaymentById = async (id) => {
  try {
    const res = await api.get(`/payments/${id}`);
    return res.data;
  } catch (err) {}
  const pmt = MOCK_PAYMENTS.find(p => p.id === id || p.receiptNumber === id);
  if (!pmt) throw new Error('Receipt not found');
  return pmt;
};

export const createPayment = async (paymentData) => {
  try {
    const res = await api.post('/payments', paymentData);
    return res.data;
  } catch (err) {
    const amount = Number(paymentData.amount || 0);
    const newPmt = {
      id: `RCT-2026-00${MOCK_PAYMENTS.length + 1}`,
      receiptNumber: `RCT-2026-00${MOCK_PAYMENTS.length + 1}`,
      date: paymentData.date || new Date().toISOString().split('T')[0],
      amountInWords: numberToWords(amount),
      authorizedSignatory: 'For Maitri Ceramic',
      ...paymentData
    };
    MOCK_PAYMENTS.unshift(newPmt);
    return newPmt;
  }
};
