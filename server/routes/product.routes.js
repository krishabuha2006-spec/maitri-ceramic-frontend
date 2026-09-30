const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');
const { handleImageUpload } = require('../middlewares/upload.middleware');

router.use(authenticate);

// Specialized endpoints before parameterized /:id
router.post(
  '/upload-image',
  checkPermission('PRODUCT_MASTER', 'create'),
  handleImageUpload('image'),
  productController.uploadProductImage
);
router.get('/export', checkPermission('PRODUCT_MASTER', 'export'), productController.exportProducts);
router.get('/search-by-sku', checkPermission('PRODUCT_MASTER', 'view'), productController.searchBySku);
router.get('/low-stock', checkPermission('PRODUCT_MASTER', 'view'), productController.getLowStockProducts);
router.post('/bulk-delete', checkPermission('PRODUCT_MASTER', 'delete'), productController.bulkDeleteProducts);
router.delete('/delete-all', checkPermission('PRODUCT_MASTER', 'delete'), productController.deleteAllProducts);
router.post('/delete-all', checkPermission('PRODUCT_MASTER', 'delete'), productController.deleteAllProducts);

// Standard CRUD
router.post('/', checkPermission('PRODUCT_MASTER', 'create'), productController.createProduct);
router.get('/', checkPermission('PRODUCT_MASTER', 'view'), productController.getProducts);
router.get('/:id', checkPermission('PRODUCT_MASTER', 'view'), productController.getProductById);
router.put('/:id', checkPermission('PRODUCT_MASTER', 'edit'), productController.updateProduct);
router.put('/:id/deactivate', checkPermission('PRODUCT_MASTER', 'delete'), productController.deactivateProduct);
router.delete('/:id', checkPermission('PRODUCT_MASTER', 'delete'), productController.deleteProduct);

// Forward reference: Quotation Usage (Module 14 / Product-Quotation Tracking)
router.get(
  '/:id/quotation-usage',
  checkPermission('PRODUCT_MASTER', 'view'),
  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view'),
  productController.getProductQuotationUsage
);

module.exports = router;
