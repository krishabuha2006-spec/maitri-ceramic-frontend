const mongoose = require('mongoose');
const XLSX = require('xlsx');

// Models
const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const FollowUp = require('../models/FollowUp');
const Product = require('../models/Product');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const Challan = require('../models/Challan');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const LedgerEntry = require('../models/LedgerEntry');
const SavedReportFilter = require('../models/SavedReportFilter');
const ReportExportJob = require('../models/ReportExportJob');

// Service dependencies
const customerHistoryService = require('./customerHistory.service');
const paymentService = require('./payment.service');
const ledgerService = require('./ledger.service');
const productTrackingService = require('./productQuotationTracking.service');
const stockService = require('./stock.service');

/**
 * Standard Pagination & Filter Parser
 */
const parseReportPagination = (query = {}) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 50, 1), 200);
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' || query.sortOrder === '1' ? 1 : -1;
  const format = (query.format || 'json').toLowerCase();

  return { page, limit, skip, sortBy, sortOrder, format };
};

/**
 * Standard Report Response Envelope
 */
const buildReportResponse = (data, totalRecords, page, limit, summary = null) => {
  return {
    data,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1
    },
    ...(summary ? { summary } : {})
  };
};

/**
 * Convert JSON array to Excel Workbook Buffer
 */
const generateExcelBuffer = (data = [], sheetName = 'Report', summary = null) => {
  const workbook = XLSX.utils.book_new();
  const rows = [...data];

  if (summary && typeof summary === 'object') {
    rows.push({});
    rows.push({
      ...summary,
      _isSummaryRow: true
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * ---------------------------------------------------------------------------
 * REPORT CATALOG DISCOVERY
 * ---------------------------------------------------------------------------
 */
const REPORT_DEFINITIONS = [
  {
    category: 'CUSTOMER_REPORTS',
    categoryName: 'Customer Reports',
    requiredModule: 'CUSTOMER',
    reports: [
      { key: 'CUSTOMER_LIST', name: 'Customer List', endpoint: '/api/reports/customers/list' },
      { key: 'CUSTOMER_HISTORY', name: 'Customer 360 History', endpoint: '/api/reports/customers/:id/history' },
      { key: 'CUSTOMER_PURCHASE_HISTORY', name: 'Customer Purchase History', endpoint: '/api/reports/customers/:id/purchase-history' },
      { key: 'CUSTOMER_OUTSTANDING', name: 'Customer Outstanding', endpoint: '/api/reports/customers/outstanding' },
      { key: 'CUSTOMER_LEDGER', name: 'Customer Ledger', endpoint: '/api/reports/customers/:id/ledger', requiredModule: 'CUSTOMER_LEDGER' }
    ]
  },
  {
    category: 'QUOTATION_REPORTS',
    categoryName: 'Quotation Reports',
    requiredModule: 'QUOTATION',
    reports: [
      { key: 'QUOTATION_ALL', name: 'All Quotations', endpoint: '/api/reports/quotations/all' },
      { key: 'QUOTATION_PENDING', name: 'Pending Quotations', endpoint: '/api/reports/quotations/pending' },
      { key: 'QUOTATION_FOLLOWUP_PENDING', name: 'Follow-Up Pending', endpoint: '/api/reports/quotations/followup-pending' },
      { key: 'QUOTATION_FOLLOWUP_DUE', name: 'Follow-Up Due', endpoint: '/api/reports/quotations/followup-due' },
      { key: 'QUOTATION_CONFIRMED', name: 'Confirmed Quotations', endpoint: '/api/reports/quotations/confirmed' },
      { key: 'QUOTATION_REJECTED', name: 'Rejected Quotations', endpoint: '/api/reports/quotations/rejected' },
      { key: 'QUOTATION_EXPIRED', name: 'Expired Quotations', endpoint: '/api/reports/quotations/expired' },
      { key: 'QUOTATION_CONVERSION', name: 'Quotation Conversion', endpoint: '/api/reports/quotations/conversion' },
      { key: 'QUOTATION_AMOUNT_VS_ACTUAL', name: 'Quotation Amount vs Actual Amount', endpoint: '/api/reports/quotations/amount-vs-actual' }
    ]
  },
  {
    category: 'PRODUCT_REPORTS',
    categoryName: 'Product Reports',
    requiredModule: 'PRODUCT_MASTER',
    reports: [
      { key: 'PRODUCT_MASTER', name: 'Product Master', endpoint: '/api/reports/products/master' },
      { key: 'PRODUCT_QUOTATION_COUNT', name: 'Product-wise Quotation Count', endpoint: '/api/reports/products/quotation-count', requiredModule: 'PRODUCT_QUOTATION_TRACKING' },
      { key: 'PRODUCT_CUSTOMER_LIST', name: 'Product-wise Customer List', endpoint: '/api/reports/products/customer-list', requiredModule: 'PRODUCT_QUOTATION_TRACKING' },
      { key: 'PRODUCT_QUOTATION_VALUE', name: 'Product-wise Quotation Value', endpoint: '/api/reports/products/quotation-value', requiredModule: 'PRODUCT_QUOTATION_TRACKING' },
      { key: 'PRODUCT_STOCK', name: 'Product Stock', endpoint: '/api/reports/products/stock', requiredModule: 'STOCK' },
      { key: 'PRODUCT_LOW_STOCK', name: 'Low Stock', endpoint: '/api/reports/products/low-stock', requiredModule: 'STOCK' },
      { key: 'PRODUCT_REORDER_ITEMS', name: 'Reorder Items', endpoint: '/api/reports/products/reorder-items', requiredModule: 'STOCK' }
    ]
  },
  {
    category: 'STOCK_REPORTS',
    categoryName: 'Stock Reports',
    requiredModule: 'STOCK',
    reports: [
      { key: 'STOCK_OPENING', name: 'Opening Stock', endpoint: '/api/reports/stock/opening' },
      { key: 'STOCK_IN', name: 'Stock In', endpoint: '/api/reports/stock/in' },
      { key: 'STOCK_OUT', name: 'Stock Out', endpoint: '/api/reports/stock/out' },
      { key: 'STOCK_CHALLAN_DEDUCTION', name: 'Challan-wise Stock Deduction', endpoint: '/api/reports/stock/challan-deduction' },
      { key: 'STOCK_ACTUAL', name: 'Actual Stock', endpoint: '/api/reports/stock/actual' },
      { key: 'STOCK_MANAGEMENT', name: 'Management Stock', endpoint: '/api/reports/stock/management' },
      { key: 'STOCK_MOVEMENT_HISTORY', name: 'Stock Movement History', endpoint: '/api/reports/stock/movement-history' }
    ]
  },
  {
    category: 'SALES_FINANCIAL_REPORTS',
    categoryName: 'Sales & Financial Reports',
    requiredModule: 'BILLING', // broad group
    reports: [
      { key: 'FINANCE_INVOICES', name: 'Invoice Report', endpoint: '/api/reports/finance/invoices', requiredModule: 'INVOICE' },
      { key: 'FINANCE_PAYMENT_COLLECTION', name: 'Payment Collection', endpoint: '/api/reports/finance/payment-collection', requiredModule: 'PAYMENT' },
      { key: 'FINANCE_PAYMENT_RECEIPTS', name: 'Payment Receipts', endpoint: '/api/reports/finance/payment-receipts', requiredModule: 'PAYMENT' },
      { key: 'FINANCE_OUTSTANDING', name: 'Outstanding Report', endpoint: '/api/reports/finance/outstanding', requiredModule: 'PAYMENT' },
      { key: 'FINANCE_CUSTOMER_LEDGER', name: 'Customer Ledger', endpoint: '/api/reports/finance/customer-ledger', requiredModule: 'CUSTOMER_LEDGER' },
      { key: 'FINANCE_CREDIT_DEBIT', name: 'Credit/Debit Report', endpoint: '/api/reports/finance/credit-debit', requiredModule: 'CUSTOMER_LEDGER' }
    ]
  }
];

const getReportCatalog = async (requestingUser) => {
  if (!requestingUser) return [];

  const isSuperAdmin = requestingUser.role && requestingUser.role.isSystemRole;
  let userPermMap = new Map();

  if (!isSuperAdmin) {
    const systemModules = await SystemModule.find({ isActive: true });
    const modKeyById = new Map();
    for (const m of systemModules) {
      modKeyById.set(String(m._id), m.moduleKey);
    }

    const permissions = await UserPermission.find({
      user: requestingUser._id,
      isActive: true
    });

    for (const p of permissions) {
      const key = modKeyById.get(String(p.module));
      if (key && p.actions && p.actions.view) {
        userPermMap.set(key, true);
      }
    }
  }

  const catalog = REPORT_DEFINITIONS.map((cat) => {
    const catModule = cat.requiredModule;
    const hasCategoryAccess = isSuperAdmin || (catModule === 'BILLING' ? true : userPermMap.has(catModule));

    const reports = cat.reports.map((r) => {
      const targetModule = r.requiredModule || cat.requiredModule;
      const canAccess = isSuperAdmin || userPermMap.has(targetModule);
      return {
        ...r,
        hasAccess: canAccess
      };
    });

    return {
      category: cat.category,
      categoryName: cat.categoryName,
      hasAccess: hasCategoryAccess,
      reports
    };
  });

  return catalog;
};

/**
 * ---------------------------------------------------------------------------
 * CUSTOMER REPORTS
 * ---------------------------------------------------------------------------
 */
const getCustomerListReport = async (query = {}, requestingUser, scopeFilter = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = { isActive: true, ...scopeFilter };

  if (query.customerType) filter.customerType = query.customerType;
  if (query.city) filter.city = { $regex: query.city, $options: 'i' };
  if (query.search) {
    filter.$or = [
      { customerName: { $regex: query.search, $options: 'i' } },
      { mobile: { $regex: query.search, $options: 'i' } },
      { gstNumber: { $regex: query.search, $options: 'i' } }
    ];
  }

  const [customers, totalRecords] = await Promise.all([
    Customer.find(filter)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'name mobile')
      .lean(),
    Customer.countDocuments(filter)
  ]);

  const data = customers.map((c) => ({
    customerId: c._id,
    customerName: c.customerName,
    mobile: c.mobile,
    email: c.email || '-',
    city: c.city || '-',
    state: c.state || '-',
    customerType: c.customerType,
    gstNumber: c.gstNumber || '-',
    createdAt: c.createdAt
  }));

  return buildReportResponse(data, totalRecords, page, limit);
};

const getCustomerHistoryReport = async (customerId, query = {}, requestingUser) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }
  return await customerHistoryService.getCustomer360History(customer);
};

const getCustomerPurchaseHistoryReport = async (customerId, query = {}, requestingUser) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    const err = new Error('Customer not found');
    err.statusCode = 404;
    throw err;
  }
  const history = await customerHistoryService.getCustomer360History(customer);
  const pWise = history.productHistory?.productWiseHistory || history.productHistory || [];
  return {
    customer: history.profile || customer,
    productHistory: Array.isArray(pWise) ? pWise : []
  };
};

