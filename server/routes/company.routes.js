const express = require('express');
const router = express.Router();
const companyController = require('../controllers/company.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

router.use(authenticate);

router.post('/', checkPermission('COMPANY_MASTER', 'create'), companyController.createCompany);
router.get('/', checkPermission('COMPANY_MASTER', 'view'), companyController.getCompanies);
router.get('/:id', checkPermission('COMPANY_MASTER', 'view'), companyController.getCompanyById);
router.put('/:id', checkPermission('COMPANY_MASTER', 'edit'), companyController.updateCompany);
router.put('/:id/deactivate', checkPermission('COMPANY_MASTER', 'delete'), companyController.deactivateCompany);
router.delete('/:id', checkPermission('COMPANY_MASTER', 'delete'), companyController.deactivateCompany);

module.exports = router;
