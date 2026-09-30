const express = require('express');
const router = express.Router();
const productTrackingController = require('../controllers/productQuotationTracking.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

// All routes require authentication
router.use(authenticate);

// Export Product Tracking Reports (must be before parameterized /:productId)
router.get(
  '/export',
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'export'),
  productTrackingController.exportReport
);

// Ranked Most Quoted Products (must be before parameterized /:productId)
router.get(
  '/most-quoted',
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  productTrackingController.getMostQuoted
);

// Product-specific Quotation Usage
router.get(
  '/:productId/quotation-usage',
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  productTrackingController.getUsage
);

// Product-specific Distinct Quoted Customers
router.get(
  '/:productId/customer-list',
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  productTrackingController.getCustomerList
);

// Recompute Summary Cache (Admin / Performance utility)
router.post(
  '/:productId/recompute-summary',
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  productTrackingController.recomputeSummary
);

module.exports = router;
