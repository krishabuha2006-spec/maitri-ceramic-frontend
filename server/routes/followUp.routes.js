const express = require('express');
const router = express.Router();
const followUpController = require('../controllers/followUp.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');

// Follow-Up CRUD & Operations
router.post(
  '/',
  authenticate,
  checkPermission('FOLLOW_UP', 'create'),
  followUpController.create
);

router.get(
  '/alerts',
  authenticate,
  checkPermission('FOLLOW_UP', 'view'),
  applyDataScope,
  followUpController.getAlerts
);

router.get(
  '/export',
  authenticate,
  checkPermission('FOLLOW_UP', 'export'),
  applyDataScope,
  followUpController.exportFollowUps
);

router.get(
  '/quotation/:quotationId/timeline',
  authenticate,
  checkPermission('FOLLOW_UP', 'view'),
  applyDataScope,
  followUpController.getTimeline
);

router.get(
  '/',
  authenticate,
  checkPermission('FOLLOW_UP', 'view'),
  applyDataScope,
  followUpController.list
);

router.get(
  '/:id',
  authenticate,
  checkPermission('FOLLOW_UP', 'view'),
  applyDataScope,
  followUpController.getById
);

router.put(
  '/:id/deactivate',
  authenticate,
  checkPermission('FOLLOW_UP', 'delete'),
  applyDataScope,
  followUpController.deactivate
);

router.delete(
  '/:id',
  authenticate,
  checkPermission('FOLLOW_UP', 'delete'),
  applyDataScope,
  followUpController.deactivate
);

router.put(
  '/:id',
  authenticate,
  checkPermission('FOLLOW_UP', 'edit'),
  applyDataScope,
  followUpController.update
);

module.exports = router;