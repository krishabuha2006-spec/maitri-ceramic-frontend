const paymentService = require('../services/payment.service');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Record a new payment with multi-invoice allocation
 * @route   POST /api/payments
 * @access  Private (Permission: PAYMENT:create)
 */
const createPayment = async (req, res, next) => {
  try {
    const payment = await paymentService.createPayment(req.body, req.user);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PAYMENT',
      actionType: 'CREATE',
      entityType: 'Payment',
      entityId: payment._id,
      entityLabel: `Payment Receipt #${payment.receiptNumber} (₹${payment.amountPaid})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Payment create log error:', err.message));

    return sendSuccess(res, 'Payment recorded and receipt generated successfully.', payment, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List payments with filtering, pagination, and dataScope
 * @route   GET /api/payments
 * @access  Private (Permission: PAYMENT:view)
 */
const getPayments = async (req, res, next) => {
  try {
    const result = await paymentService.getPayments(req.query, req.scopeFilter);
    return sendSuccess(res, 'Payments retrieved successfully.', result.payments, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed Payment record by ID
 * @route   GET /api/payments/:id
 * @access  Private (Permission: PAYMENT:view)
 */
const getPaymentById = async (req, res, next) => {
  try {
    const payment = await paymentService.getPaymentById(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Payment retrieved successfully.', payment);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update non-monetary metadata of a Payment
 * @route   PUT /api/payments/:id
 * @access  Private (Permission: PAYMENT:edit)
 */
const updatePayment = async (req, res, next) => {
  try {
    const payment = await paymentService.updatePayment(req.params.id, req.body, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PAYMENT',
      actionType: 'UPDATE',
      entityType: 'Payment',
      entityId: payment._id,
      entityLabel: `Payment Receipt #${payment.receiptNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Payment update log error:', err.message));

    return sendSuccess(res, 'Payment details updated successfully.', payment);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reverse a payment (double-gated: PAYMENT:delete + PAYMENT:approve)
 * @route   POST /api/payments/:id/reverse
 * @access  Private (Permission: PAYMENT:delete AND PAYMENT:approve)
 */
const reversePayment = async (req, res, next) => {
  try {
    const reversal = await paymentService.reversePayment(req.params.id, req.body, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PAYMENT',
      actionType: 'DELETE',
      entityType: 'Payment',
      entityId: reversal._id,
      entityLabel: `Payment Reversal for Receipt #${reversal.receiptNumber}`,
      changeSummary: {
        reversed: true,
        reason: req.body.reason || 'Payment reversal'
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Payment reverse log error:', err.message));

    return sendSuccess(res, 'Payment reversed successfully and reversal ledger record generated.', reversal, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get render-ready payment receipt data
 * @route   GET /api/payments/:id/receipt
 * @access  Private (Permission: PAYMENT:view)
 */
const getReceiptData = async (req, res, next) => {
  try {
    const receipt = await paymentService.getReceiptData(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Payment receipt generated successfully.', receipt);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get live customer-level outstanding financial summary
 * @route   GET /api/payments/customer/:customerId/outstanding
 * @access  Private (Permission: PAYMENT:view)
 */
const getCustomerOutstanding = async (req, res, next) => {
  try {
    const summary = await paymentService.getCustomerOutstanding(req.params.customerId);
    return sendSuccess(res, 'Customer outstanding summary calculated successfully.', summary);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get live balance due for a specific invoice
 * @route   GET /api/payments/invoice/:id/balance-due
 * @access  Private (Permission: PAYMENT:view)
 */
const getInvoiceBalanceDue = async (req, res, next) => {
  try {
    const balance = await paymentService.getBalanceDue(req.params.id);
    return sendSuccess(res, 'Invoice balance due calculated successfully.', balance);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export filtered payments to Excel
 * @route   GET /api/payments/export
 * @access  Private (Permission: PAYMENT:export)
 */
const exportPayments = async (req, res, next) => {
  try {
    const buffer = await paymentService.exportPaymentsToExcel(req.query, req.scopeFilter);

    res.setHeader('Content-Disposition', 'attachment; filename=Payments_Export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPayment,
  getPayments,
  getPaymentById,
  updatePayment,
  reversePayment,
  getReceiptData,
  getCustomerOutstanding,
  getInvoiceBalanceDue,
  exportPayments
};
