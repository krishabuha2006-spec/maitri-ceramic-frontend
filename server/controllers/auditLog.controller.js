const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Get paginated, filterable activity logs
 * @route   GET /api/audit-log
 * @access  Private (checkPermission('AUDIT_LOG', 'view'))
 */
const list = async (req, res, next) => {
  try {
    const result = await activityLogService.list(req.query);
    return sendSuccess(res, 'Activity logs retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single activity log detail by ID
 * @route   GET /api/audit-log/:id
 * @access  Private (checkPermission('AUDIT_LOG', 'view'))
 */
const getById = async (req, res, next) => {
  try {
    const entry = await activityLogService.getById(req.params.id);
    if (!entry) {
      return sendError(res, 'Activity log entry not found.', 404);
    }
    return sendSuccess(res, 'Activity log entry retrieved successfully.', entry);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get chronological activity timeline for a specific entity
 * @route   GET /api/audit-log/entity/:entityType/:entityId
 * @access  Private (checkPermission('AUDIT_LOG', 'view'))
 */
const getByEntity = async (req, res, next) => {
  try {
    const result = await activityLogService.getByEntity(
      req.params.entityType,
      req.params.entityId,
      req.query
    );
    return sendSuccess(res, `Activity timeline for entity ${req.params.entityType} retrieved successfully.`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get chronological activity timeline for a specific user
 * @route   GET /api/audit-log/user/:userId
 * @access  Private (checkPermission('AUDIT_LOG', 'view'))
 */
const getByUser = async (req, res, next) => {
  try {
    const result = await activityLogService.getByUser(req.params.userId, req.query);
    return sendSuccess(res, `Activity timeline for user ${req.params.userId} retrieved successfully.`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export activity logs as Excel spreadsheet
 * @route   GET /api/audit-log/export
 * @access  Private (checkPermission('AUDIT_LOG', 'export'))
 */
const exportAuditLog = async (req, res, next) => {
  try {
    const buffer = await activityLogService.exportExcel(req.query);

    const filename = `activity_log_${Date.now()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    return res.send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  list,
  getById,
  getByEntity,
  getByUser,
  exportAuditLog
};
