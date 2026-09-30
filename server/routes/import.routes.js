const express = require('express');
const router = express.Router();
const importController = require('../controllers/import.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');
const { handleFileUpload } = require('../middlewares/upload.middleware');

router.use(authenticate);

// Excel Import
router.post(
  '/excel/preview',
  checkPermission('PRODUCT_IMPORT', 'create'),
  handleFileUpload('file'),
  importController.previewExcel
);

router.post(
  '/excel/commit',
  checkPermission('PRODUCT_IMPORT', 'create'),
  checkPermission('PRODUCT_MASTER', 'create'),
  importController.commitExcel
);

// PDF Import
router.post(
  '/pdf/preview',
  checkPermission('PRODUCT_IMPORT', 'create'),
  handleFileUpload('file'),
  importController.previewPdf
);

router.post(
  '/pdf/commit',
  checkPermission('PRODUCT_IMPORT', 'create'),
  checkPermission('PRODUCT_MASTER', 'create'),
  importController.commitPdf
);

// Saved Field Mapping Profiles
router.get('/mappings', checkPermission('PRODUCT_IMPORT', 'view'), importController.getFieldMappings);
router.post('/mappings', checkPermission('PRODUCT_IMPORT', 'create'), importController.saveFieldMapping);
router.delete('/mappings/:id', checkPermission('PRODUCT_IMPORT', 'delete'), importController.deleteFieldMapping);

// Import History & Error Report
router.get('/', checkPermission('PRODUCT_IMPORT', 'view'), importController.getImportHistory);
router.get('/:id', checkPermission('PRODUCT_IMPORT', 'view'), importController.getImportById);
router.get('/:id/error-report', checkPermission('PRODUCT_IMPORT', 'export'), importController.downloadErrorReport);

module.exports = router;
