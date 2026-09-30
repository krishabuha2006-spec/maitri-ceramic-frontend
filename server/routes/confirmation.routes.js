const express = require('express');
const router = express.Router();
const confirmationController = require('../controllers/confirmation.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');

// Confirmation CRUD & Endpoints
router.post(
  '/',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'create'),
  confirmationController.create
);

router.get(
  '/',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'view'),
  applyDataScope,
  confirmationController.list
);

router.get(
  '/:id/quantity-ledger',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'view'),
  applyDataScope,
  confirmationController.getQuantityLedger
);

router.get(
  '/:id/amount-comparison',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'view'),
  applyDataScope,
  confirmationController.getAmountComparison
);

router.get(
  '/:id/export',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'export'),
  applyDataScope,
  confirmationController.exportConfirmation
);

router.get(
  '/:id',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'view'),
  applyDataScope,
  confirmationController.getById
);

router.put(
  '/:id/approve',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'approve'),
  confirmationController.approve
);

router.put(
  '/:id/cancel',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'delete'),
  applyDataScope,
  confirmationController.cancel
);

router.put(
  '/:id',
  authenticate,
  checkPermission('QUOTATION_CONFIRMATION', 'edit'),
  applyDataScope,
  confirmationController.update
);

module.exports = router;
