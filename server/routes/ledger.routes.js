const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledger.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

// Export Statement / Ledger Report
router.get(
  '/export',
  checkPermission('CUSTOMER_LEDGER', 'export'),
  ledgerController.exportLedger
);

// Customer Ledger Read Views
router.get(
  '/customer/:customerId',
  checkPermission('CUSTOMER_LEDGER', 'view'),
  ledgerController.getCustomerLedger
);

router.get(
  '/customer/:customerId/current-balance',
  checkPermission('CUSTOMER_LEDGER', 'view'),
  ledgerController.getCurrentBalance
);

router.get(
  '/customer/:customerId/statement',
  checkPermission('CUSTOMER_LEDGER', 'view'),
  ledgerController.getCustomerStatement
);

// Manual Credit / Debit Entry (Double Gate: create + approve)
router.post(
  '/manual-entry',
  checkPermission('CUSTOMER_LEDGER', 'create'),
  checkPermission('CUSTOMER_LEDGER', 'approve'),
  ledgerController.createManualEntry
);

// Manual Entry Reversal (Double Gate: delete + approve)
router.post(
  '/manual-entry/:id/reverse',
  checkPermission('CUSTOMER_LEDGER', 'delete'),
  checkPermission('CUSTOMER_LEDGER', 'approve'),
  ledgerController.reverseManualEntry
);

module.exports = router;
