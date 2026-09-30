const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const { sendSuccess, sendError } = require('../utils/response.util');

const createQuotationFormat = async (req, res, next) => {
  try {
    const { formatKey, formatName, description, isActive } = req.body;

    if (!formatKey || !formatName) {
      return sendError(res, 'Format key and format name are required.', 400);
    }

    const existing = await QuotationFormatMaster.findOne({ formatKey: formatKey.trim().toUpperCase() });
    if (existing) {
      return sendError(res, `Quotation format key '${formatKey}' already exists.`, 400);
    }

    const format = await QuotationFormatMaster.create({
      formatKey: formatKey.trim().toUpperCase(),
      formatName: formatName.trim(),
      description: description || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    return sendSuccess(res, 'Quotation format created successfully.', format, 201);
  } catch (error) {
    next(error);
  }
};

const getQuotationFormats = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { formatKey: { $regex: search, $options: 'i' } },
        { formatName: { $regex: search, $options: 'i' } }
      ];
    }
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const formats = await QuotationFormatMaster.find(filter).sort({ formatName: 1 });
    return sendSuccess(res, 'Quotation formats retrieved successfully.', formats);
  } catch (error) {
    next(error);
  }
};

const updateQuotationFormat = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { formatKey, formatName, description, isActive } = req.body;

    const format = await QuotationFormatMaster.findById(id);
    if (!format) {
      return sendError(res, 'Quotation format not found.', 404);
    }

    if (formatKey && formatKey.trim().toUpperCase() !== format.formatKey) {
      const duplicate = await QuotationFormatMaster.findOne({ formatKey: formatKey.trim().toUpperCase(), _id: { $ne: id } });
      if (duplicate) {
        return sendError(res, `Quotation format key '${formatKey}' already exists.`, 400);
      }
      format.formatKey = formatKey.trim().toUpperCase();
    }

    if (formatName) format.formatName = formatName.trim();
    if (description !== undefined) format.description = description;
    if (isActive !== undefined) format.isActive = isActive;
    format.updatedBy = req.user._id;

    await format.save();
    return sendSuccess(res, 'Quotation format updated successfully.', format);
  } catch (error) {
    next(error);
  }
};

const deactivateQuotationFormat = async (req, res, next) => {
  try {
    const { id } = req.params;

    const format = await QuotationFormatMaster.findById(id);
    if (!format) {
      return sendError(res, 'Quotation format not found.', 404);
    }

    format.isActive = false;
    format.updatedBy = req.user._id;
    await format.save();

    return sendSuccess(res, 'Quotation format deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuotationFormat,
  getQuotationFormats,
  updateQuotationFormat,
  deactivateQuotationFormat
};
