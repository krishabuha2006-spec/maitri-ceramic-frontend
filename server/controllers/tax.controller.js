const TaxMaster = require('../models/TaxMaster');
const { sendSuccess, sendError } = require('../utils/response.util');

const createTax = async (req, res, next) => {
  try {
    const { taxName, gstPct, igstPct, cgstPct, sgstPct, cessPct, isActive } = req.body;

    if (!taxName || !taxName.trim()) {
      return sendError(res, 'Tax name is required.', 400);
    }

    const existing = await TaxMaster.findOne({ taxName: taxName.trim() });
    if (existing) {
      return sendError(res, `Tax preset '${taxName}' already exists.`, 400);
    }

    const tax = await TaxMaster.create({
      taxName: taxName.trim(),
      gstPct: Number(gstPct) || 0,
      igstPct: Number(igstPct) || 0,
      cgstPct: Number(cgstPct) || 0,
      sgstPct: Number(sgstPct) || 0,
      cessPct: Number(cessPct) || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    return sendSuccess(res, 'Tax preset created successfully.', tax, 201);
  } catch (error) {
    next(error);
  }
};

const getTaxes = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    const filter = {};
    if (search) filter.taxName = { $regex: search, $options: 'i' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const taxes = await TaxMaster.find(filter).sort({ gstPct: 1, taxName: 1 });
    return sendSuccess(res, 'Tax presets retrieved successfully.', taxes);
  } catch (error) {
    next(error);
  }
};

const updateTax = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { taxName, gstPct, igstPct, cgstPct, sgstPct, cessPct, isActive } = req.body;

    const tax = await TaxMaster.findById(id);
    if (!tax) {
      return sendError(res, 'Tax preset not found.', 404);
    }

    if (taxName && taxName.trim() !== tax.taxName) {
      const duplicate = await TaxMaster.findOne({ taxName: taxName.trim(), _id: { $ne: id } });
      if (duplicate) {
        return sendError(res, `Tax preset '${taxName}' already exists.`, 400);
      }
      tax.taxName = taxName.trim();
    }

    if (gstPct !== undefined) tax.gstPct = Number(gstPct);
    if (igstPct !== undefined) tax.igstPct = Number(igstPct);
    if (cgstPct !== undefined) tax.cgstPct = Number(cgstPct);
    if (sgstPct !== undefined) tax.sgstPct = Number(sgstPct);
    if (cessPct !== undefined) tax.cessPct = Number(cessPct);
    if (isActive !== undefined) tax.isActive = isActive;
    tax.updatedBy = req.user._id;

    await tax.save();
    return sendSuccess(res, 'Tax preset updated successfully.', tax);
  } catch (error) {
    next(error);
  }
};

const deactivateTax = async (req, res, next) => {
  try {
    const { id } = req.params;

    const tax = await TaxMaster.findById(id);
    if (!tax) {
      return sendError(res, 'Tax preset not found.', 404);
    }

    tax.isActive = false;
    tax.updatedBy = req.user._id;
    await tax.save();

    return sendSuccess(res, 'Tax preset deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTax,
  getTaxes,
  updateTax,
  deactivateTax
};
