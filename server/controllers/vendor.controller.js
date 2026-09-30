const Vendor = require('../models/Vendor');
const { sendSuccess, sendError } = require('../utils/response.util');

const createVendor = async (req, res, next) => {
  try {
    const { vendorName, mobile, email, address, gstNumber, isActive } = req.body;

    if (!vendorName || !vendorName.trim()) {
      return sendError(res, 'Vendor name is required.', 400);
    }

    const vendor = await Vendor.create({
      vendorName: vendorName.trim(),
      mobile: mobile ? mobile.trim() : null,
      email: email ? email.trim().toLowerCase() : null,
      address: address || null,
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    return sendSuccess(res, 'Vendor created successfully.', vendor, 201);
  } catch (error) {
    next(error);
  }
};

const getVendors = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { vendorName: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { gstNumber: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const vendors = await Vendor.find(filter)
      .populate('createdBy', 'name')
      .sort({ vendorName: 1 });

    return sendSuccess(res, 'Vendors retrieved successfully.', vendors);
  } catch (error) {
    next(error);
  }
};

const getVendorById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const vendor = await Vendor.findById(id).populate('createdBy', 'name').populate('updatedBy', 'name');

    if (!vendor) {
      return sendError(res, 'Vendor not found.', 404);
    }

    return sendSuccess(res, 'Vendor retrieved successfully.', vendor);
  } catch (error) {
    next(error);
  }
};

const updateVendor = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { vendorName, mobile, email, address, gstNumber, isActive } = req.body;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return sendError(res, 'Vendor not found.', 404);
    }

    if (vendorName) vendor.vendorName = vendorName.trim();
    if (mobile !== undefined) vendor.mobile = mobile ? mobile.trim() : null;
    if (email !== undefined) vendor.email = email ? email.trim().toLowerCase() : null;
    if (address !== undefined) vendor.address = address;
    if (gstNumber !== undefined) vendor.gstNumber = gstNumber ? gstNumber.trim().toUpperCase() : null;
    if (isActive !== undefined) vendor.isActive = isActive;

    vendor.updatedBy = req.user._id;
    await vendor.save();

    return sendSuccess(res, 'Vendor updated successfully.', vendor);
  } catch (error) {
    next(error);
  }
};

const deactivateVendor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vendor = await Vendor.findById(id);
    if (!vendor) {
      return sendError(res, 'Vendor not found.', 404);
    }

    vendor.isActive = false;
    vendor.updatedBy = req.user._id;
    await vendor.save();

    return sendSuccess(res, 'Vendor deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deactivateVendor
};
