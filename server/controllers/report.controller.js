const reportService = require('../services/report.service');
const productTrackingService = require('../services/productQuotationTracking.service');
const stockService = require('../services/stock.service');
const { sendSuccess } = require('../utils/response.util');

/**
 * Helper to handle standard JSON or Excel output
 */
const handleReportOutput = (res, reportResult, sheetName, filenamePrefix, format) => {
  if (format === 'excel') {
    const buffer = reportService.generateExcelBuffer(
      reportResult.data || reportResult,
      sheetName,
      reportResult.summary
    );
    const filename = `${filenamePrefix}_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  }

  return sendSuccess(res, `${sheetName} generated successfully.`, reportResult);
};

/**
 * 1. Discovery Catalog
 */
const getCatalog = async (req, res, next) => {
  try {
    const catalog = await reportService.getReportCatalog(req.user);
    return sendSuccess(res, 'Report catalog retrieved successfully.', catalog);
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Customer Reports
 */
const getCustomerList = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerListReport(req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Customer List', 'Customer_List', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getCustomerHistory = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerHistoryReport(req.params.id, req.query, req.user);
    return handleReportOutput(res, result, 'Customer History', 'Customer_History', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getCustomerPurchaseHistory = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerPurchaseHistoryReport(req.params.id, req.query, req.user);
    return handleReportOutput(res, result.productHistory, 'Purchase History', 'Customer_Purchases', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getCustomerOutstanding = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerOutstandingReport(req.query, req.user);
    return handleReportOutput(res, result, 'Customer Outstanding', 'Customer_Outstanding', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getCustomerLedger = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerLedgerReport(req.params.id, req.query, req.user);
    return handleReportOutput(res, result, 'Customer Ledger', 'Customer_Ledger', req.query.format);
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Quotation Reports
 */
const getAllQuotations = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationsByStatusReport(null, req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'All Quotations', 'Quotations_All', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getPendingQuotations = async (req, res, next) => {
  try {
    const statuses = ['DRAFT', 'SENT', 'FOLLOW_UP_PENDING', 'CUSTOMER_INTERESTED', 'NEGOTIATION'];
    const result = await reportService.getQuotationsByStatusReport(statuses, req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Pending Quotations', 'Quotations_Pending', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFollowupPendingQuotations = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationsByStatusReport('FOLLOW_UP_PENDING', req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Followup Pending', 'Quotations_Followup_Pending', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFollowupDueQuotations = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationsByStatusReport(
      ['FOLLOW_UP_PENDING', 'SENT', 'CUSTOMER_INTERESTED'],
      req.query,
      req.user,
      req.scopeFilter || {}
    );
    return handleReportOutput(res, result, 'Followup Due', 'Quotations_Followup_Due', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getConfirmedQuotations = async (req, res, next) => {
  try {
    const statuses = ['CONFIRMED', 'PARTIALLY_CONFIRMED'];
    const result = await reportService.getQuotationsByStatusReport(statuses, req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Confirmed Quotations', 'Quotations_Confirmed', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getRejectedQuotations = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationsByStatusReport('REJECTED', req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Rejected Quotations', 'Quotations_Rejected', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getExpiredQuotations = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationsByStatusReport('EXPIRED', req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Expired Quotations', 'Quotations_Expired', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getQuotationConversion = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationConversionReport(req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Quotation Conversion', 'Quotation_Conversion', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getQuotationAmountVsActual = async (req, res, next) => {
  try {
    const result = await reportService.getQuotationAmountVsActualReport(req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Amount vs Actual', 'Quotation_Amount_Vs_Actual', req.query.format);
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Product Reports
 */
const getProductMaster = async (req, res, next) => {
  try {
    const result = await reportService.getProductMasterReport(req.query, req.user);
    return handleReportOutput(res, result, 'Product Master', 'Product_Master', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getProductQuotationCount = async (req, res, next) => {
  try {
    const result = await productTrackingService.getMostQuotedProducts(req.query, req.user);
    return handleReportOutput(res, { data: result }, 'Product Quotation Count', 'Product_Quotation_Count', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getProductCustomerList = async (req, res, next) => {
  try {
    const result = await productTrackingService.getCustomersForProduct(req.query.productId, req.user);
    return handleReportOutput(res, { data: result }, 'Quoted Customers', 'Product_Customers', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getProductQuotationValue = async (req, res, next) => {
  try {
    const result = await productTrackingService.getMostQuotedProducts({ ...req.query, sortBy: 'totalQuotedValue' }, req.user);
    return handleReportOutput(res, { data: result }, 'Product Quotation Value', 'Product_Quotation_Value', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getProductStock = async (req, res, next) => {
  try {
    const result = await reportService.getProductStockReport(req.query, req.user);
    return handleReportOutput(res, result, 'Product Stock', 'Product_Stock', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getProductLowStock = async (req, res, next) => {
  try {
    const result = await reportService.getProductStockReport({ ...req.query, lowStockOnly: 'true' }, req.user);
    return handleReportOutput(res, result, 'Low Stock', 'Product_Low_Stock', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getProductReorderItems = async (req, res, next) => {
  try {
    const result = await reportService.getProductStockReport({ ...req.query, lowStockOnly: 'true' }, req.user);
    return handleReportOutput(res, result, 'Reorder Items', 'Product_Reorder_Items', req.query.format);
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Stock Reports
 */
const getStockOpening = async (req, res, next) => {
  try {
    const result = await reportService.getStockMovementHistoryReport({ ...req.query, reason: 'OPENING_STOCK' }, req.user);
    return handleReportOutput(res, result, 'Opening Stock', 'Stock_Opening', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getStockIn = async (req, res, next) => {
  try {
    const result = await reportService.getStockMovementHistoryReport({ ...req.query, direction: 'IN' }, req.user);
    return handleReportOutput(res, result, 'Stock In', 'Stock_In', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getStockOut = async (req, res, next) => {
  try {
    const result = await reportService.getStockMovementHistoryReport({ ...req.query, direction: 'OUT' }, req.user);
    return handleReportOutput(res, result, 'Stock Out', 'Stock_Out', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getStockChallanDeduction = async (req, res, next) => {
  try {
    const result = await reportService.getStockChallanDeductionReport(req.query, req.user);
    return handleReportOutput(res, result, 'Challan Stock Deductions', 'Stock_Challan_Deductions', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getStockActual = async (req, res, next) => {
  try {
    const result = await reportService.getProductStockReport(req.query, req.user);
    return handleReportOutput(res, result, 'Actual Stock', 'Stock_Actual', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getStockManagement = async (req, res, next) => {
  try {
    const result = await reportService.getProductStockReport(req.query, req.user);
    return handleReportOutput(res, result, 'Management Stock', 'Stock_Management', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getStockMovementHistory = async (req, res, next) => {
  try {
    const result = await reportService.getStockMovementHistoryReport(req.query, req.user);
    return handleReportOutput(res, result, 'Stock Movement History', 'Stock_Movement_History', req.query.format);
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Sales & Financial Reports
 */
const getFinanceInvoices = async (req, res, next) => {
  try {
    const result = await reportService.getInvoicesReport(req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Invoices', 'Finance_Invoices', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFinancePaymentCollection = async (req, res, next) => {
  try {
    const result = await reportService.getPaymentCollectionReport(req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Payment Collections', 'Finance_Collections', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFinancePaymentReceipts = async (req, res, next) => {
  try {
    const result = await reportService.getPaymentCollectionReport(req.query, req.user, req.scopeFilter || {});
    return handleReportOutput(res, result, 'Payment Receipts', 'Finance_Receipts', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFinanceOutstanding = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerOutstandingReport(req.query, req.user);
    return handleReportOutput(res, result, 'Outstanding Report', 'Finance_Outstanding', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFinanceCustomerLedger = async (req, res, next) => {
  try {
    const result = await reportService.getCustomerLedgerReport(req.query.customerId, req.query, req.user);
    return handleReportOutput(res, result, 'Customer Ledger', 'Finance_Customer_Ledger', req.query.format);
  } catch (err) {
    next(err);
  }
};

const getFinanceCreditDebit = async (req, res, next) => {
  try {
    const result = await reportService.getCreditDebitReport(req.query, req.user);
    return handleReportOutput(res, result, 'Credit Debit Report', 'Finance_Credit_Debit', req.query.format);
  } catch (err) {
    next(err);
  }
};

/**
 * 7. Saved Filters
 */
const createSavedFilter = async (req, res, next) => {
  try {
    const saved = await reportService.createSavedFilter(req.body, req.user);
    return sendSuccess(res, 'Saved report filter created successfully.', saved, 201);
  } catch (err) {
    next(err);
  }
};

const getSavedFilters = async (req, res, next) => {
  try {
    const filters = await reportService.getSavedFilters(req.query, req.user);
    return sendSuccess(res, 'Saved report filters retrieved successfully.', filters);
  } catch (err) {
    next(err);
  }
};

const deleteSavedFilter = async (req, res, next) => {
  try {
    const result = await reportService.deleteSavedFilter(req.params.id, req.user);
    return sendSuccess(res, 'Saved report filter deleted successfully.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * 8. Export Jobs
 */
const getExportJob = async (req, res, next) => {
  try {
    const job = await reportService.getExportJob(req.params.jobId, req.user);
    return sendSuccess(res, 'Export job status retrieved successfully.', job);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCatalog,

  // Customer
  getCustomerList,
  getCustomerHistory,
  getCustomerPurchaseHistory,
  getCustomerOutstanding,
  getCustomerLedger,

  // Quotation
  getAllQuotations,
  getPendingQuotations,
  getFollowupPendingQuotations,
  getFollowupDueQuotations,
  getConfirmedQuotations,
  getRejectedQuotations,
  getExpiredQuotations,
  getQuotationConversion,
  getQuotationAmountVsActual,

  // Product
  getProductMaster,
  getProductQuotationCount,
  getProductCustomerList,
  getProductQuotationValue,
  getProductStock,
  getProductLowStock,
  getProductReorderItems,

  // Stock
  getStockOpening,
  getStockIn,
  getStockOut,
  getStockChallanDeduction,
  getStockActual,
  getStockManagement,
  getStockMovementHistory,

  // Finance
  getFinanceInvoices,
  getFinancePaymentCollection,
  getFinancePaymentReceipts,
  getFinanceOutstanding,
  getFinanceCustomerLedger,
  getFinanceCreditDebit,

  // Saved Filters & Jobs
  createSavedFilter,
  getSavedFilters,
  deleteSavedFilter,
  getExportJob
};
