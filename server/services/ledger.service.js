const mongoose = require('mongoose');
const XLSX = require('xlsx');
const LedgerEntry = require('../models/LedgerEntry');
const Customer = require('../models/Customer');

/**
 * Core Inbound / Internal posting service
 * Called internally by Modules 10, 11, 12, or by Manual Entry handlers.
 *
 * @param {Object} params
 * @param {ObjectId|String} params.customerId
 * @param {Date|String} [params.entryDate=Date.now()]
 * @param {String} params.particular
 * @param {'DEBIT'|'CREDIT'} params.entryType
 * @param {Number} params.amount
 * @param {'INVOICE'|'PAYMENT'|'PAYMENT_REVERSAL'|'SALES_RETURN'|'MANUAL'|'MANUAL_REVERSAL'} params.sourceType
 * @param {ObjectId|String} [params.sourceId=null]
 * @param {ObjectId|String} [params.reversalOf=null]
 * @param {String} [params.remarks=null]
 * @param {ObjectId|String} params.postedBy
 * @param {Object} [options={}]
 * @param {ClientSession} [options.session]
 * @returns {Promise<Document>} Saved LedgerEntry
 */
const postEntry = async (params, options = {}) => {
  const {
    customerId,
    entryDate = new Date(),
    particular,
    entryType,
    amount,
    sourceType,
    sourceId = null,
    reversalOf = null,
    remarks = null,
    postedBy
  } = params;

  // 1. Mandatory Validations
  if (!customerId) {
    const err = new Error('Customer ID is required for ledger posting.');
    err.statusCode = 400;
    throw err;
  }

  if (!particular || !particular.trim()) {
    const err = new Error('Particular description is required for ledger posting.');
    err.statusCode = 400;
    throw err;
  }

  if (!['DEBIT', 'CREDIT'].includes(entryType)) {
    const err = new Error("Entry type must be either 'DEBIT' or 'CREDIT'.");
    err.statusCode = 400;
    throw err;
  }

  const cleanAmount = Math.round(Number(amount) * 100) / 100;
  if (isNaN(cleanAmount) || cleanAmount <= 0) {
    const err = new Error('Ledger entry amount must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  if (!postedBy) {
    const err = new Error('Posted by user reference is required.');
    err.statusCode = 400;
    throw err;
  }

  const validSourceTypes = [
    'INVOICE',
    'PAYMENT',
    'PAYMENT_REVERSAL',
    'SALES_RETURN',
    'MANUAL',
    'MANUAL_REVERSAL'
  ];
  if (!validSourceTypes.includes(sourceType)) {
    const err = new Error(`Invalid sourceType '${sourceType}' for ledger posting.`);
    err.statusCode = 400;
    throw err;
  }

  // Section 12 Rule 4: Automated entries must carry a valid sourceId
  const isManual = sourceType === 'MANUAL' || sourceType === 'MANUAL_REVERSAL';
  if (!isManual && !sourceId) {
    const err = new Error(`Automated ledger entry of type '${sourceType}' requires a valid sourceId.`);
    err.statusCode = 400;
    throw err;
  }

  const session = options.session || null;

  // 2. Fetch the most recent prior active entry for this customer
  const lastEntryQuery = LedgerEntry.findOne({
    customer: customerId,
    isActive: true
  }).sort({ entryDate: -1, createdAt: -1 });

  if (session) lastEntryQuery.session(session);
  const lastEntry = await lastEntryQuery;

  const previousBalance = lastEntry ? Number(lastEntry.runningBalance) || 0 : 0;

  // Section 7: Running balance formula
  // Positive balance = customer owes money (DEBIT increases, CREDIT decreases)
  const delta = entryType === 'DEBIT' ? cleanAmount : -cleanAmount;
  const runningBalance = Math.round((previousBalance + delta) * 100) / 100;

  // 3. Assemble and save the immutable LedgerEntry
  const entryDoc = new LedgerEntry({
    customer: customerId,
    entryDate: entryDate ? new Date(entryDate) : new Date(),
    particular: particular.trim(),
    entryType,
    amount: cleanAmount,
    runningBalance,
    sourceType,
    sourceId: sourceId || null,
    reversalOf: reversalOf || null,
    remarks: remarks ? remarks.trim() : null,
    postedBy,
    isActive: true
  });

  if (session) {
    await entryDoc.save({ session });
  } else {
    await entryDoc.save();
  }

  return entryDoc;
};

/**
 * Get current balance for a customer
 * @param {ObjectId|String} customerId
 * @returns {Promise<{ currentBalance: Number, asOfEntryDate: Date|null }>}
 */
const getCurrentBalance = async (customerId) => {
  const lastEntry = await LedgerEntry.findOne({
    customer: customerId,
    isActive: true
  }).sort({ entryDate: -1, createdAt: -1 });

  if (!lastEntry) {
    return {
      currentBalance: 0,
      asOfEntryDate: null
    };
  }

  return {
    currentBalance: Number(lastEntry.runningBalance) || 0,
    asOfEntryDate: lastEntry.entryDate
  };
};

/**
 * Get chronological ledger entries for a customer with filtering and pagination
 * @param {ObjectId|String} customerId
 * @param {Object} [query={}]
 * @returns {Promise<Object>}
 */
const getByCustomer = async (customerId, query = {}) => {
  const filter = { customer: customerId, isActive: true };

  if (query.entryType) {
    filter.entryType = query.entryType.toUpperCase();
  }
  if (query.sourceType) {
    filter.sourceType = query.sourceType.toUpperCase();
  }

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = toDate;
    }
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(500, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;

  const [customer, entries, total, balanceInfo] = await Promise.all([
    Customer.findById(customerId).select('customerName mobile city state gstNumber').lean(),
    LedgerEntry.find(filter)
      .populate('postedBy', 'name email mobile role')
      .populate('reversalOf', 'particular entryDate amount entryType')
      .sort({ entryDate: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    LedgerEntry.countDocuments(filter),
    getCurrentBalance(customerId)
  ]);

  if (!customer) {
    const err = new Error(`Customer not found with ID '${customerId}'.`);
    err.statusCode = 404;
    throw err;
  }

  // Compute total Debit and Credit in current filtered view
  let totalDebit = 0;
  let totalCredit = 0;
  entries.forEach((e) => {
    if (e.entryType === 'DEBIT') totalDebit += e.amount;
    if (e.entryType === 'CREDIT') totalCredit += e.amount;
  });

  return {
    customer,
    currentBalance: balanceInfo.currentBalance,
    asOfEntryDate: balanceInfo.asOfEntryDate,
    summary: {
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      netChange: Math.round((totalDebit - totalCredit) * 100) / 100
    },
    entries,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Generate render-ready statement for a customer between two dates
 * @param {ObjectId|String} customerId
 * @param {Object} [query={}] { from, to }
 */
const getCustomerStatement = async (customerId, query = {}) => {
  const customer = await Customer.findById(customerId)
    .select('customerName mobile alternateNumber email billingAddress shippingAddress city state gstNumber')
    .lean();

  if (!customer) {
    const err = new Error(`Customer not found with ID '${customerId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const fromDate = query.from ? new Date(query.from) : null;
  const toDate = query.to ? new Date(query.to) : null;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  // 1. Calculate Opening Balance before fromDate
  let openingBalance = 0;
  if (fromDate) {
    const priorEntry = await LedgerEntry.findOne({
      customer: customerId,
      isActive: true,
      entryDate: { $lt: fromDate }
    }).sort({ entryDate: -1, createdAt: -1 });

    if (priorEntry) {
      openingBalance = Number(priorEntry.runningBalance) || 0;
    }
  }

  // 2. Fetch all entries within the period
  const periodFilter = { customer: customerId, isActive: true };
  if (fromDate || toDate) {
    periodFilter.entryDate = {};
    if (fromDate) periodFilter.entryDate.$gte = fromDate;
    if (toDate) periodFilter.entryDate.$lte = toDate;
  }

  const entries = await LedgerEntry.find(periodFilter)
    .populate('postedBy', 'name fullName username')
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  // 3. Compute running tally for statement display
  let runningTally = openingBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const statementRows = entries.map((e) => {
    const debit = e.entryType === 'DEBIT' ? e.amount : null;
    const credit = e.entryType === 'CREDIT' ? e.amount : null;

    if (debit) totalDebit += debit;
    if (credit) totalCredit += credit;
    runningTally = Math.round((runningTally + (debit || 0) - (credit || 0)) * 100) / 100;

    return {
      _id: e._id,
      entryDate: e.entryDate,
      particular: e.particular,
      debit,
      credit,
      balance: runningTally,
      sourceType: e.sourceType,
      remarks: e.remarks,
      postedBy: e.postedBy?.name || e.postedBy?.fullName || 'System'
    };
  });

  const closingBalance = Math.round((openingBalance + totalDebit - totalCredit) * 100) / 100;

  return {
    customer,
    period: {
      from: fromDate,
      to: toDate
    },
    openingBalance: Math.round(openingBalance * 100) / 100,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    closingBalance,
    entries: statementRows
  };
};

/**
 * Create a Manual Credit / Debit entry
 * Gated by CUSTOMER_LEDGER:create AND CUSTOMER_LEDGER:approve
 */
const createManualEntry = async (data, user) => {
  const { customerId, entryDate, entryType, amount, particular, remarks } = data;

  const customer = await Customer.findOne({ _id: customerId, isActive: true });
  if (!customer) {
    const err = new Error(`Active customer not found with ID '${customerId}'.`);
    err.statusCode = 404;
    throw err;
  }

  return await postEntry({
    customerId: customer._id,
    entryDate: entryDate ? new Date(entryDate) : new Date(),
    particular: particular ? particular.trim() : `Manual ${entryType} Adjustment`,
    entryType,
    amount,
    sourceType: 'MANUAL',
    sourceId: null,
    remarks: remarks ? remarks.trim() : null,
    postedBy: user._id
  });
};

/**
 * Reverse a Manual Entry only
 * Gated by CUSTOMER_LEDGER:delete AND CUSTOMER_LEDGER:approve
 * Section 12 Rule 6: Rejection if target is not MANUAL
 */
const reverseManualEntry = async (id, data, user) => {
  const targetEntry = await LedgerEntry.findOne({ _id: id, isActive: true });

  if (!targetEntry) {
    const err = new Error(`Ledger entry not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  // Rule 6: Strictly restrict reversal to MANUAL entries
  if (targetEntry.sourceType !== 'MANUAL') {
    const err = new Error(
      `Cannot reverse an automated '${targetEntry.sourceType}' ledger entry directly. Corrections must be made at the source document level (e.g. Invoice cancellation, Payment reversal, or Sales Return).`
    );
    err.statusCode = 400;
    throw err;
  }

  // Prevent double reversals
  const existingReversal = await LedgerEntry.findOne({
    reversalOf: targetEntry._id,
    isActive: true
  });
  if (existingReversal) {
    const err = new Error(`Manual entry '${targetEntry.particular}' has already been reversed.`);
    err.statusCode = 400;
    throw err;
  }

  const oppositeType = targetEntry.entryType === 'DEBIT' ? 'CREDIT' : 'DEBIT';

  return await postEntry({
    customerId: targetEntry.customer,
    entryDate: new Date(),
    particular: `Reversal of Manual Entry: ${targetEntry.particular}`,
    entryType: oppositeType,
    amount: targetEntry.amount,
    sourceType: 'MANUAL_REVERSAL',
    sourceId: null,
    reversalOf: targetEntry._id,
    remarks: data.reason ? data.reason.trim() : 'Manual entry reversal',
    postedBy: user._id
  });
};

/**
 * Export Customer Ledger Statement or Credit-Debit Report to Excel (.xlsx)
 */
const exportLedgerToExcel = async (query = {}) => {
  const { customerId, from, to, reportType = 'statement' } = query;

  if (!customerId) {
    const err = new Error('Customer ID is required for ledger export.');
    err.statusCode = 400;
    throw err;
  }

  const statement = await getCustomerStatement(customerId, { from, to });
  const workbook = XLSX.utils.book_new();

  const exportRows = statement.entries.map((e, idx) => ({
    'Sr. No.': idx + 1,
    'Date': e.entryDate ? new Date(e.entryDate).toLocaleDateString('en-IN') : '',
    'Particular': e.particular,
    'Debit (₹)': e.debit !== null ? e.debit : '',
    'Credit (₹)': e.credit !== null ? e.credit : '',
    'Balance (₹)': e.balance,
    'Type': e.sourceType,
    'Remarks': e.remarks || '',
    'Posted By': e.postedBy
  }));

  // Prepend Opening Balance row
  exportRows.unshift({
    'Sr. No.': 0,
    'Date': statement.period.from ? new Date(statement.period.from).toLocaleDateString('en-IN') : 'Beginning',
    'Particular': 'Opening Balance',
    'Debit (₹)': '',
    'Credit (₹)': '',
    'Balance (₹)': statement.openingBalance,
    'Type': 'OPENING_BALANCE',
    'Remarks': '',
    'Posted By': 'System'
  });

  // Append Summary row
  exportRows.push({
    'Sr. No.': '',
    'Date': 'TOTAL / CLOSING',
    'Particular': `Closing Balance: ₹${statement.closingBalance}`,
    'Debit (₹)': statement.totalDebit,
    'Credit (₹)': statement.totalCredit,
    'Balance (₹)': statement.closingBalance,
    'Type': 'CLOSING_BALANCE',
    'Remarks': '',
    'Posted By': ''
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Ledger');

  return {
    workbook,
    filename: `Customer_Ledger_${(statement.customer.customerName || 'Customer').replace(/\s+/g, '_')}_${Date.now()}.xlsx`
  };
};

module.exports = {
  postEntry,
  getCurrentBalance,
  getByCustomer,
  getCustomerStatement,
  createManualEntry,
  reverseManualEntry,
  exportLedgerToExcel
};
