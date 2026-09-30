const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// Public / open reads for dashboard and forms
router.get('/', categoryController.getCategories);
router.get('/:id', categoryController.getCategoryById);

// Protected writes
router.post('/', authenticate, categoryController.createCategory);
router.put('/:id', authenticate, categoryController.updateCategory);
router.put('/:id/deactivate', authenticate, categoryController.deactivateCategory);
router.delete('/:id', authenticate, categoryController.deleteCategory);

module.exports = router;