const getCustomerOutstandingReport = async (query = {}, requestingUser) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);

  const customers = await Customer.find({ isActive: true })
    .sort({ customerName: 1 })
    .lean();

  const outstandingList = [];
  let grandTotalOutstanding = 0;

  for (const c of customers) {
    const balObj = await ledgerService.getCurrentBalance(c._id);
    const balance = typeof balObj === 'number' ? balObj : (balObj?.currentBalance || 0);

    if (query.minOutstanding && balance < Number(query.minOutstanding)) {
      continue;
    }
    if (balance > 0 || query.includeZero === 'true') {
      grandTotalOutstanding += balance;
      outstandingList.push({
        customerId: c._id,
        customerName: c.customerName,
        mobile: c.mobile,
        city: c.city || '-',
        customerType: c.customerType,
        outstandingAmount: balance
      });
    }
  }

  // Sort
  if (sortBy === 'outstandingAmount') {
    outstandingList.sort((a, b) => (a.outstandingAmount - b.outstandingAmount) * sortOrder);
  }

  const totalRecords = outstandingList.length;
  const paginatedData = outstandingList.slice(skip, skip + limit);

  return buildReportResponse(paginatedData, totalRecords, page, limit, {
    totalOutstandingAmount: Math.round(grandTotalOutstanding * 100) / 100,
    totalCustomersWithOutstanding: outstandingList.filter((x) => x.outstandingAmount > 0).length
  });
};

