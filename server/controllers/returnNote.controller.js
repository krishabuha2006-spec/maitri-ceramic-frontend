const returnNoteService = require('../services/returnNote.service');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess } = require('../utils/response.util');

/**
 * Create Purchase Return (DRAFT)
 * POST /api/returns/purchase-return
 */
const createPurchaseReturn = async (req, res, next) => {
  try {
    const returnNote = await returnNoteService.createPurchaseReturn(req.body, req.user);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'RETURN_NOTE',
      actionType: 'CREATE',
      entityType: 'ReturnNote',
      entityId: returnNote._id,
      entityLabel: `Purchase Return #${returnNote.returnNoteNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Purchase Return create log error:', err.message));

    return sendSuccess(res, 'Purchase Return logged successfully as DRAFT.', returnNote, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Create Sales Return (DRAFT)
 * POST /api/returns/sales-return
 */
const createSalesReturn = async (req, res, next) => {
  try {
    const returnNote = await returnNoteService.createSalesReturn(req.body, req.user);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'RETURN_NOTE',
      actionType: 'CREATE',
      entityType: 'ReturnNote',
      entityId: returnNote._id,
      entityLabel: `Sales Return #${returnNote.returnNoteNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Sales Return create log error:', err.message));

    return sendSuccess(res, 'Sales Return logged successfully as DRAFT.', returnNote, 201);
  } catch (err) {
    next(err);
  }
};

/**
 * List Return Notes
 * GET /api/returns
 */
const getReturns = async (req, res, next) => {
  try {
    const result = await returnNoteService.getReturns(req.query, req.scopeFilter || {});
    return sendSuccess(res, 'Return Notes retrieved successfully.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * Get Return Note by ID
 * GET /api/returns/:id
 */
const getReturnById = async (req, res, next) => {
  try {
    const returnNote = await returnNoteService.getReturnById(req.params.id, req.scopeFilter || {});
    return sendSuccess(res, 'Return Note details retrieved successfully.', returnNote);
  } catch (err) {
    next(err);
  }
};

/**
 * Update Return Note (Non-stock fields if CONFIRMED, all if DRAFT)
 * PUT /api/returns/:id
 */
const updateReturn = async (req, res, next) => {
  try {
    const returnNote = await returnNoteService.updateReturn(req.params.id, req.body, req.user, req.scopeFilter || {});

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'RETURN_NOTE',
      actionType: 'UPDATE',
      entityType: 'ReturnNote',
      entityId: returnNote._id,
      entityLabel: `Return Note #${returnNote.returnNoteNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Return Note update log error:', err.message));

    return sendSuccess(res, 'Return Note updated successfully.', returnNote);
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel Return Note (DRAFT only)
 * PUT /api/returns/:id/cancel
 */
const cancelReturn = async (req, res, next) => {
  try {
    const returnNote = await returnNoteService.cancelReturn(req.params.id, req.user, req.scopeFilter || {});

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'RETURN_NOTE',
      actionType: 'DELETE',
      entityType: 'ReturnNote',
      entityId: returnNote._id,
      entityLabel: `Return Note #${returnNote.returnNoteNumber} cancelled`,
      changeSummary: { status: { before: 'DRAFT', after: 'CANCELLED' } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Return Note cancel log error:', err.message));

    return sendSuccess(res, 'Return Note cancelled successfully.', returnNote);
  } catch (err) {
    next(err);
  }
};

/**
 * Confirm Return Note (Stock Movement Trigger)
 * PUT /api/returns/:id/confirm
 */
const confirmReturn = async (req, res, next) => {
  try {
    const returnNote = await returnNoteService.confirmReturn(req.params.id, req.user, req.body || {}, req.scopeFilter || {});

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'RETURN_NOTE',
      actionType: 'APPROVE',
      entityType: 'ReturnNote',
      entityId: returnNote._id,
      entityLabel: `Return Note #${returnNote.returnNoteNumber} confirmed`,
      changeSummary: { status: { before: 'DRAFT', after: 'CONFIRMED' } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Return Note confirm log error:', err.message));

    return sendSuccess(res, `Return Note confirmed successfully. Stock movement has been posted.`, returnNote);
  } catch (err) {
    next(err);
  }
};

/**
 * Export Return Notes to Excel
 * GET /api/returns/export
 */
const exportReturnsToExcel = async (req, res, next) => {
  try {
    const buffer = await returnNoteService.exportReturnsToExcel(req.query, req.scopeFilter || {});
    const fileName = `Return_Notes_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPurchaseReturn,
  createSalesReturn,
  getReturns,
  getReturnById,
  updateReturn,
  cancelReturn,
  confirmReturn,
  exportReturnsToExcel
};
