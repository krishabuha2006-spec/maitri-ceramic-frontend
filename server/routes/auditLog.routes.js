const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLog.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

/**
 * Primary Audit Log routes
 */
router.get(
  '/',
  authenticate,
  checkPermission('AUDIT_LOG', 'view'),
  auditLogController.list
);

router.get(
  '/export',
  authenticate,
  checkPermission('AUDIT_LOG', 'export'),
  auditLogController.exportAuditLog
);

router.get(
  '/entity/:entityType/:entityId',
  authenticate,
  checkPermission('AUDIT_LOG', 'view'),
  auditLogController.getByEntity
);

router.get(
  '/user/:userId',
  authenticate,
  checkPermission('AUDIT_LOG', 'view'),
  auditLogController.getByUser
);

router.get(
  '/:id',
  authenticate,
  checkPermission('AUDIT_LOG', 'view'),
  auditLogController.getById
);

module.exports = router;
