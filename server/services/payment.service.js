const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Payment = require('../models/Payment');
const PaymentReceiptNumberSequence = require('../models/PaymentReceiptNumberSequence');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const PaymentModeMaster = require('../models/PaymentModeMaster');
const { amountToWords } = require('../utils/numberToWords.util');

/**
 * Compute live Balance Due and Payment Received for a specific invoice
 * Balance Due = Invoice.grandTotal - (paymentsReceived - paymentReversals)
 *
 * @param {ObjectId|String} invoiceId
 * @param {Object} [session=null]
 * @returns {Promise<Object>} { invoiceId, invoiceNumber, grandTotal, paymentReceived, balanceDue, status }
 */
const getBalanceDue = async (invoiceId, session = null) => {
  const query = Invoice.findOne({ _id: invoiceId, isActive: true });
  if (session) query.session(session);
  const invoice = await query;

  if (!invoice) {
    const err = new Error(`Invoice not found with ID '${invoiceId}'.`);
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === 'CANCELLED') {
    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.grandTotal,
      paymentReceived: 0,
      balanceDue: 0,
      status: invoice.status
    };
  }

  const pQuery = Payment.find({
    'allocations.invoice': invoiceId,
    isActive: true
  });
  if (session) pQuery.session(session);
  const payments = await pQuery;

  let netPaid = 0;
  payments.forEach((p) => {
    const alloc = (p.allocations || []).find((a) => String(a.invoice) === String(invoiceId));
    if (alloc) {
      const amt = Number(alloc.allocatedAmount) || 0;
      if (p.entryType === 'PAYMENT') {
        netPaid += amt;
      } else if (p.entryType === 'REVERSAL') {
        netPaid -= amt;
      }
    }
  });

  const paymentReceived = Math.max(0, Math.round(netPaid * 100) / 100);
  const grandTotal = Number(invoice.grandTotal) || 0;
  const balanceDue = Math.max(0, Math.round((grandTotal - paymentReceived) * 100) / 100);

  return {
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    grandTotal,
    paymentReceived,
    balanceDue,
    status: invoice.status
  };
};

/**
 * Check if active net payments exist against an invoice
 * Used by Module 10's cancellation gate
 */
const hasPayments = async (invoiceId) => {
  try {
    const balanceInfo = await getBalanceDue(invoiceId);
    return balanceInfo.paymentReceived > 0;
  } catch (err) {
    return false;
  }
};

/**
 * Sum net payments across all invoices tracing back to a Confirmation
 * Used by Module 7's amount-comparison endpoint
 */
const getReceivedAmount = async (confirmationId) => {
  try {
    const invoices = await Invoice.find({
      sourceConfirmations: confirmationId,
      status: 'ISSUED',
      isActive: true
    });

    let totalReceived = 0;
    for (const inv of invoices) {
      const b = await getBalanceDue(inv._id);
      totalReceived += b.paymentReceived;
    }

    return Math.round(totalReceived * 100) / 100;
  } catch (err) {
    console.warn('Error in paymentService.getReceivedAmount:', err.message);
    return 0;
  }
};

/**
 * Record a new customer payment with multi-invoice allocation
 */
