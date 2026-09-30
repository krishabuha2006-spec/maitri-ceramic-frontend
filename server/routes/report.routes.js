const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');
const { conditionalExportPermission } = require('../middlewares/report.middleware');

// All report routes require authentication
router.use(authenticate);

/**
 * 1. Report Catalog Discovery
 */
router.get(
  '/catalog',
  checkPermission('REPORTS', 'view'),
  reportController.getCatalog
);

/**
 * 2. Saved Report Filters
 */
router.post(
  '/saved-filters',
  checkPermission('REPORTS', 'view'),
  reportController.createSavedFilter
);

router.get(
  '/saved-filters',
  checkPermission('REPORTS', 'view'),
  reportController.getSavedFilters
);

router.delete(
  '/saved-filters/:id',
  checkPermission('REPORTS', 'view'),
  reportController.deleteSavedFilter
);

/**
 * 3. Export Jobs (Async)
 */
router.get(
  '/export-jobs/:jobId',
  checkPermission('REPORTS', 'export'),
  reportController.getExportJob
);

/**
 * 4. Customer Reports
 */
router.get(
  '/customers/list',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getCustomerList
);

router.get(
  '/customers/outstanding',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER', 'view'),
  conditionalExportPermission,
  reportController.getCustomerOutstanding
);

router.get(
  '/customers/:id/history',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER', 'view'),
  conditionalExportPermission,
  reportController.getCustomerHistory
);

router.get(
  '/customers/:id/purchase-history',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER', 'view'),
  conditionalExportPermission,
  reportController.getCustomerPurchaseHistory
);

router.get(
  '/customers/:id/ledger',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER_LEDGER', 'view'),
  conditionalExportPermission,
  reportController.getCustomerLedger
);

/**
 * 5. Quotation Reports
 */
router.get(
  '/quotations/all',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getAllQuotations
);

router.get(
  '/quotations/pending',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getPendingQuotations
);

router.get(
  '/quotations/followup-pending',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  checkPermission('FOLLOW_UP', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getFollowupPendingQuotations
);

router.get(
  '/quotations/followup-due',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  checkPermission('FOLLOW_UP', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getFollowupDueQuotations
);

router.get(
  '/quotations/confirmed',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getConfirmedQuotations
);

router.get(
  '/quotations/rejected',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getRejectedQuotations
);

router.get(
  '/quotations/expired',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getExpiredQuotations
);

router.get(
  '/quotations/conversion',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getQuotationConversion
);

router.get(
  '/quotations/amount-vs-actual',
  checkPermission('REPORTS', 'view'),
  checkPermission('QUOTATION', 'view'),
  checkPermission('QUOTATION_CONFIRMATION', 'view'),
  conditionalExportPermission,
  reportController.getQuotationAmountVsActual
);

/**
 * 6. Product Reports
 */
router.get(
  '/products/master',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  conditionalExportPermission,
  reportController.getProductMaster
);

router.get(
  '/products/quotation-count',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  conditionalExportPermission,
  reportController.getProductQuotationCount
);

router.get(
  '/products/customer-list',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  conditionalExportPermission,
  reportController.getProductCustomerList
);

router.get(
  '/products/quotation-value',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  conditionalExportPermission,
  reportController.getProductQuotationValue
);

router.get(
  '/products/stock',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getProductStock
);

router.get(
  '/products/low-stock',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getProductLowStock
);

router.get(
  '/products/reorder-items',
  checkPermission('REPORTS', 'view'),
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getProductReorderItems
);

/**
 * 7. Stock Reports
 */
router.get(
  '/stock/opening',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockOpening
);

router.get(
  '/stock/in',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockIn
);

router.get(
  '/stock/out',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockOut
);

router.get(
  '/stock/challan-deduction',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockChallanDeduction
);

router.get(
  '/stock/actual',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockActual
);

router.get(
  '/stock/management',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockManagement
);

router.get(
  '/stock/movement-history',
  checkPermission('REPORTS', 'view'),
  checkPermission('STOCK', 'view'),
  conditionalExportPermission,
  reportController.getStockMovementHistory
);

/**
 * 8. Sales & Financial Reports
 */
router.get(
  '/finance/invoices',
  checkPermission('REPORTS', 'view'),
  checkPermission('INVOICE', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getFinanceInvoices
);

router.get(
  '/finance/payment-collection',
  checkPermission('REPORTS', 'view'),
  checkPermission('PAYMENT', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getFinancePaymentCollection
);

router.get(
  '/finance/payment-receipts',
  checkPermission('REPORTS', 'view'),
  checkPermission('PAYMENT', 'view'),
  conditionalExportPermission,
  applyDataScope,
  reportController.getFinancePaymentReceipts
);

router.get(
  '/finance/outstanding',
  checkPermission('REPORTS', 'view'),
  checkPermission('PAYMENT', 'view'),
  conditionalExportPermission,
  reportController.getFinanceOutstanding
);

router.get(
  '/finance/customer-ledger',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER_LEDGER', 'view'),
  conditionalExportPermission,
  reportController.getFinanceCustomerLedger
);

router.get(
  '/finance/credit-debit',
  checkPermission('REPORTS', 'view'),
  checkPermission('CUSTOMER_LEDGER', 'view'),
  conditionalExportPermission,
  reportController.getFinanceCreditDebit
);

module.exports = router;
