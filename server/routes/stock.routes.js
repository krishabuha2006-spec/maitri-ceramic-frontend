const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stock.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

/**
 * Conditional Approval Middleware
 * Requires STOCK:approve if reason is MANUAL_DEDUCTION
 */
const conditionalApprovalCheck = (conditionalReason) => {
  return async (req, res, next) => {
    if (req.body && req.body.reason && req.body.reason.toUpperCase() === conditionalReason.toUpperCase()) {
      return checkPermission('STOCK', 'approve')(req, res, next);
    }
    next();
  };
};

// Manual Stock In / Stock Out
router.post(
  '/entries/in',
  authenticate,
  checkPermission('STOCK', 'create'),
  stockController.stockIn
);

router.post(
  '/entries/out',
  authenticate,
  checkPermission('STOCK', 'delete'),
  conditionalApprovalCheck('MANUAL_DEDUCTION'),
  stockController.stockOut
);

// Stock Entries List
router.get(
  '/entries',
  authenticate,
  checkPermission('STOCK', 'view'),
  stockController.listEntries
);

// Reports & Alerts
router.get(
  '/low-stock-report',
  authenticate,
  checkPermission('STOCK', 'view'),
  stockController.getLowStockReport
);

router.get(
  '/purchase-alerts',
  authenticate,
  checkPermission('STOCK', 'view'),
  stockController.getPurchaseAlerts
);

router.get(
  '/export',
  authenticate,
  checkPermission('STOCK', 'export'),
  stockController.exportStock
);

// Product Specific Summary & Movement History
router.get(
  '/:productId/summary',
  authenticate,
  checkPermission('STOCK', 'view'),
  stockController.getSummary
);

router.get(
  '/:productId/movement-history',
  authenticate,
  checkPermission('STOCK', 'view'),
  stockController.getMovementHistory
);

// Admin Utility - Reconcile Stock
router.post(
  '/:productId/reconcile',
  authenticate,
  checkPermission('STOCK', 'approve'),
  stockController.reconcile
);

module.exports = router;
