const challanService = require('../services/challan.service');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new DRAFT Challan from an active Quotation Confirmation
 * @route   POST /api/challans
 * @access  Private (Permission: CHALLAN:create)
 */
const create = async (req, res, next) => {
  try {
    const challan = await challanService.createChallan(req.body, req.user);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CHALLAN',
      actionType: 'CREATE',
      entityType: 'Challan',
      entityId: challan._id,
      entityLabel: `Challan #${challan.challanNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Challan create log error:', err.message));

    return sendSuccess(res, 'Challan created in DRAFT status.', challan, 201);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    List Challans with pagination and filters
 * @route   GET /api/challans
 * @access  Private (Permission: CHALLAN:view)
 */
const list = async (req, res, next) => {
  try {
    const result = await challanService.getChallans(req.query, req.scopeFilter);
    return sendSuccess(res, 'Challans retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single Challan by ID
 * @route   GET /api/challans/:id
 * @access  Private (Permission: CHALLAN:view)
 */
const getById = async (req, res, next) => {
  try {
    const challan = await challanService.getChallanById(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Challan details retrieved successfully.', challan);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Update a DRAFT Challan
 * @route   PUT /api/challans/:id
 * @access  Private (Permission: CHALLAN:edit)
 */
const update = async (req, res, next) => {
  try {
    const updated = await challanService.updateChallan(req.params.id, req.body, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CHALLAN',
      actionType: 'UPDATE',
      entityType: 'Challan',
      entityId: updated._id,
      entityLabel: `Challan #${updated.challanNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Challan update log error:', err.message));

    return sendSuccess(res, 'Challan updated successfully.', updated);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Cancel a DRAFT Challan
 * @route   PUT /api/challans/:id/cancel
 * @access  Private (Permission: CHALLAN:delete)
 */
const cancel = async (req, res, next) => {
  try {
    const cancelled = await challanService.cancelChallan(req.params.id, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CHALLAN',
      actionType: 'DELETE',
      entityType: 'Challan',
      entityId: cancelled._id,
      entityLabel: `Challan #${cancelled.challanNumber} cancelled`,
      changeSummary: { status: { before: 'DRAFT', after: 'CANCELLED' } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Challan cancel log error:', err.message));

    return sendSuccess(res, 'Challan cancelled successfully.', {
      _id: cancelled._id,
      challanNumber: cancelled.challanNumber,
      status: cancelled.status
    });
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Finalize Challan (Atomic Dual-Write: stock deduction + delivery record)
 * @route   PUT /api/challans/:id/finalize
 * @access  Private (Permission: CHALLAN:approve)
 */
const finalize = async (req, res, next) => {
  try {
    const finalized = await challanService.finalizeChallan(req.params.id, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CHALLAN',
      actionType: 'APPROVE',
      entityType: 'Challan',
      entityId: finalized._id,
      entityLabel: `Challan #${finalized.challanNumber} finalized`,
      changeSummary: { status: { before: 'DRAFT', after: 'FINALIZED' } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Challan finalize log error:', err.message));

    return sendSuccess(
      res,
      'Challan finalized successfully. Physical stock deducted and delivery recorded.',
      finalized
    );
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get Print / Delivery Note Document data
 * @route   GET /api/challans/:id/print
 * @access  Private (Permission: CHALLAN:view)
 */
const print = async (req, res, next) => {
  try {
    const printData = await challanService.getPrintData(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Challan delivery note print data retrieved.', printData);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Export Challans to Excel (.xlsx)
 * @route   GET /api/challans/export
 * @access  Private (Permission: CHALLAN:export)
 */
const exportChallans = async (req, res, next) => {
  try {
    const buffer = await challanService.exportChallansToExcel(req.query, req.scopeFilter);

    res.setHeader('Content-Disposition', `attachment; filename=Challans_${Date.now()}.xlsx`);
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
  list,
  getById,
  update,
  cancel,
  finalize,
  print,
  exportChallans
};
