const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');
const { stripImmutableFields } = require('../middlewares/invoice.middleware');

// Invoiceable Challans Discovery Route
router.get(
  '/invoiceable-challans',
  authenticate,
  checkPermission('INVOICE', 'view'),
  invoiceController.getInvoiceableChallans
);

// Export Invoices to Excel
router.get(
  '/export',
  authenticate,
  checkPermission('INVOICE', 'export'),
  invoiceController.exportInvoices
);

// Create Invoice
router.post(
  '/',
  authenticate,
  checkPermission('INVOICE', 'create'),
  invoiceController.createInvoice
);

// List Invoices
router.get(
  '/',
  authenticate,
  checkPermission('INVOICE', 'view'),
  invoiceController.getInvoices
);

// Get Invoice by ID
router.get(
  '/:id',
  authenticate,
  checkPermission('INVOICE', 'view'),
  invoiceController.getInvoiceById
);

// Update Non-monetary Header fields
router.put(
  '/:id',
  authenticate,
  checkPermission('INVOICE', 'edit'),
  stripImmutableFields,
  invoiceController.updateInvoice
);

// Cancel Invoice (and reopen source Challans)
router.put(
  '/:id/cancel',
  authenticate,
  checkPermission('INVOICE', 'delete'),
  invoiceController.cancelInvoice
);

// Get Invoice Balance Due
router.get(
  '/:id/balance-due',
  authenticate,
  checkPermission('INVOICE', 'view'),
  invoiceController.getBalanceDue
);

// Print / Tax Invoice View
router.get(
  '/:id/print',
  authenticate,
  checkPermission('INVOICE', 'view'),
  invoiceController.getPrintData
);

module.exports = router;

