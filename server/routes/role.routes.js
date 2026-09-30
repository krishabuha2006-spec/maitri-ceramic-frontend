const express = require('express');
const router = express.Router();
const roleController = require('../controllers/role.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('USER_MANAGEMENT', 'create'), roleController.createRole);
router.get('/', checkPermission('USER_MANAGEMENT', 'view'), roleController.getRoles);
router.put('/:id', checkPermission('USER_MANAGEMENT', 'edit'), roleController.updateRole);
router.delete('/:id', checkPermission('USER_MANAGEMENT', 'delete'), roleController.deleteRole);

router.post('/:id/default-permissions', checkPermission('USER_MANAGEMENT', 'approve'), roleController.setDefaultPermissions);
router.get('/:id/default-permissions', checkPermission('USER_MANAGEMENT', 'view'), roleController.getDefaultPermissions);

module.exports = router;