const getCustomerLedgerReport = async (customerId, query = {}, requestingUser) => {
  return await ledgerService.getCustomerStatement(customerId, query.from, query.to);
};

/**
 * ---------------------------------------------------------------------------
 * QUOTATION REPORTS
 * ---------------------------------------------------------------------------
 */
const getQuotationsByStatusReport = async (statusFilter, query = {}, requestingUser, scopeFilter = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = { ...scopeFilter };

  if (statusFilter) {
    filter.status = Array.isArray(statusFilter) ? { $in: statusFilter } : statusFilter;
  }

  if (query.from || query.to) {
    filter.quotationDate = {};
    if (query.from) filter.quotationDate.$gte = new Date(query.from);
    if (query.to) filter.quotationDate.$lte = new Date(query.to);
  }

  if (query.customerId) filter.customer = query.customerId;
  if (query.salespersonId) filter.salesperson = query.salespersonId;

  const [quotations, totalRecords] = await Promise.all([
    Quotation.find(filter)
      .populate('customer', 'customerName mobile city')
      .populate('salesperson', 'name mobile')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Quotation.countDocuments(filter)
  ]);

  const totalQuotationValue = quotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  const data = quotations.map((q) => ({
    quotationId: q._id,
    quotationNumber: q.quotationNumber,
    customerName: q.customer?.customerName || '-',
    customerMobile: q.customer?.mobile || '-',
    salespersonName: q.salesperson?.name || '-',
    quotationDate: q.quotationDate || q.createdAt,
    status: q.status,
    totalItems: (q.items || []).length,
    subTotal: q.subTotal || 0,
    totalTax: q.totalTax || 0,
    grandTotal: q.grandTotal || 0
  }));

  return buildReportResponse(data, totalRecords, page, limit, {
    pageTotalValue: Math.round(totalQuotationValue * 100) / 100
  });
};

