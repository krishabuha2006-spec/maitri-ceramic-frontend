const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission, applyDataScope } = require('../middlewares/permission.middleware');

// All routes require authentication
router.use(authenticate);

// List & Export routes
router.get('/', checkPermission('CUSTOMER', 'view'), applyDataScope, customerController.listCustomers);
router.get('/export', checkPermission('CUSTOMER', 'export'), applyDataScope, customerController.exportCustomers);

// Create route
router.post('/', checkPermission('CUSTOMER', 'create'), customerController.createCustomer);

// Single Customer Operations
router.get('/:id', checkPermission('CUSTOMER', 'view'), applyDataScope, customerController.getCustomerById);
router.put('/:id', checkPermission('CUSTOMER', 'edit'), applyDataScope, customerController.updateCustomer);
router.put('/:id/deactivate', checkPermission('CUSTOMER', 'delete'), applyDataScope, customerController.deactivateCustomer);
router.delete('/:id', checkPermission('CUSTOMER', 'delete'), applyDataScope, customerController.deactivateCustomer);
router.put('/:id/reactivate', checkPermission('CUSTOMER', 'edit'), applyDataScope, customerController.reactivateCustomer);

// Aggregated Journey & Financial History
router.get('/:id/history', checkPermission('CUSTOMER', 'view'), applyDataScope, customerController.getCustomerHistory);
router.get('/:id/outstanding', checkPermission('CUSTOMER', 'view'), applyDataScope, customerController.getCustomerOutstanding);

module.exports = router;
