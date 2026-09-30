const UnitMaster = require('../models/UnitMaster');
const { sendSuccess, sendError } = require('../utils/response.util');

const createUnit = async (req, res, next) => {
  try {
    const { unitName, unitCode, isActive } = req.body;

    if (!unitName || !unitCode) {
      return sendError(res, 'Unit name and unit code are required.', 400);
    }

    const existingName = await UnitMaster.findOne({ unitName: unitName.trim() });
    if (existingName) {
      return sendError(res, `Unit name '${unitName}' already exists.`, 400);
    }

    const existingCode = await UnitMaster.findOne({ unitCode: unitCode.trim().toUpperCase() });
    if (existingCode) {
      return sendError(res, `Unit code '${unitCode}' already exists.`, 400);
    }

    const unit = await UnitMaster.create({
      unitName: unitName.trim(),
      unitCode: unitCode.trim().toUpperCase(),
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    return sendSuccess(res, 'Unit created successfully.', unit, 201);
  } catch (error) {
    next(error);
  }
};

const getUnits = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { unitName: { $regex: search, $options: 'i' } },
        { unitCode: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const units = await UnitMaster.find(filter).sort({ unitName: 1 });
    return sendSuccess(res, 'Units retrieved successfully.', units);
  } catch (error) {
    next(error);
  }
};

const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { unitName, unitCode, isActive } = req.body;

    const unit = await UnitMaster.findById(id);
    if (!unit) {
      return sendError(res, 'Unit not found.', 404);
    }

    if (unitName && unitName.trim() !== unit.unitName) {
      const duplicateName = await UnitMaster.findOne({ unitName: unitName.trim(), _id: { $ne: id } });
      if (duplicateName) {
        return sendError(res, `Unit name '${unitName}' already exists.`, 400);
      }
      unit.unitName = unitName.trim();
    }

    if (unitCode && unitCode.trim().toUpperCase() !== unit.unitCode) {
      const duplicateCode = await UnitMaster.findOne({ unitCode: unitCode.trim().toUpperCase(), _id: { $ne: id } });
      if (duplicateCode) {
        return sendError(res, `Unit code '${unitCode}' already exists.`, 400);
      }
      unit.unitCode = unitCode.trim().toUpperCase();
    }

    if (isActive !== undefined) unit.isActive = isActive;
    unit.updatedBy = req.user._id;

    await unit.save();
    return sendSuccess(res, 'Unit updated successfully.', unit);
  } catch (error) {
    next(error);
  }
};

const deactivateUnit = async (req, res, next) => {
  try {
    const { id } = req.params;

    const unit = await UnitMaster.findById(id);
    if (!unit) {
      return sendError(res, 'Unit not found.', 404);
    }

    unit.isActive = false;
    unit.updatedBy = req.user._id;
    await unit.save();

    return sendSuccess(res, 'Unit deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createUnit,
  getUnits,
  updateUnit,
  deactivateUnit
};
