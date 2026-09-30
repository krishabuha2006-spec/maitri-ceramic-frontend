const express = require('express');
const router = express.Router();
const challanController = require('../controllers/challan.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');

// Export Challans (Must be before /:id)
router.get(
  '/export',
  authenticate,
  checkPermission('CHALLAN', 'export'),
  applyDataScope,
  challanController.exportChallans
);

// Create DRAFT Challan
router.post(
  '/',
  authenticate,
  checkPermission('CHALLAN', 'create'),
  challanController.create
);

// List Challans
router.get(
  '/',
  authenticate,
  checkPermission('CHALLAN', 'view'),
  applyDataScope,
  challanController.list
);

// Delivery Note Print View
router.get(
  '/:id/print',
  authenticate,
  checkPermission('CHALLAN', 'view'),
  applyDataScope,
  challanController.print
);

// Finalize Challan (Atomic Dual-Write)
router.put(
  '/:id/finalize',
  authenticate,
  checkPermission('CHALLAN', 'approve'),
  applyDataScope,
  challanController.finalize
);

// Cancel DRAFT Challan
router.put(
  '/:id/cancel',
  authenticate,
  checkPermission('CHALLAN', 'delete'),
  applyDataScope,
  challanController.cancel
);

// Update DRAFT Challan
router.put(
  '/:id',
  authenticate,
  checkPermission('CHALLAN', 'edit'),
  applyDataScope,
  challanController.update
);

// Get single Challan by ID
router.get(
  '/:id',
  authenticate,
  checkPermission('CHALLAN', 'view'),
  applyDataScope,
  challanController.getById
);

module.exports = router;
