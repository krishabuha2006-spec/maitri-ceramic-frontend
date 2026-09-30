const express = require('express');
const router = express.Router();
const paymentModeController = require('../controllers/paymentMode.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('PAYMENT_MODE_MASTER', 'create'), paymentModeController.createPaymentMode);
router.get('/', checkPermission('PAYMENT_MODE_MASTER', 'view'), paymentModeController.getPaymentModes);
router.put('/:id', checkPermission('PAYMENT_MODE_MASTER', 'edit'), paymentModeController.updatePaymentMode);
router.put('/:id/deactivate', checkPermission('PAYMENT_MODE_MASTER', 'delete'), paymentModeController.deactivatePaymentMode);
router.delete('/:id', checkPermission('PAYMENT_MODE_MASTER', 'delete'), paymentModeController.deactivatePaymentMode);

module.exports = router;
