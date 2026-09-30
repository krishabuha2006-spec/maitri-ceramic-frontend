const express = require('express');
const router = express.Router();
const returnNoteController = require('../controllers/returnNote.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');
const { stripImmutableReturnFields } = require('../middlewares/returnNote.middleware');

// Export Return Notes (must be before /:id)
router.get(
  '/export',
  authenticate,
  checkPermission('RETURN_NOTE', 'export'),
  applyDataScope,
  returnNoteController.exportReturnsToExcel
);

// Create Purchase Return (DRAFT)
router.post(
  '/purchase-return',
  authenticate,
  checkPermission('RETURN_NOTE', 'create'),
  returnNoteController.createPurchaseReturn
);

// Create Sales Return (DRAFT)
router.post(
  '/sales-return',
  authenticate,
  checkPermission('RETURN_NOTE', 'create'),
  returnNoteController.createSalesReturn
);

// List Return Notes
router.get(
  '/',
  authenticate,
  checkPermission('RETURN_NOTE', 'view'),
  applyDataScope,
  returnNoteController.getReturns
);

// Get Return Note by ID
router.get(
  '/:id',
  authenticate,
  checkPermission('RETURN_NOTE', 'view'),
  returnNoteController.getReturnById
);

// Update Return Note
router.put(
  '/:id',
  authenticate,
  checkPermission('RETURN_NOTE', 'edit'),
  stripImmutableReturnFields,
  returnNoteController.updateReturn
);

// Cancel Return Note (DRAFT only)
router.put(
  '/:id/cancel',
  authenticate,
  checkPermission('RETURN_NOTE', 'delete'),
  returnNoteController.cancelReturn
);

// Confirm Return Note (Stock Movement Trigger - Gated by approve)
router.put(
  '/:id/confirm',
  authenticate,
  checkPermission('RETURN_NOTE', 'approve'),
  returnNoteController.confirmReturn
);

module.exports = router;
