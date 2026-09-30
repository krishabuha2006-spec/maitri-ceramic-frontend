const ledgerService = require('../services/ledger.service');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');
const XLSX = require('xlsx');

/**
 * @desc    Get chronological ledger entries for a customer
 * @route   GET /api/ledger/customer/:customerId
 * @access  Private (Permission: CUSTOMER_LEDGER:view)
 */
const getCustomerLedger = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const result = await ledgerService.getByCustomer(customerId, req.query);
    return sendSuccess(res, 'Customer ledger retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current balance for a customer
 * @route   GET /api/ledger/customer/:customerId/current-balance
 * @access  Private (Permission: CUSTOMER_LEDGER:view)
 */
const getCurrentBalance = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const balanceInfo = await ledgerService.getCurrentBalance(customerId);
    return sendSuccess(res, 'Customer current balance retrieved successfully.', balanceInfo);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get render-ready customer statement for a date period
 * @route   GET /api/ledger/customer/:customerId/statement
 * @access  Private (Permission: CUSTOMER_LEDGER:view)
 */
const getCustomerStatement = async (req, res, next) => {
  try {
    const { customerId } = req.params;
    const statement = await ledgerService.getCustomerStatement(customerId, req.query);
    return sendSuccess(res, 'Customer statement generated successfully.', statement);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Post a Manual Credit / Debit entry
 * @route   POST /api/ledger/manual-entry
 * @access  Private (Dual permission: CUSTOMER_LEDGER:create AND CUSTOMER_LEDGER:approve)
 */
const createManualEntry = async (req, res, next) => {
  try {
    const { customerId, entryType, amount, particular } = req.body;

    if (!customerId) {
      return sendError(res, 'Customer ID is required.', 400);
    }
    if (!entryType || !['DEBIT', 'CREDIT'].includes(entryType.toUpperCase())) {
      return sendError(res, "Entry type must be either 'DEBIT' or 'CREDIT'.", 400);
    }
    if (!amount || Number(amount) <= 0) {
      return sendError(res, 'Amount must be greater than 0.', 400);
    }
    if (!particular || !particular.trim()) {
      return sendError(res, 'Particular description is required.', 400);
    }

    const newEntry = await ledgerService.createManualEntry(
      {
        ...req.body,
        entryType: entryType.toUpperCase()
      },
      req.user
    );

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CUSTOMER_LEDGER',
      actionType: 'CREATE',
      entityType: 'LedgerEntry',
      entityId: newEntry._id,
      entityLabel: `Manual ${newEntry.entryType} Entry (₹${newEntry.amount})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Ledger manual create log error:', err.message));

    return sendSuccess(res, 'Manual ledger entry posted successfully.', newEntry, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reverse a Manual Ledger Entry
 * @route   POST /api/ledger/manual-entry/:id/reverse
 * @access  Private (Dual permission: CUSTOMER_LEDGER:delete AND CUSTOMER_LEDGER:approve)
 */
const reverseManualEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return sendError(res, 'Reversal reason is mandatory.', 400);
    }

    const reversalEntry = await ledgerService.reverseManualEntry(id, req.body, req.user);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CUSTOMER_LEDGER',
      actionType: 'DELETE',
      entityType: 'LedgerEntry',
      entityId: reversalEntry._id,
      entityLabel: `Manual Ledger Entry Reversal (₹${reversalEntry.amount})`,
      changeSummary: { reason: reason.trim(), reversed: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Ledger manual reverse log error:', err.message));

    return sendSuccess(res, 'Manual ledger entry reversed successfully.', reversalEntry, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export Customer Statement or Credit/Debit report to Excel (.xlsx)
 * @route   GET /api/ledger/export
 * @access  Private (Permission: CUSTOMER_LEDGER:export)
 */
const exportLedger = async (req, res, next) => {
  try {
    const { workbook, filename } = await ledgerService.exportLedgerToExcel(req.query);

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCustomerLedger,
  getCurrentBalance,
  getCustomerStatement,
  createManualEntry,
  reverseManualEntry,
  exportLedger
};
