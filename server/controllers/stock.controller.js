const stockService = require('../services/stock.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Manual Stock In (Opening, Purchase, Manual Addition, Other)
 * @route   POST /api/stock/entries/in
 * @access  Private (Permission: STOCK:create)
 */
const stockIn = async (req, res, next) => {
  try {
    const entry = await stockService.stockIn(req.body, req.user);
    return sendSuccess(res, 'Stock In entry posted successfully.', entry, 201);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Manual Stock Out (Manual Deduction, Other)
 * @route   POST /api/stock/entries/out
 * @access  Private (Permission: STOCK:delete, plus STOCK:approve if reason is MANUAL_DEDUCTION)
 */
const stockOut = async (req, res, next) => {
  try {
    const entry = await stockService.stockOut(req.body, req.user);
    return sendSuccess(res, 'Stock Out entry posted successfully.', entry, 201);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    List Stock Ledger Entries with filters & pagination
 * @route   GET /api/stock/entries
 * @access  Private (Permission: STOCK:view)
 */
const listEntries = async (req, res, next) => {
  try {
    const result = await stockService.getEntries(req.query);
    return sendSuccess(res, 'Stock ledger entries retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Stock Summary for a Product (Actual, Management, Available Stock)
 * @route   GET /api/stock/:productId/summary
 * @access  Private (Permission: STOCK:view)
 */
const getSummary = async (req, res, next) => {
  try {
    const summary = await stockService.getSummary(req.params.productId);
    return sendSuccess(res, 'Stock summary retrieved successfully.', summary);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get Chronological Movement History (Ledger) for a Product
 * @route   GET /api/stock/:productId/movement-history
 * @access  Private (Permission: STOCK:view)
 */
const getMovementHistory = async (req, res, next) => {
  try {
    const history = await stockService.getMovementHistory(req.params.productId, req.query);
    return sendSuccess(res, 'Product stock movement history retrieved successfully.', history);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Low Stock Report (Products where currentStock <= reorderAlertQty)
 * @route   GET /api/stock/low-stock-report
 * @access  Private (Permission: STOCK:view)
 */
const getLowStockReport = async (req, res, next) => {
  try {
    const report = await stockService.getLowStockReport(req.query);
    return sendSuccess(res, 'Low stock report generated successfully.', report);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Purchase Alert Calculation (Identifies shortages against confirmed quotations)
 * @route   GET /api/stock/purchase-alerts
 * @access  Private (Permission: STOCK:view)
 */
const getPurchaseAlerts = async (req, res, next) => {
  try {
    const alerts = await stockService.getPurchaseAlerts(req.query);
    return sendSuccess(res, 'Purchase alerts calculated successfully.', alerts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reconcile Stock for a Product (Admin utility)
 * @route   POST /api/stock/:productId/reconcile
 * @access  Private (Permission: STOCK:approve)
 */
const reconcile = async (req, res, next) => {
  try {
    const result = await stockService.reconcileStock(req.params.productId, req.user);
    return sendSuccess(res, 'Product stock cache reconciled against ledger successfully.', result);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Export Stock Reports to Excel (.xlsx)
 * @route   GET /api/stock/export
 * @access  Private (Permission: STOCK:export)
 */
const exportStock = async (req, res, next) => {
  try {
    const buffer = await stockService.exportStockToExcel(req.query);
    const reportType = req.query.reportType || 'movement';

    res.setHeader('Content-Disposition', `attachment; filename=Stock_${reportType}_${Date.now()}.xlsx`);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.status(200).send(buffer);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

module.exports = {
  stockIn,
  stockOut,
  listEntries,
  getSummary,
  getMovementHistory,
  getLowStockReport,
  getPurchaseAlerts,
  reconcile,
  exportStock
};