const getQuotationConversionReport = async (query = {}, requestingUser, scopeFilter = {}) => {
  const filter = { ...scopeFilter };

  if (query.from || query.to) {
    filter.quotationDate = {};
    if (query.from) filter.quotationDate.$gte = new Date(query.from);
    if (query.to) filter.quotationDate.$lte = new Date(query.to);
  }

  const allQuotations = await Quotation.find(filter).lean();
  const totalCount = allQuotations.length;
  const totalQuotedValue = allQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  const confirmedQuotations = allQuotations.filter((q) =>
    ['CONFIRMED', 'PARTIALLY_CONFIRMED', 'CLOSED'].includes(q.status)
  );
  const confirmedCount = confirmedQuotations.length;
  const confirmedValue = confirmedQuotations.reduce((sum, q) => sum + (q.grandTotal || 0), 0);

  const rejectedCount = allQuotations.filter((q) => q.status === 'REJECTED').length;
  const expiredCount = allQuotations.filter((q) => q.status === 'EXPIRED').length;
  const pendingCount = totalCount - confirmedCount - rejectedCount - expiredCount;

  const countConversionRate = totalCount > 0 ? Math.round((confirmedCount / totalCount) * 10000) / 100 : 0;
  const valueConversionRate = totalQuotedValue > 0 ? Math.round((confirmedValue / totalQuotedValue) * 10000) / 100 : 0;

  return {
    summary: {
      totalQuotations: totalCount,
      totalQuotedValue: Math.round(totalQuotedValue * 100) / 100,
      confirmedCount,
      confirmedValue: Math.round(confirmedValue * 100) / 100,
      rejectedCount,
      expiredCount,
      pendingCount,
      conversionRateCountPct: countConversionRate,
      conversionRateValuePct: valueConversionRate
    },
    period: {
      from: query.from || null,
      to: query.to || null
    }
  };
};

