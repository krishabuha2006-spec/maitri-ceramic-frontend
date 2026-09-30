const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unit.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('UNIT_MASTER', 'create'), unitController.createUnit);
router.get('/', checkPermission('UNIT_MASTER', 'view'), unitController.getUnits);
router.put('/:id', checkPermission('UNIT_MASTER', 'edit'), unitController.updateUnit);
router.put('/:id/deactivate', checkPermission('UNIT_MASTER', 'delete'), unitController.deactivateUnit);
router.delete('/:id', checkPermission('UNIT_MASTER', 'delete'), unitController.deactivateUnit);

module.exports = router;
