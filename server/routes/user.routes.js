const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('USER_MANAGEMENT', 'create'), userController.createUser);
router.get('/', checkPermission('USER_MANAGEMENT', 'view'), userController.getUsers);
router.get('/:id', checkPermission('USER_MANAGEMENT', 'view'), userController.getUserById);
router.put('/:id', checkPermission('USER_MANAGEMENT', 'edit'), userController.updateUser);
router.put('/:id/deactivate', checkPermission('USER_MANAGEMENT', 'delete'), userController.deactivateUser);
router.put('/:id/reset-password', checkPermission('USER_MANAGEMENT', 'edit'), userController.resetPassword);
router.delete('/:id', checkPermission('USER_MANAGEMENT', 'delete'), userController.deleteUser);

module.exports = router;