const getQuotationAmountVsActualReport = async (query = {}, requestingUser, scopeFilter = {}) => {
  const { page, limit, skip } = parseReportPagination(query);
  const filter = { isActive: true };

  const [confirmations, totalRecords] = await Promise.all([
    QuotationConfirmation.find(filter)
      .populate('quotation', 'quotationNumber quotationDate salesperson')
      .populate('customer', 'customerName mobile')
      .populate('confirmedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    QuotationConfirmation.countDocuments(filter)
  ]);

  const data = confirmations.map((c) => ({
    confirmationId: c._id,
    confirmationNumber: c.confirmationNumber,
    quotationNumber: c.quotation?.quotationNumber || '-',
    customerName: c.customer?.customerName || '-',
    confirmationStatus: c.confirmationStatus,
    originalQuotationAmount: c.originalQuotationAmount || 0,
    confirmedAmount: c.confirmedAmount || 0,
    extraProductAmount: c.extraProductAmount || 0,
    differenceAmount: (c.confirmedAmount || 0) - (c.originalQuotationAmount || 0),
    isFullyDelivered: c.isFullyDelivered || false
  }));

  const totalQuoted = data.reduce((sum, r) => sum + r.originalQuotationAmount, 0);
  const totalConfirmed = data.reduce((sum, r) => sum + r.confirmedAmount, 0);

  return buildReportResponse(data, totalRecords, page, limit, {
    totalOriginalQuoted: Math.round(totalQuoted * 100) / 100,
    totalConfirmed: Math.round(totalConfirmed * 100) / 100,
    netDifference: Math.round((totalConfirmed - totalQuoted) * 100) / 100
  });
};

/**
 * ---------------------------------------------------------------------------
 * PRODUCT REPORTS
 * ---------------------------------------------------------------------------
 */
const getProductMasterReport = async (query = {}, requestingUser) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = { isActive: true };

  if (query.productGroup) filter.productGroup = query.productGroup;
  if (query.company) filter.company = query.company;
  if (query.search) {
    filter.$or = [
      { productName: { $regex: query.search, $options: 'i' } },
      { companySkuCode: { $regex: query.search, $options: 'i' } }
    ];
  }

  const [products, totalRecords] = await Promise.all([
    Product.find(filter)
      .populate('company', 'companyName')
      .populate('productGroup', 'groupName')
      .populate('unit', 'unitCode unitName')
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter)
  ]);

  const data = products.map((p) => ({
    productId: p._id,
    companySkuCode: p.companySkuCode,
    productName: p.productName,
    company: p.company?.companyName || '-',
    productGroup: p.productGroup?.groupName || '-',
    unit: p.unit?.unitCode || '-',
    mrp: p.mrp,
    salePrice: p.salePrice,
    currentStock: p.currentStock || 0,
    reorderAlertQty: p.reorderAlertQty || 0
  }));

  return buildReportResponse(data, totalRecords, page, limit);
};

