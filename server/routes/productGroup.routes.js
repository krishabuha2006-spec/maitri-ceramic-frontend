const express = require('express');
const router = express.Router();
const productGroupController = require('../controllers/productGroup.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('PRODUCT_GROUP_MASTER', 'create'), productGroupController.createProductGroup);
router.get('/', checkPermission('PRODUCT_GROUP_MASTER', 'view'), productGroupController.getProductGroups);
router.put('/:id', checkPermission('PRODUCT_GROUP_MASTER', 'edit'), productGroupController.updateProductGroup);
router.put('/:id/deactivate', checkPermission('PRODUCT_GROUP_MASTER', 'delete'), productGroupController.deactivateProductGroup);
router.delete('/:id', checkPermission('PRODUCT_GROUP_MASTER', 'delete'), productGroupController.deactivateProductGroup);

module.exports = router;
