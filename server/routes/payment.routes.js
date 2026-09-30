const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');
const { stripImmutablePaymentFields } = require('../middlewares/payment.middleware');

// Export Payments to Excel
router.get(
  '/export',
  authenticate,
  checkPermission('PAYMENT', 'export'),
  paymentController.exportPayments
);

// Customer-Level Outstanding Aggregation
router.get(
  '/customer/:customerId/outstanding',
  authenticate,
  checkPermission('PAYMENT', 'view'),
  paymentController.getCustomerOutstanding
);

// Invoice Balance Due endpoint
router.get(
  '/invoice/:id/balance-due',
  authenticate,
  checkPermission('PAYMENT', 'view'),
  paymentController.getInvoiceBalanceDue
);

// Record a Payment
router.post(
  '/',
  authenticate,
  checkPermission('PAYMENT', 'create'),
  paymentController.createPayment
);

// List Payments
router.get(
  '/',
  authenticate,
  checkPermission('PAYMENT', 'view'),
  paymentController.getPayments
);

// Get Payment by ID
router.get(
  '/:id',
  authenticate,
  checkPermission('PAYMENT', 'view'),
  paymentController.getPaymentById
);

// Update Non-monetary Metadata
router.put(
  '/:id',
  authenticate,
  checkPermission('PAYMENT', 'edit'),
  stripImmutablePaymentFields,
  paymentController.updatePayment
);

// Reverse a Payment (Double-permission gate: delete AND approve)
router.post(
  '/:id/reverse',
  authenticate,
  checkPermission('PAYMENT', 'delete'),
  checkPermission('PAYMENT', 'approve'),
  paymentController.reversePayment
);

// Get Payment Receipt
router.get(
  '/:id/receipt',
  authenticate,
  checkPermission('PAYMENT', 'view'),
  paymentController.getReceiptData
);

module.exports = router;
