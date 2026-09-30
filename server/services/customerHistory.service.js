const mongoose = require('mongoose');

/**
 * Forward Service Stub Interfaces
 *
 * Each stub is designed to safely query the corresponding downstream module
 * once deployed, or gracefully return an empty dataset if the module is pending.
 */

// Module 5 Forward Reference: Quotations
const getQuotationsByCustomer = async (customerId) => {
  try {
    if (mongoose.models.Quotation) {
      const quotations = await mongoose.models.Quotation.find({ customer: customerId }).sort({ createdAt: -1 });
      const confirmedOrders = quotations.filter((q) => q.status === 'CONFIRMED');
      return { quotations, confirmedOrders };
    }
    return { quotations: [], confirmedOrders: [] };
  } catch (err) {
    return { quotations: [], confirmedOrders: [] };
  }
};

// Module 6 Reference: Follow-Ups
const getFollowUpsByCustomer = async (customerId) => {
  try {
    const followUpService = require('./followUp.service');
    return await followUpService.getByCustomer(customerId);
  } catch (err) {
    return [];
  }
};

// Module 9 Reference: Challans
const getChallansByCustomer = async (customerId) => {
  try {
    const challanService = require('./challan.service');
    return await challanService.getByCustomer(customerId);
  } catch (err) {
    if (mongoose.models.Challan) {
      return await mongoose.models.Challan.find({ customer: customerId }).sort({ createdAt: -1 });
    }
    return [];
  }
};

// Module 10 Forward Reference: Invoices
const getInvoicesByCustomer = async (customerId) => {
  try {
    const invoiceService = require('./invoice.service');
    return await invoiceService.getByCustomer(customerId);
  } catch (err) {
    if (mongoose.models.Invoice) {
      const invoices = await mongoose.models.Invoice.find({ customer: customerId, isActive: true }).sort({ createdAt: -1 });
      return invoices;
    }
    return [];
  }
};

// Module 11 Forward Reference: Payments
const getPaymentsByCustomer = async (customerId) => {
  try {
    const paymentService = require('./payment.service');
    return await paymentService.getByCustomer(customerId);
  } catch (err) {
    if (mongoose.models.Payment) {
      const payments = await mongoose.models.Payment.find({ customer: customerId, isActive: true }).sort({ createdAt: -1 });
      return payments;
    }
    return [];
  }
};

// Module 12 Forward Reference: Returns
const getReturnsByCustomer = async (customerId) => {
  try {
    const returnNoteService = require('./returnNote.service');
    return await returnNoteService.getByCustomer(customerId);
  } catch (err) {
    if (mongoose.models.ReturnNote) {
      const returns = await mongoose.models.ReturnNote.find({ customer: customerId, returnType: 'SALES_RETURN', isActive: true }).sort({ createdAt: -1 });
      return returns;
    }
    return [];
  }
};

// Module 13 Reference: Customer Ledger & Credit/Debit
const getLedgerByCustomer = async (customerId) => {
  try {
    const ledgerService = require('./ledger.service');
    const result = await ledgerService.getByCustomer(customerId, { limit: 500 });
    return result.entries || [];
  } catch (err) {
    if (mongoose.models.LedgerEntry) {
      const ledgerEntries = await mongoose.models.LedgerEntry.find({ customer: customerId, isActive: true }).sort({ entryDate: 1, createdAt: 1 });
      return ledgerEntries;
    }
    return [];
  }
};

/**
 * Assemble Complete Customer 360° History
 *
 * Runs all forward queries in parallel via Promise.allSettled and guarantees
 * zero 500 crashes even if downstream modules are not yet installed.
 *
 * @param {Object} customerDoc - Mongoose Customer document
 * @returns {Promise<Object>} Aggregated 360 history payload
 */
