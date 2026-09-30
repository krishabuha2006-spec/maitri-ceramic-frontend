const mongoose = require('mongoose');
const XLSX = require('xlsx');
const ActivityLogEntry = require('../models/ActivityLogEntry');
const User = require('../models/User');

const SENSITIVE_REDACT_FIELDS = ['password', 'passwordHash', 'refreshToken', 'token'];

/**
 * Mask sensitive strings (e.g. payment / bank account reference)
 */
const maskSensitiveString = (str) => {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= 4) return '****';
  return '****' + str.slice(-4);
};

/**
 * Compute field-level diff between before and after document states
 */
const computeDiff = (oldDoc, newDoc, trackedFields = null, isPermissionChange = false) => {
  if (!oldDoc || !newDoc) return null;

  const oldObj = oldDoc.toObject ? oldDoc.toObject() : oldDoc;
  const newObj = newDoc.toObject ? newDoc.toObject() : newDoc;

  const diff = {};
  const keysToCheck = trackedFields && Array.isArray(trackedFields) && trackedFields.length > 0
    ? trackedFields
    : Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

  for (const key of keysToCheck) {
    // Hard-coded never-log fields
    if (SENSITIVE_REDACT_FIELDS.includes(key)) {
      continue;
    }

    if (['_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
      continue;
    }

    const valBefore = oldObj[key];
    const valAfter = newObj[key];

    const strBefore = JSON.stringify(valBefore);
    const strAfter = JSON.stringify(valAfter);

    if (strBefore !== strAfter) {
      if (!isPermissionChange && (key.toLowerCase().includes('refnumber') || key.toLowerCase().includes('accountno') || key.toLowerCase().includes('chequeno'))) {
        diff[key] = {
          before: typeof valBefore === 'string' ? maskSensitiveString(valBefore) : valBefore,
          after: typeof valAfter === 'string' ? maskSensitiveString(valAfter) : valAfter
        };
      } else {
        diff[key] = {
          before: valBefore !== undefined ? valBefore : null,
          after: valAfter !== undefined ? valAfter : null
        };
      }
    }
  }

  return Object.keys(diff).length > 0 ? diff : null;
};

/**
 * Record an activity log entry safely.
 * GUARANTEE: NEVER throws an error back to the caller.
 */
const record = async ({
  user,
  moduleKey,
  actionType,
  entityType = null,
  entityId = null,
  entityLabel = null,
  changeSummary = null,
  ipAddress = null,
  userAgent = null
}) => {
  try {
    if (!user || !moduleKey || !actionType) {
      console.warn('[ActivityLog] Missing required parameters for audit log recording');
      return null;
    }

    let userId = user;
    let userNameSnapshot = 'System';

    if (typeof user === 'object' && user._id) {
      userId = user._id;
      userNameSnapshot = user.name || user.fullName || user.mobile || 'User';
    } else if (mongoose.Types.ObjectId.isValid(user)) {
      const foundUser = await User.findById(user).select('name mobile').lean();
      if (foundUser) {
        userNameSnapshot = foundUser.name || foundUser.mobile || 'User';
      }
    }

    // Create the immutable log entry
    const entry = await ActivityLogEntry.create({
      user: userId,
      userNameSnapshot,
      moduleKey: String(moduleKey).toUpperCase(),
      actionType,
      entityType: entityType ? String(entityType) : null,
      entityId: entityId || null,
      entityLabel: entityLabel ? String(entityLabel) : null,
      changeSummary,
      ipAddress,
      userAgent,
      status: 'SUCCESS'
    });

    return entry;
  } catch (error) {
    // SILENT CATCH: never propagate to calling business logic
    console.error('[ActivityLog Error] Failed to write activity log entry:', error.message);
    return null;
  }
};

/**
 * Query Activity Logs with standard pagination, filtering, and sorting
 */
const list = async ({
  userId,
  moduleKey,
  actionType,
  entityType,
  entityId,
  from,
  to,
  page = 1,
  limit = 50,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) => {
  const query = {};

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    query.user = userId;
  }

  if (moduleKey) {
    query.moduleKey = String(moduleKey).toUpperCase();
  }

  if (actionType) {
    query.actionType = String(actionType).toUpperCase();
  }

  if (entityType) {
    query.entityType = String(entityType);
  }

  if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
    query.entityId = entityId;
  }

  if (from || to) {
    query.createdAt = {};
    if (from) {
      const fromDate = new Date(from);
      fromDate.setHours(0, 0, 0, 0);
      query.createdAt.$gte = fromDate;
    }
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query.createdAt.$lte = toDate;
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortOptions = { [sortBy || 'createdAt']: sortDirection };

  const [data, totalRecords] = await Promise.all([
    ActivityLogEntry.find(query)
      .populate('user', 'name mobile email')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ActivityLogEntry.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limitNum) || 1
    }
  };
};

/**
 * Get single Activity Log entry by ID
 */
const getById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return await ActivityLogEntry.findById(id)
    .populate('user', 'name mobile email role')
    .lean();
};

/**
 * Get chronological timeline for a specific entity
 */
const getByEntity = async (entityType, entityId, { page = 1, limit = 50 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(entityId)) {
    return { data: [], pagination: { page: 1, limit: 50, totalRecords: 0, totalPages: 1 } };
  }

  const query = {
    entityType: String(entityType),
    entityId: new mongoose.Types.ObjectId(entityId)
  };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [data, totalRecords] = await Promise.all([
    ActivityLogEntry.find(query)
      .populate('user', 'name mobile email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ActivityLogEntry.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limitNum) || 1
    }
  };
};

/**
 * Get chronological timeline for a specific user
 */
const getByUser = async (userId, { page = 1, limit = 50 } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { data: [], pagination: { page: 1, limit: 50, totalRecords: 0, totalPages: 1 } };
  }

  const query = { user: new mongoose.Types.ObjectId(userId) };

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [data, totalRecords] = await Promise.all([
    ActivityLogEntry.find(query)
      .populate('user', 'name mobile email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ActivityLogEntry.countDocuments(query)
  ]);

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limitNum) || 1
    }
  };
};

/**
 * Export Activity Logs to Excel (.xlsx buffer)
 */
const exportExcel = async (filters) => {
  const result = await list({ ...filters, page: 1, limit: 10000 });
  const records = result.data || [];

  const rows = records.map((r, idx) => ({
    'Sr No': idx + 1,
    'Date & Time': r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
    'User Name': r.userNameSnapshot || (r.user && r.user.name) || 'Unknown',
    'User Mobile': (r.user && r.user.mobile) || '',
    'Module': r.moduleKey || '',
    'Action Type': r.actionType || '',
    'Entity Type': r.entityType || '',
    'Entity Label': r.entityLabel || '',
    'Entity ID': r.entityId ? r.entityId.toString() : '',
    'IP Address': r.ipAddress || '',
    'Status': r.status || 'SUCCESS'
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Message': 'No activity log records found.' }]);
  XLSX.utils.book_append_sheet(wb, ws, 'Audit Log');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  record,
  computeDiff,
  list,
  getById,
  getByEntity,
  getByUser,
  exportExcel,
  maskSensitiveString
};
