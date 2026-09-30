const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permission.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

// Public or bootstrap module seeding
router.post('/modules/seed', permissionController.seedModules);

// Protected routes
router.use(authenticate);

// Menu building for current user
router.get('/my-menu', permissionController.getMyMenu);

// Module registry
router.get('/modules', checkPermission('USER_MANAGEMENT', 'view'), permissionController.getModules);

// User-Wise Permission Assignment & Management
router.post('/assign', checkPermission('USER_MANAGEMENT', 'approve'), permissionController.assignUserPermissions);
router.get('/user/:userId', checkPermission('USER_MANAGEMENT', 'view'), permissionController.getUserPermissions);
router.put('/revoke', checkPermission('USER_MANAGEMENT', 'approve'), permissionController.revokeUserPermission);

module.exports = router;
