const express = require('express');
const router = express.Router();
const taxController = require('../controllers/tax.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('TAX_MASTER', 'create'), taxController.createTax);
router.get('/', checkPermission('TAX_MASTER', 'view'), taxController.getTaxes);
router.put('/:id', checkPermission('TAX_MASTER', 'edit'), taxController.updateTax);
router.put('/:id/deactivate', checkPermission('TAX_MASTER', 'delete'), taxController.deactivateTax);
router.delete('/:id', checkPermission('TAX_MASTER', 'delete'), taxController.deactivateTax);

module.exports = router;
