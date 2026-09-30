const { checkPermission } = require('./permission.middleware');

/**
 * Middleware: Conditional Export Permission
 *
 * If `?format=excel` or `?format=pdf` is provided in query,
 * enforces `checkPermission('REPORTS', 'export')`.
 * Otherwise, allows standard view access to proceed.
 */
const conditionalExportPermission = (req, res, next) => {
  const format = (req.query.format || 'json').toLowerCase();
  if (format === 'excel' || format === 'pdf') {
    return checkPermission('REPORTS', 'export')(req, res, next);
  }
  next();
};

module.exports = {
  conditionalExportPermission
};