const getProductStockReport = async (query = {}, requestingUser) => {
  const { page, limit, skip } = parseReportPagination(query);
  const filter = { isActive: true };

  if (query.lowStockOnly === 'true') {
    filter.$expr = { $lte: ['$currentStock', '$reorderAlertQty'] };
  }

  const [products, totalRecords] = await Promise.all([
    Product.find(filter)
      .populate('unit', 'unitCode')
      .sort({ currentStock: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter)
  ]);

  const data = products.map((p) => ({
    productId: p._id,
    companySkuCode: p.companySkuCode,
    productName: p.productName,
    unit: p.unit?.unitCode || '-',
    openingStock: p.openingStock || 0,
    currentStock: p.currentStock || 0,
    reorderAlertQty: p.reorderAlertQty || 0,
    stockStatus: (p.currentStock || 0) <= (p.reorderAlertQty || 0) ? 'LOW_STOCK' : 'ADEQUATE'
  }));

  return buildReportResponse(data, totalRecords, page, limit);
};

/**
 * ---------------------------------------------------------------------------
 * STOCK REPORTS
 * ---------------------------------------------------------------------------
 */
const getStockMovementHistoryReport = async (query = {}, requestingUser) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = {};

  if (query.productId) filter.product = query.productId;
  if (query.direction) filter.direction = query.direction;
  if (query.reason) filter.reason = query.reason;

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }

  const [entries, totalRecords] = await Promise.all([
    StockLedgerEntry.find(filter)
      .populate('product', 'productName companySkuCode')
      .populate('postedBy', 'name')
      .sort({ [sortBy || 'entryDate']: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockLedgerEntry.countDocuments(filter)
  ]);

  const data = entries.map((e) => ({
    entryId: e._id,
    entryDate: e.entryDate,
    productName: e.product?.productName || '-',
    companySkuCode: e.product?.companySkuCode || '-',
    direction: e.direction,
    quantity: e.quantity,
    reason: e.reason,
    balanceAfter: e.balanceAfter,
    postedBy: e.postedBy?.name || 'System',
    remarks: e.remarks || '-'
  }));

  return buildReportResponse(data, totalRecords, page, limit);
};

const getStockChallanDeductionReport = async (query = {}, requestingUser) => {
  const { page, limit, skip } = parseReportPagination(query);
  const filter = { reason: 'CHALLAN_ISSUE' };

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }

  const [entries, totalRecords] = await Promise.all([
    StockLedgerEntry.find(filter)
      .populate('product', 'productName companySkuCode')
      .populate('referenceDocId')
      .populate('postedBy', 'name')
      .sort({ entryDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    StockLedgerEntry.countDocuments(filter)
  ]);

  const data = entries.map((e) => ({
    entryId: e._id,
    entryDate: e.entryDate,
    challanId: e.referenceDocId?._id || e.referenceDocId,
    challanNumber: e.referenceDocId?.challanNumber || '-',
    productName: e.product?.productName || '-',
    companySkuCode: e.product?.companySkuCode || '-',
    quantityDeducted: e.quantity,
    balanceAfter: e.balanceAfter,
    postedBy: e.postedBy?.name || 'System'
  }));

  return buildReportResponse(data, totalRecords, page, limit);
};

/**
 * ---------------------------------------------------------------------------
 * SALES & FINANCIAL REPORTS
 * ---------------------------------------------------------------------------
 */
const getInvoicesReport = async (query = {}, requestingUser, scopeFilter = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = { isActive: true, ...scopeFilter };

  if (query.from || query.to) {
    filter.invoiceDate = {};
    if (query.from) filter.invoiceDate.$gte = new Date(query.from);
    if (query.to) filter.invoiceDate.$lte = new Date(query.to);
  }

  if (query.customerId) filter.customer = query.customerId;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;

  const [invoices, totalRecords] = await Promise.all([
    Invoice.find(filter)
      .populate('customer', 'customerName mobile city')
      .sort({ [sortBy || 'invoiceDate']: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter)
  ]);

  const totalGrandTotal = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalBalanceDue = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);

  const data = invoices.map((inv) => ({
    invoiceId: inv._id,
    invoiceNumber: inv.invoiceNumber,
    customerName: inv.customer?.customerName || '-',
    customerMobile: inv.customer?.mobile || '-',
    invoiceDate: inv.invoiceDate,
    subTotal: inv.subTotal,
    totalTax: inv.totalTax,
    grandTotal: inv.grandTotal,
    paidAmount: inv.paidAmount,
    balanceDue: inv.balanceDue,
    paymentStatus: inv.paymentStatus
  }));

  return buildReportResponse(data, totalRecords, page, limit, {
    totalInvoiceValue: Math.round(totalGrandTotal * 100) / 100,
    totalPaidAmount: Math.round(totalPaid * 100) / 100,
    totalOutstanding: Math.round(totalBalanceDue * 100) / 100
  });
};

const getPaymentCollectionReport = async (query = {}, requestingUser, scopeFilter = {}) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = { isActive: true, ...scopeFilter };

  if (query.from || query.to) {
    filter.paymentDate = {};
    if (query.from) filter.paymentDate.$gte = new Date(query.from);
    if (query.to) filter.paymentDate.$lte = new Date(query.to);
  }

  if (query.customerId) filter.customer = query.customerId;
  if (query.paymentModeId) filter.paymentMode = query.paymentModeId;

  const [payments, totalRecords] = await Promise.all([
    Payment.find(filter)
      .populate('customer', 'customerName mobile')
      .populate('paymentMode', 'modeName')
      .populate('createdBy', 'name')
      .sort({ [sortBy || 'paymentDate']: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter)
  ]);

  const totalCollected = payments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);

  const data = payments.map((p) => ({
    paymentId: p._id,
    receiptNumber: p.receiptNumber,
    customerName: p.customer?.customerName || '-',
    paymentDate: p.paymentDate,
    paymentMode: p.paymentMode?.modeName || '-',
    totalAmount: p.totalAmount,
    referenceNumber: p.referenceNumber || '-',
    entryType: p.entryType || 'PAYMENT',
    collectedBy: p.createdBy?.name || '-'
  }));

  return buildReportResponse(data, totalRecords, page, limit, {
    totalCollectedAmount: Math.round(totalCollected * 100) / 100
  });
};

const getCreditDebitReport = async (query = {}, requestingUser) => {
  const { page, limit, skip, sortBy, sortOrder } = parseReportPagination(query);
  const filter = { isActive: true };

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) filter.entryDate.$lte = new Date(query.to);
  }

  if (query.customerId) filter.customer = query.customerId;
  if (query.entryType) filter.entryType = query.entryType;

  const [entries, totalRecords] = await Promise.all([
    LedgerEntry.find(filter)
      .populate('customer', 'customerName mobile')
      .populate('postedBy', 'name')
      .sort({ [sortBy || 'entryDate']: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    LedgerEntry.countDocuments(filter)
  ]);

  const totalDebit = entries
    .filter((e) => e.entryType === 'DEBIT')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalCredit = entries
    .filter((e) => e.entryType === 'CREDIT')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const data = entries.map((e) => ({
    entryId: e._id,
    entryDate: e.entryDate,
    customerName: e.customer?.customerName || '-',
    particular: e.particular,
    entryType: e.entryType,
    amount: e.amount,
    runningBalance: e.runningBalance,
    sourceType: e.sourceType,
    postedBy: e.postedBy?.name || 'System'
  }));

  return buildReportResponse(data, totalRecords, page, limit, {
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    netBalanceDifference: Math.round((totalDebit - totalCredit) * 100) / 100
  });
};

/**
 * ---------------------------------------------------------------------------
 * SAVED FILTERS CRUD (User-scoped)
 * ---------------------------------------------------------------------------
 */
const createSavedFilter = async (data, user) => {
  const { reportKey, filterName, filters } = data;

  if (!reportKey || !filterName) {
    const err = new Error('reportKey and filterName are required.');
    err.statusCode = 400;
    throw err;
  }

  const saved = await SavedReportFilter.create({
    reportKey,
    filterName: filterName.trim(),
    filters: filters || {},
    createdBy: user._id
  });

  return saved;
};

const getSavedFilters = async (query = {}, user) => {
  const filter = { createdBy: user._id, isActive: true };
  if (query.reportKey) filter.reportKey = query.reportKey;

  return await SavedReportFilter.find(filter).sort({ createdAt: -1 }).lean();
};

const deleteSavedFilter = async (id, user) => {
  const filter = await SavedReportFilter.findOne({ _id: id, createdBy: user._id });
  if (!filter) {
    const err = new Error('Saved filter not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  filter.isActive = false;
  await filter.save();
  return { id, deleted: true };
};

/**
 * ---------------------------------------------------------------------------
 * ASYNC EXPORT JOBS
 * ---------------------------------------------------------------------------
 */
const getExportJob = async (jobId, user) => {
  const job = await ReportExportJob.findOne({
    _id: jobId,
    requestedBy: user._id
  });

  if (!job) {
    const err = new Error('Export job not found.');
    err.statusCode = 404;
    throw err;
  }

  return job;
};

module.exports = {
  parseReportPagination,
  buildReportResponse,
  generateExcelBuffer,
  getReportCatalog,

  // Customer Reports
  getCustomerListReport,
  getCustomerHistoryReport,
  getCustomerPurchaseHistoryReport,
  getCustomerOutstandingReport,
  getCustomerLedgerReport,

  // Quotation Reports
  getQuotationsByStatusReport,
  getQuotationConversionReport,
  getQuotationAmountVsActualReport,

  // Product Reports
  getProductMasterReport,
  getProductStockReport,

  // Stock Reports
  getStockMovementHistoryReport,
  getStockChallanDeductionReport,

  // Sales & Financial Reports
  getInvoicesReport,
  getPaymentCollectionReport,
  getCreditDebitReport,

  // Saved Filters
  createSavedFilter,
  getSavedFilters,
  deleteSavedFilter,

  // Async Export Jobs
  getExportJob
};