const createPayment = async (data, user) => {
  const {
    customerId,
    paymentDate,
    paymentModeId,
    totalAmount,
    referenceNumber,
    bankCashAccount,
    remarks,
    allocations = []
  } = data;

  if (!customerId) {
    const err = new Error('Customer ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!paymentModeId) {
    const err = new Error('Payment Mode ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const cleanTotal = Math.round(Number(totalAmount) * 100) / 100;
  if (isNaN(cleanTotal) || cleanTotal <= 0) {
    const err = new Error('Total payment amount must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(allocations) || allocations.length === 0) {
    const err = new Error('At least one invoice allocation is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify Customer and Payment Mode
  const customer = await Customer.findOne({ _id: customerId, isActive: true });
  if (!customer) {
    const err = new Error(`Customer not found with ID '${customerId}'.`);
    err.statusCode = 404;
    throw err;
  }

  let paymentMode = null;
  if (paymentModeId && mongoose.Types.ObjectId.isValid(paymentModeId)) {
    paymentMode = await PaymentModeMaster.findOne({ _id: paymentModeId, isActive: true });
  }

  // If not found by exact ID, search by modeName or modeCode
  if (!paymentMode && paymentModeId) {
    paymentMode = await PaymentModeMaster.findOne({
      $or: [
        { modeName: new RegExp(`^${paymentModeId}$`, 'i') },
        { modeCode: String(paymentModeId).toUpperCase() }
      ],
      isActive: true
    });
  }

  // Handle mock/static IDs or fallback mapping to real DB document
  if (!paymentMode) {
    const mockMap = {
      '6aa7c9eb612a410d893bcbbf': 'Cash',
      '6aa7c9ec612a410d893bcbc0': 'Bank Transfer',
      '6aa7c9ec612a410d893bcbc1': 'UPI',
      '6aa7c9ec612a410d893bcbc2': 'Cheque',
      '6aa7c9ec612a410d893bcbc3': 'Debit/Credit Card'
    };
    const targetName = mockMap[String(paymentModeId)] || 'Cash';
    paymentMode = await PaymentModeMaster.findOne({
      modeName: new RegExp(`^${targetName}$`, 'i'),
      isActive: true
    });

    if (!paymentMode) {
      paymentMode = await PaymentModeMaster.findOneAndUpdate(
        { modeName: targetName },
        { $set: { modeName: targetName, isActive: true, createdBy: customer.createdBy || customer._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  if (!paymentMode) {
    paymentMode = await PaymentModeMaster.findOne({ isActive: true });
  }

  if (!paymentMode) {
    paymentMode = await PaymentModeMaster.create({
      modeName: 'Cash',
      isActive: true,
      createdBy: customer.createdBy || customer._id
    });
  }

  // 2. Validate sum of allocations equals totalAmount
  let sumAllocated = 0;
  allocations.forEach((a) => {
    sumAllocated += Number(a.allocatedAmount) || 0;
  });
  sumAllocated = Math.round(sumAllocated * 100) / 100;

  if (Math.abs(sumAllocated - cleanTotal) > 0.01) {
    const err = new Error(`Sum of invoice allocations (₹${sumAllocated}) does not match total payment amount (₹${cleanTotal}).`);
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate every allocated invoice at write time
  const processedAllocations = [];

  for (const alloc of allocations) {
    const invoiceId = alloc.invoiceId || alloc.invoice;
    if (!invoiceId) {
      const err = new Error('Invoice ID is required for each allocation line.');
      err.statusCode = 400;
      throw err;
    }

    const allocAmt = Math.round(Number(alloc.allocatedAmount) * 100) / 100;
    if (isNaN(allocAmt) || allocAmt <= 0) {
      const err = new Error(`Allocated amount must be greater than 0 for invoice ID '${invoiceId}'.`);
      err.statusCode = 400;
      throw err;
    }

    const invoice = await Invoice.findOne({ _id: invoiceId, isActive: true });
    if (!invoice) {
      const err = new Error(`Invoice not found with ID '${invoiceId}'.`);
      err.statusCode = 404;
      throw err;
    }

    if (String(invoice.customer) !== String(customerId)) {
      const err = new Error(`Invoice '${invoice.invoiceNumber}' belongs to a different customer. Cross-customer payment allocation is rejected.`);
      err.statusCode = 400;
      throw err;
    }

    if (invoice.status === 'CANCELLED') {
      const err = new Error(`Cannot record payment against CANCELLED invoice '${invoice.invoiceNumber}'.`);
      err.statusCode = 400;
      throw err;
    }

    // Live balance check
    const liveBalance = await getBalanceDue(invoice._id);
    if (allocAmt > liveBalance.balanceDue + 0.001) {
      const err = new Error(`Allocated amount (₹${allocAmt}) exceeds the current live balance due (₹${liveBalance.balanceDue}) for invoice '${invoice.invoiceNumber}'.`);
      err.statusCode = 400;
      throw err;
    }

    processedAllocations.push({
      invoice: invoice._id,
      invoiceNumberSnapshot: invoice.invoiceNumber,
      allocatedAmount: allocAmt
    });
  }

  // 4. Generate atomic receipt number
  const receiptNumber = await PaymentReceiptNumberSequence.generateNextNumber(paymentDate ? new Date(paymentDate) : new Date());

  // 5. Create Payment record
  const payment = new Payment({
    receiptNumber,
    paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
    customer: customer._id,
    paymentMode: paymentMode._id,
    totalAmount: cleanTotal,
    allocations: processedAllocations,
    referenceNumber: referenceNumber ? referenceNumber.trim() : null,
    bankCashAccount: bankCashAccount ? bankCashAccount.trim() : null,
    remarks: remarks ? remarks.trim() : null,
    entryType: 'PAYMENT',
    isActive: true,
    createdBy: user._id
  });

  await payment.save();

  // Module 13 Integration: Auto-post CREDIT entry to Customer Ledger
  try {
    const ledgerService = require('./ledger.service');
    await ledgerService.postEntry({
      customerId: payment.customer,
      entryDate: payment.paymentDate,
      particular: `Payment #${payment.receiptNumber}`,
      entryType: 'CREDIT',
      amount: payment.totalAmount,
      sourceType: 'PAYMENT',
      sourceId: payment._id,
      postedBy: user._id
    });
  } catch (ledgerErr) {
    console.warn('Notice: Ledger posting on payment creation:', ledgerErr.message);
  }

  return await Payment.findById(payment._id)
    .populate('customer', 'customerName mobile city state gstNumber')
    .populate('paymentMode', 'modeName modeCode')
    .populate('allocations.invoice', 'invoiceNumber invoiceDate grandTotal')
    .populate('createdBy', 'fullName username');
};

/**
 * List Payments with filtering, pagination, and dataScope
 */
const getPayments = async (query = {}, scopeFilter = {}) => {
  const filter = { isActive: true, ...scopeFilter };

  if (query.customerId) filter.customer = query.customerId;
  if (query.invoiceId) filter['allocations.invoice'] = query.invoiceId;
  if (query.paymentModeId) filter.paymentMode = query.paymentModeId;
  if (query.entryType) filter.entryType = query.entryType.toUpperCase();

  if (query.from || query.to) {
    filter.paymentDate = {};
    if (query.from) filter.paymentDate.$gte = new Date(query.from);
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = toDate;
    }
  }

  if (query.search) {
    const s = { $regex: query.search.trim(), $options: 'i' };
    filter.$or = [
      { receiptNumber: s },
      { referenceNumber: s },
      { bankCashAccount: s },
      { remarks: s },
      { 'allocations.invoiceNumberSnapshot': s }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'customerName mobile city state')
      .populate('paymentMode', 'modeName modeCode')
      .populate('allocations.invoice', 'invoiceNumber invoiceDate grandTotal')
      .populate('createdBy', 'fullName username')
      .populate('reversalOf', 'receiptNumber paymentDate totalAmount')
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter)
  ]);

  return {
    payments,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get detailed Payment by ID
 */
const getPaymentById = async (id, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };

  const payment = await Payment.findOne(filter)
    .populate('customer')
    .populate('paymentMode')
    .populate('allocations.invoice')
    .populate('createdBy', 'fullName username')
    .populate('updatedBy', 'fullName username')
    .populate('reversedBy', 'fullName username')
    .populate('reversalOf', 'receiptNumber paymentDate totalAmount referenceNumber');

  if (!payment) {
    const err = new Error(`Payment record not found with ID '${id}' or not permitted.`);
    err.statusCode = 404;
    throw err;
  }

  return payment;
};

/**
 * Update non-monetary metadata fields of a Payment
 */
const updatePayment = async (id, data, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const payment = await Payment.findOne(filter);

  if (!payment) {
    const err = new Error(`Payment record not found with ID '${id}' or not permitted.`);
    err.statusCode = 404;
    throw err;
  }

  const { referenceNumber, bankCashAccount, remarks } = data;

  if (referenceNumber !== undefined) payment.referenceNumber = referenceNumber ? referenceNumber.trim() : null;
  if (bankCashAccount !== undefined) payment.bankCashAccount = bankCashAccount ? bankCashAccount.trim() : null;
  if (remarks !== undefined) payment.remarks = remarks ? remarks.trim() : null;

  payment.updatedBy = user._id;
  await payment.save();

  return await Payment.findById(payment._id)
    .populate('customer', 'customerName mobile')
    .populate('paymentMode', 'modeName')
    .populate('createdBy', 'fullName username')
    .populate('updatedBy', 'fullName username');
};

/**
 * Reverse a Payment (creates an offsetting REVERSAL entry, keeping original untouched)
 * Requires double gate: PAYMENT.delete AND PAYMENT.approve
 */
const reversePayment = async (id, data, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const originalPayment = await Payment.findOne(filter);

  if (!originalPayment) {
    const err = new Error(`Payment record not found with ID '${id}' or not permitted.`);
    err.statusCode = 404;
    throw err;
  }

  if (originalPayment.entryType === 'REVERSAL') {
    const err = new Error('Cannot reverse a REVERSAL entry.');
    err.statusCode = 400;
    throw err;
  }

  const existingReversal = await Payment.findOne({
    reversalOf: originalPayment._id,
    isActive: true
  });
  if (existingReversal) {
    const err = new Error(`Payment '${originalPayment.receiptNumber}' has already been reversed under receipt '${existingReversal.receiptNumber}'.`);
    err.statusCode = 400;
    throw err;
  }

  const { reason } = data;
  if (!reason || !reason.trim()) {
    const err = new Error('A mandatory reason is required to reverse a payment.');
    err.statusCode = 400;
    throw err;
  }

  // Generate atomic receipt number for the reversal entry
  const receiptNumber = await PaymentReceiptNumberSequence.generateNextNumber();

  // Create REVERSAL record
  const reversalPayment = new Payment({
    receiptNumber,
    paymentDate: new Date(),
    customer: originalPayment.customer,
    paymentMode: originalPayment.paymentMode,
    totalAmount: originalPayment.totalAmount,
    allocations: originalPayment.allocations,
    referenceNumber: originalPayment.referenceNumber,
    bankCashAccount: originalPayment.bankCashAccount,
    remarks: `REVERSAL of ${originalPayment.receiptNumber}: ${reason.trim()}`,
    entryType: 'REVERSAL',
    reversalOf: originalPayment._id,
    reversalReason: reason.trim(),
    reversedAt: new Date(),
    reversedBy: user._id,
    isActive: true,
    createdBy: user._id
  });

  await reversalPayment.save();

  // Module 13 Integration: Auto-post DEBIT entry to Customer Ledger for Payment Reversal
  try {
    const ledgerService = require('./ledger.service');
    await ledgerService.postEntry({
      customerId: originalPayment.customer,
      entryDate: new Date(),
      particular: `Payment Reversal #${reversalPayment.receiptNumber}`,
      entryType: 'DEBIT',
      amount: originalPayment.totalAmount,
      sourceType: 'PAYMENT_REVERSAL',
      sourceId: reversalPayment._id,
      remarks: reason.trim(),
      postedBy: user._id
    });
  } catch (ledgerErr) {
    console.warn('Notice: Ledger posting on payment reversal:', ledgerErr.message);
  }

  return await Payment.findById(reversalPayment._id)
    .populate('customer', 'customerName mobile')
    .populate('paymentMode', 'modeName')
    .populate('reversalOf', 'receiptNumber totalAmount paymentDate')
    .populate('createdBy', 'fullName username');
};

/**
 * Get render-ready Payment Receipt dataset
 */
const getReceiptData = async (id, scopeFilter = {}) => {
  const payment = await getPaymentById(id, scopeFilter);
  const ownCompany = await Company.findOne({ companyType: 'OWN', isActive: true });

  const allocationRows = [];
  for (const alloc of payment.allocations) {
    const invId = alloc.invoice?._id || alloc.invoice;
    let liveBal = 0;
    let invDate = null;
    let grandTotal = 0;

    try {
      const b = await getBalanceDue(invId);
      liveBal = b.balanceDue;
      grandTotal = b.grandTotal;
      if (alloc.invoice && alloc.invoice.invoiceDate) {
        invDate = alloc.invoice.invoiceDate;
      }
    } catch (e) {
      grandTotal = alloc.allocatedAmount;
    }

    allocationRows.push({
      invoiceId: invId,
      invoiceNumber: alloc.invoiceNumberSnapshot || alloc.invoice?.invoiceNumber || 'N/A',
      invoiceDate: invDate,
      invoiceGrandTotal: grandTotal,
      allocatedAmount: alloc.allocatedAmount,
      remainingBalanceDue: liveBal
    });
  }

  return {
    letterhead: {
      companyName: ownCompany?.companyName || 'Maitri Ceramic',
      logo: ownCompany?.logo || null,
      gstNumber: ownCompany?.gstNumber || 'N/A',
      address: ownCompany?.address || 'Morbi, Gujarat',
      contactPerson: ownCompany?.contactPerson || '',
      contactMobile: ownCompany?.contactMobile || ''
    },
    receipt: {
      receiptNumber: payment.receiptNumber,
      paymentDate: payment.paymentDate,
      entryType: payment.entryType,
      reversalOf: payment.reversalOf ? payment.reversalOf.receiptNumber : null,
      reversalReason: payment.reversalReason,
      customerName: payment.customer?.customerName || 'N/A',
      customerMobile: payment.customer?.mobile || 'N/A',
      customerAddress: payment.customer?.billingAddress || payment.customer?.city || 'N/A',
      customerGstNumber: payment.customer?.gstNumber || 'N/A',
      paymentModeName: payment.paymentMode?.modeName || 'N/A',
      referenceNumber: payment.referenceNumber || 'N/A',
      bankCashAccount: payment.bankCashAccount || 'N/A',
      remarks: payment.remarks || '',
      totalAmount: payment.totalAmount,
      amountInWords: amountToWords(payment.totalAmount),
      allocations: allocationRows
    },
    authorizedSignatory: ownCompany?.companyName || 'Maitri Ceramic'
  };
};

/**
 * Customer-level live outstanding aggregation across all invoices
 * Formula: Total Invoiced - Total Paid = Total Outstanding
 */
const getCustomerOutstanding = async (customerId) => {
  const customer = await Customer.findOne({ _id: customerId, isActive: true });
  if (!customer) {
    const err = new Error(`Customer not found with ID '${customerId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const invoices = await Invoice.find({
    customer: customerId,
    status: 'ISSUED',
    isActive: true
  });

  let totalInvoiced = 0;
  let totalPaid = 0;

  for (const inv of invoices) {
    totalInvoiced += Number(inv.grandTotal) || 0;
    const b = await getBalanceDue(inv._id);
    totalPaid += b.paymentReceived;
  }

  totalInvoiced = Math.round(totalInvoiced * 100) / 100;
  totalPaid = Math.round(totalPaid * 100) / 100;
  const totalOutstanding = Math.max(0, Math.round((totalInvoiced - totalPaid) * 100) / 100);

  return {
    customerId: customer._id,
    customerName: customer.customerName,
    customerMobile: customer.mobile,
    totalSales: totalInvoiced,
    totalInvoiced,
    totalPaid,
    totalOutstanding,
    credit: 0,
    debit: 0
  };
};

/**
 * Consumed by Module 4: Customer 360° History
 */
const getByCustomer = async (customerId) => {
  try {
    const payments = await Payment.find({
      customer: customerId,
      isActive: true
    })
      .populate('paymentMode', 'modeName')
      .sort({ paymentDate: -1, createdAt: -1 })
      .lean();

    return payments.map((p) => ({
      _id: p._id,
      receiptNumber: p.receiptNumber,
      paymentDate: p.paymentDate,
      totalAmount: p.totalAmount,
      amountPaid: p.entryType === 'PAYMENT' ? p.totalAmount : -p.totalAmount,
      entryType: p.entryType,
      paymentMode: p.paymentMode?.modeName || 'N/A',
      referenceNumber: p.referenceNumber,
      allocations: (p.allocations || []).map((a) => ({
        invoiceId: a.invoice,
        invoiceNumber: a.invoiceNumberSnapshot,
        allocatedAmount: a.allocatedAmount
      }))
    }));
  } catch (err) {
    console.warn('Error in paymentService.getByCustomer:', err.message);
    return [];
  }
};

/**
 * Export Payments to Excel
 */
const exportPaymentsToExcel = async (query = {}, scopeFilter = {}) => {
  const filter = { isActive: true, ...scopeFilter };

  if (query.customerId) filter.customer = query.customerId;
  if (query.entryType) filter.entryType = query.entryType.toUpperCase();

  const payments = await Payment.find(filter)
    .populate('customer', 'customerName mobile')
    .populate('paymentMode', 'modeName')
    .populate('createdBy', 'fullName username')
    .sort({ paymentDate: -1 })
    .lean();

  const exportRows = [];

  payments.forEach((p) => {
    (p.allocations || []).forEach((a, idx) => {
      exportRows.push({
        'Receipt Number': p.receiptNumber,
        'Date': new Date(p.paymentDate).toLocaleDateString('en-IN'),
        'Customer Name': p.customer?.customerName || 'N/A',
        'Customer Mobile': p.customer?.mobile || 'N/A',
        'Entry Type': p.entryType,
        'Payment Mode': p.paymentMode?.modeName || 'N/A',
        'Reference Number': p.referenceNumber || '',
        'Bank/Cash Account': p.bankCashAccount || '',
        'Total Receipt Amount': p.totalAmount,
        'Allocated Invoice #': a.invoiceNumberSnapshot || 'N/A',
        'Allocated Amount': a.allocatedAmount,
        'Remarks': p.remarks || '',
        'Created By': p.createdBy?.fullName || 'N/A'
      });
    });
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  getBalanceDue,
  hasPayments,
  getReceivedAmount,
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  reversePayment,
  getReceiptData,
  getCustomerOutstanding,
  getByCustomer,
  exportPaymentsToExcel
};
