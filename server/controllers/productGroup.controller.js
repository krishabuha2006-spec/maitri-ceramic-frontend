const ProductGroup = require('../models/ProductGroup');
const { sendSuccess, sendError } = require('../utils/response.util');

const createProductGroup = async (req, res, next) => {
  try {
    const { groupName, typeName, category, subTypes, description, isActive } = req.body;
    const name = (groupName || typeName || '').trim();

    if (!name) {
      return sendError(res, 'Product Type name is required.', 400);
    }

    const existing = await ProductGroup.findOne({ groupName: name });
    if (existing) {
      return sendError(res, `Product Type '${name}' already exists.`, 400);
    }

    const parsedSubTypes = Array.isArray(subTypes)
      ? subTypes.map(s => String(s).trim()).filter(Boolean)
      : (typeof subTypes === 'string' ? subTypes.split(',').map(s => s.trim()).filter(Boolean) : []);

    const group = await ProductGroup.create({
      groupName: name,
      category: category ? category.trim() : 'Sanitaryware',
      subTypes: parsedSubTypes,
      description: description || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    return sendSuccess(res, 'Product Type created successfully.', group, 201);
  } catch (error) {
    next(error);
  }
};

const getProductGroups = async (req, res, next) => {
  try {
    const { search, category, isActive } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { groupName: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { subTypes: { $in: [new RegExp(search, 'i')] } }
      ];
    }
    if (category) filter.category = category;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const groups = await ProductGroup.find(filter).sort({ groupName: 1 });
    return sendSuccess(res, 'Product Types retrieved successfully.', groups);
  } catch (error) {
    next(error);
  }
};

const updateProductGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { groupName, typeName, category, subTypes, description, isActive } = req.body;

    const group = await ProductGroup.findById(id);
    if (!group) {
      return sendError(res, 'Product Type not found.', 404);
    }

    const name = (groupName || typeName || '').trim();
    if (name && name !== group.groupName) {
      const duplicate = await ProductGroup.findOne({ groupName: name, _id: { $ne: id } });
      if (duplicate) {
        return sendError(res, `Product Type '${name}' already exists.`, 400);
      }
      group.groupName = name;
    }

    if (category !== undefined) group.category = category.trim();
    if (subTypes !== undefined) {
      group.subTypes = Array.isArray(subTypes)
        ? subTypes.map(s => String(s).trim()).filter(Boolean)
        : (typeof subTypes === 'string' ? subTypes.split(',').map(s => s.trim()).filter(Boolean) : []);
    }
    if (description !== undefined) group.description = description;
    if (isActive !== undefined) group.isActive = isActive;
    group.updatedBy = req.user._id;

    await group.save();
    return sendSuccess(res, 'Product Type updated successfully.', group);
  } catch (error) {
    next(error);
  }
};

const deactivateProductGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await ProductGroup.findById(id);
    if (!group) {
      return sendError(res, 'Product Type not found.', 404);
    }

    group.isActive = false;
    group.updatedBy = req.user._id;
    await group.save();

    return sendSuccess(res, 'Product Type deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProductGroup,
  getProductGroups,
  updateProductGroup,
  deactivateProductGroup
};