const getCustomer360History = async (customerDoc) => {
  const customerId = customerDoc._id;

  const [
    quotationResult,
    followUpResult,
    challanResult,
    invoiceResult,
    paymentResult,
    returnResult,
    ledgerResult
  ] = await Promise.allSettled([
    getQuotationsByCustomer(customerId),
    getFollowUpsByCustomer(customerId),
    getChallansByCustomer(customerId),
    getInvoicesByCustomer(customerId),
    getPaymentsByCustomer(customerId),
    getReturnsByCustomer(customerId),
    getLedgerByCustomer(customerId)
  ]);

  const quotationsData = quotationResult.status === 'fulfilled' ? quotationResult.value : { quotations: [], confirmedOrders: [] };
  const followUps = followUpResult.status === 'fulfilled' ? followUpResult.value : [];
  const challans = challanResult.status === 'fulfilled' ? challanResult.value : [];
  const invoices = invoiceResult.status === 'fulfilled' ? invoiceResult.value : [];
  const payments = paymentResult.status === 'fulfilled' ? paymentResult.value : [];
  const returns = returnResult.status === 'fulfilled' ? returnResult.value : [];
  const ledgerEntries = ledgerResult.status === 'fulfilled' ? ledgerResult.value : [];

  // Financial Calculations
  const totalQuotationValue = (quotationsData.quotations || []).reduce((sum, q) => sum + (Number(q.grandTotal || q.totalAmount) || 0), 0);
  const actualConvertedValue = (quotationsData.confirmedOrders || []).reduce((sum, q) => sum + (Number(q.grandTotal || q.totalAmount) || 0), 0);
  const totalInvoiceValue = (invoices || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalPaymentReceived = (payments || []).reduce((sum, pay) => {
    const val = pay.amountPaid !== undefined ? pay.amountPaid : (pay.entryType === 'REVERSAL' ? -pay.totalAmount : pay.totalAmount);
    return sum + (Number(val) || 0);
  }, 0);
  const outstanding = Math.max(0, totalInvoiceValue - totalPaymentReceived);

  let credit = 0;
  let debit = 0;
  (ledgerEntries || []).forEach((entry) => {
    if (entry.entryType === 'CREDIT') credit += Number(entry.amount) || 0;
    if (entry.entryType === 'DEBIT') debit += Number(entry.amount) || 0;
  });

  // Product Purchase Aggregation from Invoices / Challans
  const productMap = new Map();
  let totalQty = 0;
  let lastPurchaseDate = null;

  (invoices || []).forEach((inv) => {
    if (inv.createdAt && (!lastPurchaseDate || new Date(inv.createdAt) > new Date(lastPurchaseDate))) {
      lastPurchaseDate = inv.createdAt;
    }
    (inv.items || []).forEach((item) => {
      const prodId = String(item.product || item.productName);
      const qty = Number(item.quantity) || 0;
      totalQty += qty;
      const current = productMap.get(prodId) || {
        productName: item.productName || 'Unknown Product',
        totalQuantity: 0,
        totalAmount: 0
      };
      current.totalQuantity += qty;
      current.totalAmount += Number(item.totalAmount) || 0;
      productMap.set(prodId, current);
    });
  });

  const productWiseHistory = Array.from(productMap.values());

  return {
    profile: customerDoc,
    salesHistory: {
      quotations: quotationsData.quotations || [],
      confirmedOrders: quotationsData.confirmedOrders || [],
      followUps,
      challans,
      invoices,
      payments,
      returns
    },
    financialHistory: {
      totalQuotationValue,
      actualConvertedValue,
      totalInvoiceValue,
      totalPaymentReceived,
      outstanding,
      credit,
      debit
    },
    productHistory: {
      productsPurchased: productWiseHistory.map((p) => p.productName),
      quantityPurchased: totalQty,
      productWiseHistory,
      lastPurchaseDate
    }
  };
};

/**
 * Fast Outstanding Financial Summary for Dashboard Cards
 *
 * @param {ObjectId|String} customerId
 * @returns {Promise<Object>} { totalInvoiced, totalPaid, outstanding }
 */
const getCustomerOutstandingSummary = async (customerId) => {
  const [invoiceResult, paymentResult] = await Promise.allSettled([
    getInvoicesByCustomer(customerId),
    getPaymentsByCustomer(customerId)
  ]);

  const invoices = invoiceResult.status === 'fulfilled' ? invoiceResult.value : [];
  const payments = paymentResult.status === 'fulfilled' ? paymentResult.value : [];

  const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  const totalPaid = (payments || []).reduce((sum, pay) => sum + (Number(pay.amountPaid) || 0), 0);
  const outstanding = Math.max(0, totalInvoiced - totalPaid);

  return {
    totalInvoiced,
    totalPaid,
    outstanding
  };
};

module.exports = {
  getCustomer360History,
  getCustomerOutstandingSummary,
  getQuotationsByCustomer,
  getFollowUpsByCustomer,
  getChallansByCustomer,
  getInvoicesByCustomer,
  getPaymentsByCustomer,
  getLedgerByCustomer
};
