const followUpService = require('../services/followUp.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new Follow-Up entry against a Quotation
 * @route   POST /api/follow-ups
 * @access  Private (Permission: FOLLOW_UP:create)
 */
const create = async (req, res, next) => {
  try {
    const {
      quotationId,
      followUpDate,
      nextFollowUpDate,
      followUpUser,
      communicationType,
      customerResponse,
      remarks,
      expectedOrderValue,
      nextAction,
      resultingStatus
    } = req.body;

    if (!quotationId) {
      return sendError(res, 'Quotation ID is required.', 400);
    }
    if (!communicationType) {
      return sendError(res, 'Communication type (CALL, WHATSAPP, EMAIL, IN_PERSON, OTHER) is required.', 400);
    }
    if (!resultingStatus) {
      return sendError(res, 'Resulting status is required.', 400);
    }

    const followUp = await followUpService.createFollowUp(
      {
        quotationId,
        followUpDate,
        nextFollowUpDate,
        followUpUser,
        communicationType,
        customerResponse,
        remarks,
        expectedOrderValue,
        nextAction,
        resultingStatus
      },
      req.user
    );

    return sendSuccess(res, 'Follow-up logged successfully and quotation status updated.', followUp, 201);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    List all Follow-Up entries with filter & pagination
 * @route   GET /api/follow-ups
 * @access  Private (Permission: FOLLOW_UP:view)
 */
const list = async (req, res, next) => {
  try {
    const result = await followUpService.getFollowUps(req.query, req.scopeFilter);
    return sendSuccess(res, 'Follow-ups retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single Follow-Up entry by ID
 * @route   GET /api/follow-ups/:id
 * @access  Private (Permission: FOLLOW_UP:view)
 */
const getById = async (req, res, next) => {
  try {
    const followUp = await followUpService.getFollowUpById(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Follow-up retrieved successfully.', followUp);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Update a Follow-Up entry (Recency-aware status re-application)
 * @route   PUT /api/follow-ups/:id
 * @access  Private (Permission: FOLLOW_UP:edit)
 */
const update = async (req, res, next) => {
  try {
    const updated = await followUpService.updateFollowUp(req.params.id, req.body, req.user, req.scopeFilter);
    return sendSuccess(res, 'Follow-up updated successfully.', updated);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Deactivate (soft-delete) a Follow-Up entry
 * @route   PUT /api/follow-ups/:id/deactivate
 * @access  Private (Permission: FOLLOW_UP:delete)
 */
const deactivate = async (req, res, next) => {
  try {
    const deactivated = await followUpService.deactivateFollowUp(req.params.id, req.user, req.scopeFilter);
    return sendSuccess(res, 'Follow-up entry deactivated successfully.', {
      _id: deactivated._id,
      isActive: deactivated.isActive
    });
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Get chronological follow-up timeline for a single Quotation
 * @route   GET /api/follow-ups/quotation/:quotationId/timeline
 * @access  Private (Permission: FOLLOW_UP:view)
 */
const getTimeline = async (req, res, next) => {
  try {
    const timeline = await followUpService.getTimeline(req.params.quotationId, req.scopeFilter);
    return sendSuccess(res, 'Quotation follow-up timeline retrieved successfully.', timeline);
  } catch (error) {
    if (error.statusCode) {
      return sendError(res, error.message, error.statusCode);
    }
    next(error);
  }
};

/**
 * @desc    Follow-Up Alert Engine (5 Categories)
 * @route   GET /api/follow-ups/alerts
 * @access  Private (Permission: FOLLOW_UP:view)
 */
const getAlerts = async (req, res, next) => {
  try {
    const alerts = await followUpService.getAlerts(req.query, req.user, req.scopeFilter);
    return sendSuccess(res, 'Follow-up alerts computed successfully.', alerts);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export filtered Follow-Ups to Excel
 * @route   GET /api/follow-ups/export
 * @access  Private (Permission: FOLLOW_UP:export)
 */
const exportFollowUps = async (req, res, next) => {
  try {
    const buffer = await followUpService.exportFollowUpsToExcel(req.query, req.scopeFilter);

    res.setHeader('Content-Disposition', 'attachment; filename=FollowUps_Export.xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  create,
  list,
  getById,
  update,
  deactivate,
  getTimeline,
  getAlerts,
  exportFollowUps
};
