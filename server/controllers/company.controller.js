const Company = require('../models/Company');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new Company
 * @route   POST /api/companies
 * @access  checkPermission('COMPANY_MASTER', 'create')
 */
const createCompany = async (req, res, next) => {
  try {
    const { companyName, companyType, logo, gstNumber, address, contactPerson, contactMobile } = req.body;

    if (!companyName || !companyName.trim()) {
      return sendError(res, 'Company name is required.', 400);
    }

    // Ensure only one OWN company exists
    if (companyType === 'OWN') {
      const existingOwn = await Company.findOne({ companyType: 'OWN', isActive: true });
      if (existingOwn) {
        return sendError(res, `An active 'OWN' company already exists (${existingOwn.companyName}). Only one 'OWN' company is allowed.`, 400);
      }
    }

    const company = await Company.create({
      companyName: companyName.trim(),
      companyType: companyType || 'BRAND_MANUFACTURER',
      logo: logo || null,
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : null,
      address: address || null,
      contactPerson: contactPerson || null,
      contactMobile: contactMobile || null,
      createdBy: req.user._id,
      isActive: true
    });

    return sendSuccess(res, 'Company created successfully.', company, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all Companies
 * @route   GET /api/companies
 * @access  checkPermission('COMPANY_MASTER', 'view')
 */
const getCompanies = async (req, res, next) => {
  try {
    const { search, companyType, isActive } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { contactMobile: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (companyType) filter.companyType = companyType;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const companies = await Company.find(filter)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ companyType: 1, companyName: 1 });

    return sendSuccess(res, 'Companies retrieved successfully.', companies);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Company by ID
 * @route   GET /api/companies/:id
 * @access  checkPermission('COMPANY_MASTER', 'view')
 */
const getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id).populate('createdBy', 'name').populate('updatedBy', 'name');

    if (!company) {
      return sendError(res, 'Company not found.', 404);
    }

    return sendSuccess(res, 'Company retrieved successfully.', company);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Company
 * @route   PUT /api/companies/:id
 * @access  checkPermission('COMPANY_MASTER', 'edit')
 */
const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyName, companyType, logo, gstNumber, address, contactPerson, contactMobile, isActive } = req.body;

    const company = await Company.findById(id);
    if (!company) {
      return sendError(res, 'Company not found.', 404);
    }

    // If changing to or updating OWN company, ensure no duplicate active OWN
    if (companyType === 'OWN' && (company.companyType !== 'OWN' || (isActive === true && !company.isActive))) {
      const existingOwn = await Company.findOne({
        companyType: 'OWN',
        isActive: true,
        _id: { $ne: id }
      });
      if (existingOwn) {
        return sendError(res, `Another active 'OWN' company already exists (${existingOwn.companyName}).`, 400);
      }
    }

    if (companyName) company.companyName = companyName.trim();
    if (companyType) company.companyType = companyType;
    if (logo !== undefined) company.logo = logo;
    if (gstNumber !== undefined) company.gstNumber = gstNumber ? gstNumber.trim().toUpperCase() : null;
    if (address !== undefined) company.address = address;
    if (contactPerson !== undefined) company.contactPerson = contactPerson;
    if (contactMobile !== undefined) company.contactMobile = contactMobile;
    if (isActive !== undefined) company.isActive = isActive;

    company.updatedBy = req.user._id;
    await company.save();

    return sendSuccess(res, 'Company updated successfully.', company);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate Company (Soft delete only)
 * @route   PUT /api/companies/:id/deactivate
 * @access  checkPermission('COMPANY_MASTER', 'delete')
 */
const deactivateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;

    const company = await Company.findById(id);
    if (!company) {
      return sendError(res, 'Company not found.', 404);
    }

    company.isActive = false;
    company.updatedBy = req.user._id;
    await company.save();

    return sendSuccess(res, 'Company deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deactivateCompany
};
