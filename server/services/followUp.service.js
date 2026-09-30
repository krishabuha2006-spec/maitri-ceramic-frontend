const mongoose = require('mongoose');
const XLSX = require('xlsx');
const FollowUp = require('../models/FollowUp');
const Quotation = require('../models/Quotation');
const quotationService = require('./quotation.service');

const TERMINAL_STATUSES = ['CONFIRMED', 'PARTIALLY_CONFIRMED', 'REJECTED', 'EXPIRED', 'CLOSED'];

/**
 * Log a new follow-up entry against a Quotation
 * Atomically creates the FollowUp record and drives Quotation's status
 */
const createFollowUp = async (data, user) => {
  const {
    quotationId,
    followUpDate = new Date(),
    nextFollowUpDate = null,
    followUpUser,
    communicationType,
    customerResponse = null,
    remarks = null,
    expectedOrderValue = null,
    nextAction = null,
    resultingStatus
  } = data;

  if (!quotationId) {
    const err = new Error('Quotation ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify target Quotation exists and is active
  const quotation = await Quotation.findOne({ _id: quotationId, isActive: true });
  if (!quotation) {
    const err = new Error(`Cannot log follow-up: Active Quotation not found with ID '${quotationId}'.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Validate resultingStatus
  if (!resultingStatus) {
    const err = new Error('Resulting status is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!quotationService.ALLOWED_FOLLOW_UP_STATUSES.includes(resultingStatus)) {
    const err = new Error(
      `Invalid resultingStatus '${resultingStatus}'. Follow-Up module is only permitted to set: ${quotationService.ALLOWED_FOLLOW_UP_STATUSES.join(
        ', '
      )}. Transitions like CONFIRMED/PARTIALLY_CONFIRMED belong to Module 7.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 3. Validate nextFollowUpDate if provided
  const fDate = new Date(followUpDate);
  if (nextFollowUpDate) {
    const nDate = new Date(nextFollowUpDate);
    if (nDate < fDate) {
      const err = new Error('Next follow-up date cannot be earlier than the follow-up date.');
      err.statusCode = 400;
      throw err;
    }
  }

  const assignedFollowUpUser = followUpUser || user._id;

  // 4. Create FollowUp entry
  const followUp = await FollowUp.create({
    quotation: quotation._id,
    followUpDate: fDate,
    nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
    followUpUser: assignedFollowUpUser,
    communicationType: String(communicationType).toUpperCase(),
    customerResponse: customerResponse ? customerResponse.trim() : null,
    remarks: remarks ? remarks.trim() : null,
    expectedOrderValue: expectedOrderValue !== undefined && expectedOrderValue !== null ? Number(expectedOrderValue) : null,
    nextAction: nextAction ? nextAction.trim() : null,
    resultingStatus,
    isActive: true,
    createdBy: user._id
  });

  // 5. Update Quotation status via quotationService
  try {
    await quotationService.updateStatus(quotation._id, resultingStatus, {
      userId: user._id,
      sourceModule: 'FOLLOW_UP'
    });
  } catch (updateErr) {
    // Rollback created follow-up record on status update failure
    await FollowUp.findByIdAndDelete(followUp._id);
    throw updateErr;
  }

  const populated = await FollowUp.findById(followUp._id)
    .populate('quotation', 'quotationNumber quotationDate status customer grandTotal')
    .populate('followUpUser', 'name mobile email')
    .populate('createdBy', 'name mobile');

  return populated;
};

/**
 * List Follow-Up records with filters, pagination and dataScope
 */
const getFollowUps = async (query = {}, scopeFilter = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { ...scopeFilter };

  if (query.isActive !== undefined && query.isActive !== 'all') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  } else if (query.isActive === undefined) {
    filter.isActive = true;
  }

  if (query.quotationId) {
    filter.quotation = query.quotationId;
  }

  if (query.followUpUserId) {
    filter.followUpUser = query.followUpUserId;
  }

  if (query.resultingStatus) {
    filter.resultingStatus = query.resultingStatus.toUpperCase();
  }

  if (query.communicationType) {
    filter.communicationType = query.communicationType.toUpperCase();
  }

  // Date range filters on followUpDate
  if (query.from || query.to) {
    filter.followUpDate = {};
    if (query.from) {
      filter.followUpDate.$gte = new Date(query.from);
    }
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.followUpDate.$lte = toDate;
    }
  }

  // If customer filter is passed, find customer's quotations first
  if (query.customerId) {
    const customerQuotations = await Quotation.find({ customer: query.customerId }).select('_id');
    const qIds = customerQuotations.map((q) => q._id);
    filter.quotation = { $in: qIds };
  }

  const total = await FollowUp.countDocuments(filter);
  const followUps = await FollowUp.find(filter)
    .populate({
      path: 'quotation',
      select: 'quotationNumber quotationDate customer salesperson status grandTotal',
      populate: [
        { path: 'customer', select: 'customerName mobile city' },
        { path: 'salesperson', select: 'name mobile' }
      ]
    })
    .populate('followUpUser', 'name mobile email')
    .populate('createdBy', 'name mobile')
    .sort({ followUpDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    followUps,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get single Follow-Up record by ID
 */
const getFollowUpById = async (id, scopeFilter = {}) => {
  const filter = { _id: id, ...scopeFilter };
  const followUp = await FollowUp.findOne(filter)
    .populate({
      path: 'quotation',
      select: 'quotationNumber quotationDate customer salesperson status grandTotal formatKey validityDate',
      populate: [
        { path: 'customer', select: 'customerName mobile email city address' },
        { path: 'salesperson', select: 'name mobile email' }
      ]
    })
    .populate('followUpUser', 'name mobile email')
    .populate('createdBy', 'name mobile')
    .populate('updatedBy', 'name mobile');

  if (!followUp) {
    const err = new Error('Follow-up record not found or inaccessible under current scope.');
    err.statusCode = 404;
    throw err;
  }

  return followUp;
};

/**
 * Update an existing Follow-Up entry
 * Recency Rule: Only updates Quotation.status if this entry is the MOST RECENT active follow-up
 */
const updateFollowUp = async (id, data, user, scopeFilter = {}) => {
  const filter = { _id: id, ...scopeFilter };
  const followUp = await FollowUp.findOne(filter);

  if (!followUp) {
    const err = new Error('Follow-up record not found or not permitted to edit.');
    err.statusCode = 404;
    throw err;
  }

  const {
    followUpDate,
    nextFollowUpDate,
    followUpUser,
    communicationType,
    customerResponse,
    remarks,
    expectedOrderValue,
    nextAction,
    resultingStatus
  } = data;

  const newFollowUpDate = followUpDate ? new Date(followUpDate) : followUp.followUpDate;
  const newNextFollowUpDate =
    nextFollowUpDate !== undefined
      ? nextFollowUpDate
        ? new Date(nextFollowUpDate)
        : null
      : followUp.nextFollowUpDate;

  if (newNextFollowUpDate && newNextFollowUpDate < newFollowUpDate) {
    const err = new Error('Next follow-up date cannot be earlier than the follow-up date.');
    err.statusCode = 400;
    throw err;
  }

  let statusChanged = false;
  let newStatusToSet = null;

  if (resultingStatus && resultingStatus !== followUp.resultingStatus) {
    if (!quotationService.ALLOWED_FOLLOW_UP_STATUSES.includes(resultingStatus)) {
      const err = new Error(
        `Invalid resultingStatus '${resultingStatus}'. Permitted values: ${quotationService.ALLOWED_FOLLOW_UP_STATUSES.join(
          ', '
        )}`
      );
      err.statusCode = 400;
      throw err;
    }
    statusChanged = true;
    newStatusToSet = resultingStatus;
  }

  // Update fields
  if (followUpDate) followUp.followUpDate = newFollowUpDate;
  if (nextFollowUpDate !== undefined) followUp.nextFollowUpDate = newNextFollowUpDate;
  if (followUpUser) followUp.followUpUser = followUpUser;
  if (communicationType) followUp.communicationType = communicationType.toUpperCase();
  if (customerResponse !== undefined) followUp.customerResponse = customerResponse ? customerResponse.trim() : null;
  if (remarks !== undefined) followUp.remarks = remarks ? remarks.trim() : null;
  if (expectedOrderValue !== undefined) {
    followUp.expectedOrderValue = expectedOrderValue !== null ? Number(expectedOrderValue) : null;
  }
  if (nextAction !== undefined) followUp.nextAction = nextAction ? nextAction.trim() : null;
  if (resultingStatus) followUp.resultingStatus = resultingStatus;

  followUp.updatedBy = user._id;
  await followUp.save();

  // If resultingStatus changed, apply recency logic:
  // Check if this followUp is the most recent active follow-up for the quotation
  if (statusChanged && newStatusToSet) {
    const mostRecent = await FollowUp.findOne({
      quotation: followUp.quotation,
      isActive: true
    }).sort({ followUpDate: -1, createdAt: -1 });

    if (mostRecent && String(mostRecent._id) === String(followUp._id)) {
      // It is the most recent, so update Quotation status
      await quotationService.updateStatus(followUp.quotation, newStatusToSet, {
        userId: user._id,
        sourceModule: 'FOLLOW_UP'
      });
    }
  }

  const updated = await getFollowUpById(followUp._id);
  return updated;
};

/**
 * Deactivate (soft-delete) a Follow-Up entry
 * Does NOT auto-revert Quotation status (Rule 5)
 */
const deactivateFollowUp = async (id, user, scopeFilter = {}) => {
  const filter = { _id: id, ...scopeFilter };
  const followUp = await FollowUp.findOne(filter);

  if (!followUp) {
    const err = new Error('Follow-up record not found or not permitted to delete.');
    err.statusCode = 404;
    throw err;
  }

  followUp.isActive = false;
  followUp.updatedBy = user._id;
  await followUp.save();

  return followUp;
};

/**
 * Get chronological timeline for one Quotation (Newest first)
 */
const getTimeline = async (quotationId, scopeFilter = {}) => {
  const quotation = await Quotation.findOne({ _id: quotationId, isActive: true });
  if (!quotation) {
    const err = new Error(`Quotation not found with ID '${quotationId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const filter = { quotation: quotationId, isActive: true, ...scopeFilter };

  const timeline = await FollowUp.find(filter)
    .populate('followUpUser', 'name mobile email')
    .populate('createdBy', 'name mobile')
    .sort({ followUpDate: -1, createdAt: -1 })
    .lean();

  return {
    quotation: {
      _id: quotation._id,
      quotationNumber: quotation.quotationNumber,
      quotationDate: quotation.quotationDate,
      status: quotation.status,
      grandTotal: quotation.grandTotal,
      validityDate: quotation.validityDate
    },
    totalEntries: timeline.length,
    timeline
  };
};

/**
 * Follow-Up Alert Engine
 * Computes the 5 documented alert categories:
 * 1. noFollowUpYet
 * 2. overdueFollowUp
 * 3. dueTodayFollowUp
 * 4. expiringSoonQuotations
 * 5. noCustomerResponse
 */
const getAlerts = async (query = {}, user = null, scopeFilter = {}) => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const threeDaysFromNow = new Date(startOfToday.getTime() + 3 * 24 * 60 * 60 * 1000);

  const quotationFilter = {
    isActive: true,
    status: { $nin: TERMINAL_STATUSES }
  };

  if (query.salespersonId) {
    quotationFilter.salesperson = query.salespersonId;
  }

  // Find all active, non-terminal quotations
  const activeQuotations = await Quotation.find(quotationFilter)
    .populate('customer', 'customerName mobile city')
    .populate('salesperson', 'name mobile email')
    .sort({ quotationDate: -1 })
    .lean();

  const quotationIds = activeQuotations.map((q) => q._id);

  // Find all active follow-ups for these quotations
  const allFollowUps = await FollowUp.find({
    quotation: { $in: quotationIds },
    isActive: true
  })
    .populate('followUpUser', 'name mobile email')
    .sort({ followUpDate: -1, createdAt: -1 })
    .lean();

  // Group follow-ups by quotation ID (newest first)
  const followUpsByQuotation = {};
  allFollowUps.forEach((fu) => {
    const qId = String(fu.quotation);
    if (!followUpsByQuotation[qId]) {
      followUpsByQuotation[qId] = [];
    }
    followUpsByQuotation[qId].push(fu);
  });

  const noFollowUpYet = [];
  const overdueFollowUp = [];
  const dueTodayFollowUp = [];
  const expiringSoonQuotations = [];
  const noCustomerResponse = [];

  activeQuotations.forEach((quotation) => {
    const qId = String(quotation._id);
    const followUps = followUpsByQuotation[qId] || [];
    const latestFollowUp = followUps.length > 0 ? followUps[0] : null;

    const baseItem = {
      quotationId: quotation._id,
      quotationNumber: quotation.quotationNumber,
      quotationDate: quotation.quotationDate,
      validityDate: quotation.validityDate,
      status: quotation.status,
      grandTotal: quotation.grandTotal,
      customer: quotation.customer
        ? {
            id: quotation.customer._id,
            customerName: quotation.customer.customerName,
            mobile: quotation.customer.mobile,
            city: quotation.customer.city
          }
        : null,
      salesperson: quotation.salesperson
        ? {
            id: quotation.salesperson._id,
            name: quotation.salesperson.name,
            mobile: quotation.salesperson.mobile
          }
        : null,
      latestFollowUp: latestFollowUp
        ? {
            _id: latestFollowUp._id,
            followUpDate: latestFollowUp.followUpDate,
            nextFollowUpDate: latestFollowUp.nextFollowUpDate,
            communicationType: latestFollowUp.communicationType,
            customerResponse: latestFollowUp.customerResponse,
            remarks: latestFollowUp.remarks,
            resultingStatus: latestFollowUp.resultingStatus,
            followUpUser: latestFollowUp.followUpUser
          }
        : null
    };

    // Category 1: No Follow-Up Yet
    if (followUps.length === 0 || quotation.status === 'SENT') {
      if (followUps.length === 0) {
        noFollowUpYet.push(baseItem);
      }
    }

    if (latestFollowUp && latestFollowUp.nextFollowUpDate) {
      const nextDate = new Date(latestFollowUp.nextFollowUpDate);

      // Category 2: Overdue Follow-Up (nextFollowUpDate < startOfToday)
      if (nextDate < startOfToday) {
        overdueFollowUp.push({
          ...baseItem,
          daysOverdue: Math.floor((startOfToday - nextDate) / (1000 * 60 * 60 * 24))
        });
      }

      // Category 3: Due Today Follow-Up (startOfToday <= nextFollowUpDate <= endOfToday)
      if (nextDate >= startOfToday && nextDate <= endOfToday) {
        dueTodayFollowUp.push(baseItem);
      }
    }

    // Category 4: Expiring Soon Quotations (validityDate approaching in next 3 days or today)
    if (quotation.validityDate) {
      const vDate = new Date(quotation.validityDate);
      if (vDate >= startOfToday && vDate <= threeDaysFromNow) {
        expiringSoonQuotations.push({
          ...baseItem,
          daysRemaining: Math.ceil((vDate - startOfToday) / (1000 * 60 * 60 * 24))
        });
      }
    }

    // Category 5: No Customer Response on latest follow-up
    if (latestFollowUp) {
      const resp = latestFollowUp.customerResponse;
      if (!resp || !resp.trim()) {
        noCustomerResponse.push(baseItem);
      }
    }
  });

  return {
    summary: {
      noFollowUpYetCount: noFollowUpYet.length,
      overdueFollowUpCount: overdueFollowUp.length,
      dueTodayFollowUpCount: dueTodayFollowUp.length,
      expiringSoonCount: expiringSoonQuotations.length,
      noCustomerResponseCount: noCustomerResponse.length,
      totalAlerts:
        noFollowUpYet.length +
        overdueFollowUp.length +
        dueTodayFollowUp.length +
        expiringSoonQuotations.length +
        noCustomerResponse.length
    },
    noFollowUpYet,
    overdueFollowUp,
    dueTodayFollowUp,
    expiringSoonQuotations,
    noCustomerResponse
  };
};

/**
 * Forward Reference Service: Get Follow-Ups for a Customer
 * Consumed by Module 4's `GET /api/customers/:id/history`
 */
const getByCustomer = async (customerId) => {
  try {
    const customerQuotations = await Quotation.find({
      customer: customerId,
      isActive: true
    })
      .select('_id quotationNumber')
      .lean();

    if (!customerQuotations.length) {
      return [];
    }

    const qMap = {};
    customerQuotations.forEach((q) => {
      qMap[String(q._id)] = q.quotationNumber;
    });

    const quotationIds = customerQuotations.map((q) => q._id);

    const followUps = await FollowUp.find({
      quotation: { $in: quotationIds },
      isActive: true
    })
      .populate('followUpUser', 'name mobile')
      .sort({ followUpDate: -1, createdAt: -1 })
      .lean();

    return followUps.map((fu) => ({
      _id: fu._id,
      quotationId: fu.quotation,
      quotationNumber: qMap[String(fu.quotation)] || 'N/A',
      followUpDate: fu.followUpDate,
      nextFollowUpDate: fu.nextFollowUpDate,
      communicationType: fu.communicationType,
      customerResponse: fu.customerResponse,
      remarks: fu.remarks,
      expectedOrderValue: fu.expectedOrderValue,
      nextAction: fu.nextAction,
      resultingStatus: fu.resultingStatus,
      followUpUser: fu.followUpUser ? fu.followUpUser.name : 'Unknown'
    }));
  } catch (err) {
    console.warn('Error in followUpService.getByCustomer:', err.message);
    return [];
  }
};

/**
 * Export Follow-Ups to Excel workbook buffer
 */
const exportFollowUpsToExcel = async (query = {}, scopeFilter = {}) => {
  const result = await getFollowUps({ ...query, limit: 10000 }, scopeFilter);
  const followUps = result.followUps || [];

  const exportData = followUps.map((fu, idx) => ({
    'Sr. No.': idx + 1,
    'Quotation #': fu.quotation?.quotationNumber || 'N/A',
    'Customer': fu.quotation?.customer?.customerName || 'N/A',
    'Follow-Up Date': fu.followUpDate ? new Date(fu.followUpDate).toLocaleDateString('en-IN') : '',
    'Next Follow-Up Date': fu.nextFollowUpDate ? new Date(fu.nextFollowUpDate).toLocaleDateString('en-IN') : '',
    'Communication Type': fu.communicationType || '',
    'Resulting Status': fu.resultingStatus || '',
    'Follow-Up User': fu.followUpUser?.name || 'N/A',
    'Expected Value (₹)': fu.expectedOrderValue !== null ? fu.expectedOrderValue : '',
    'Customer Response': fu.customerResponse || '',
    'Remarks': fu.remarks || '',
    'Next Action': fu.nextAction || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Follow-Up History');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  createFollowUp,
  getFollowUps,
  getFollowUpById,
  updateFollowUp,
  deactivateFollowUp,
  getTimeline,
  getAlerts,
  getByCustomer,
  exportFollowUpsToExcel
};
