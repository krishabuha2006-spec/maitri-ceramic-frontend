const express = require('express');
const router = express.Router();
const quotationController = require('../controllers/quotation.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');

// All quotation routes require authentication
router.use(authenticate);

// List & Helper Queries (Must be declared before /:id)
router.get('/', checkPermission('QUOTATION', 'view'), applyDataScope, quotationController.listQuotations);
router.get('/pending', checkPermission('QUOTATION', 'view'), applyDataScope, quotationController.getPendingQuotations);
router.get('/company-products/:companyId', checkPermission('QUOTATION', 'view'), quotationController.getCompanyProducts);

// Create route
router.post('/', checkPermission('QUOTATION', 'create'), quotationController.createQuotation);

// Single Quotation Operations
router.get('/:id', checkPermission('QUOTATION', 'view'), applyDataScope, quotationController.getQuotationById);
router.put('/:id', checkPermission('QUOTATION', 'edit'), applyDataScope, quotationController.updateQuotation);

// Workflow Status Transitions
router.put('/:id/send', checkPermission('QUOTATION', 'approve'), applyDataScope, quotationController.sendQuotation);
router.put('/:id/cancel', checkPermission('QUOTATION', 'delete'), applyDataScope, quotationController.cancelQuotation);

// Presentation & Export Engines
router.get('/:id/render', checkPermission('QUOTATION', 'view'), applyDataScope, quotationController.renderQuotation);
router.get('/:id/export', checkPermission('QUOTATION', 'export'), applyDataScope, quotationController.exportQuotation);

module.exports = router;
