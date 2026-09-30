const confirmationService = require('../services/confirmation.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new Quotation Confirmation
 * @route   POST /api/confirmations
 * @access  Private (Permission: QUOTATION_CONFIRMATION:create)
 */
const create = async (req, res, next) => {
  try {
    const { quotationId, confirmedItems, extraItems, remarks } = req.body;

    if (!quotationId) {
      return sendError(res, 'Quotation ID is required.', 400);
    }
    if (!Array.isArray(confirmedItems) && !Array.isArray(extraItems)) {
      return sendError(res, 'At least one confirmed item or extra item is required.', 400);
    }

    // Check if user has 'approve' action permission
    const hasApprovePermission = Boolean(
      req.userPermissions?.QUOTATION_CONFIRMATION?.actions?.approve ||
      req.user?.role?.isSystemRole ||
      req.user?.role?.roleName === 'Super Admin' ||
      req.user?.role?.roleName === 'Admin'
    );

    const confirmation = await confirmationService.createConfirmation(
      { quotationId, confirmedItems, extraItems, remarks },
      req.user,
      hasApprovePermission
    );

    return sendSuccess(
      res,
      confirmation.pendingApproval
        ? 'Quotation confirmation created and awaiting manager approval.'
        : 'Quotation confirmation created and approved successfully.',
      confirmation,
      201
    );
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Approve a pending confirmation (Manager Gate)
 * @route   PUT /api/confirmations/:id/approve
 * @access  Private (Permission: QUOTATION_CONFIRMATION:approve)
 */
const approve = async (req, res, next) => {
  try {
    const approved = await confirmationService.approveConfirmation(req.params.id, req.user);
    return sendSuccess(res, 'Quotation confirmation approved successfully and quotation status updated.', approved);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    List Quotation Confirmations
 * @route   GET /api/confirmations
 * @access  Private (Permission: QUOTATION_CONFIRMATION:view)
 */
const list = async (req, res, next) => {
  try {
    const result = await confirmationService.getConfirmations(req.query, req.scopeFilter);
    return sendSuccess(res, 'Quotation confirmations retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single Quotation Confirmation by ID
 * @route   GET /api/confirmations/:id
 * @access  Private (Permission: QUOTATION_CONFIRMATION:view)
 */
const getById = async (req, res, next) => {
  try {
    const confirmation = await confirmationService.getConfirmationById(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Quotation confirmation details retrieved successfully.', confirmation);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Update Quotation Confirmation (Only allowed pre-delivery)
 * @route   PUT /api/confirmations/:id
 * @access  Private (Permission: QUOTATION_CONFIRMATION:edit)
 */
const update = async (req, res, next) => {
  try {
    const updated = await confirmationService.updateConfirmation(
      req.params.id,
      req.body,
      req.user,
      req.scopeFilter
    );
    return sendSuccess(res, 'Quotation confirmation updated successfully.', updated);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Cancel Quotation Confirmation (Soft-cancel; reverts Quotation status to CUSTOMER_INTERESTED)
 * @route   PUT /api/confirmations/:id/cancel
 * @access  Private (Permission: QUOTATION_CONFIRMATION:delete)
 */
const cancel = async (req, res, next) => {
  try {
    const cancelled = await confirmationService.cancelConfirmation(req.params.id, req.user, req.scopeFilter);
    return sendSuccess(res, 'Quotation confirmation cancelled successfully and quotation status reverted.', {
      _id: cancelled._id,
      isActive: cancelled.isActive
    });
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get 4-Stage Quantity Ledger per item
 * @route   GET /api/confirmations/:id/quantity-ledger
 * @access  Private (Permission: QUOTATION_CONFIRMATION:view)
 */
const getQuantityLedger = async (req, res, next) => {
  try {
    const ledger = await confirmationService.getQuantityLedger(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Quantity ledger retrieved successfully.', ledger);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get Quotation Amount vs Actual Amount Comparison
 * @route   GET /api/confirmations/:id/amount-comparison
 * @access  Private (Permission: QUOTATION_CONFIRMATION:view)
 */
const getAmountComparison = async (req, res, next) => {
  try {
    const comparison = await confirmationService.getAmountComparison(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Quotation vs Actual amount comparison retrieved successfully.', comparison);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Export Confirmation & Quantity Ledger to Excel
 * @route   GET /api/confirmations/:id/export
 * @access  Private (Permission: QUOTATION_CONFIRMATION:export)
 */
const exportConfirmation = async (req, res, next) => {
  try {
    const buffer = await confirmationService.exportConfirmationToExcel(req.params.id, req.scopeFilter);

    res.setHeader('Content-Disposition', `attachment; filename=Confirmation_${req.params.id}.xlsx`);
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
  create,
  approve,
  list,
  getById,
  update,
  cancel,
  getQuantityLedger,
  getAmountComparison,
  exportConfirmation
};
