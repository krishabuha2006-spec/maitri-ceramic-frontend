const express = require('express');
const router = express.Router();
const quotationFormatController = require('../controllers/quotationFormat.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('QUOTATION_FORMAT_MASTER', 'create'), quotationFormatController.createQuotationFormat);
router.get('/', checkPermission('QUOTATION_FORMAT_MASTER', 'view'), quotationFormatController.getQuotationFormats);
router.put('/:id', checkPermission('QUOTATION_FORMAT_MASTER', 'edit'), quotationFormatController.updateQuotationFormat);
router.put('/:id/deactivate', checkPermission('QUOTATION_FORMAT_MASTER', 'delete'), quotationFormatController.deactivateQuotationFormat);
router.delete('/:id', checkPermission('QUOTATION_FORMAT_MASTER', 'delete'), quotationFormatController.deactivateQuotationFormat);

module.exports = router;
