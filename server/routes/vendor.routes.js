const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('VENDOR_MASTER', 'create'), vendorController.createVendor);
router.get('/', checkPermission('VENDOR_MASTER', 'view'), vendorController.getVendors);
router.get('/:id', checkPermission('VENDOR_MASTER', 'view'), vendorController.getVendorById);
router.put('/:id', checkPermission('VENDOR_MASTER', 'edit'), vendorController.updateVendor);
router.put('/:id/deactivate', checkPermission('VENDOR_MASTER', 'delete'), vendorController.deactivateVendor);
router.delete('/:id', checkPermission('VENDOR_MASTER', 'delete'), vendorController.deactivateVendor);

module.exports = router;
