const PaymentModeMaster = require('../models/PaymentModeMaster');
const { sendSuccess, sendError } = require('../utils/response.util');

const createPaymentMode = async (req, res, next) => {
  try {
    const { modeName, isActive } = req.body;

    if (!modeName || !modeName.trim()) {
      return sendError(res, 'Payment mode name is required.', 400);
    }

    const existing = await PaymentModeMaster.findOne({ modeName: modeName.trim() });
    if (existing) {
      return sendError(res, `Payment mode '${modeName}' already exists.`, 400);
    }

    const mode = await PaymentModeMaster.create({
      modeName: modeName.trim(),
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    return sendSuccess(res, 'Payment mode created successfully.', mode, 201);
  } catch (error) {
    next(error);
  }
};

const getPaymentModes = async (req, res, next) => {
  try {
    const { search, isActive } = req.query;

    const filter = {};
    if (search) filter.modeName = { $regex: search, $options: 'i' };
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    let modes = await PaymentModeMaster.find(filter).sort({ modeName: 1 });

    if (modes.length === 0 && !search) {
      const defaultPaymentModes = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Debit/Credit Card'];
      for (const name of defaultPaymentModes) {
        await PaymentModeMaster.findOneAndUpdate(
          { modeName: name },
          { $set: { modeName: name, isActive: true } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
      modes = await PaymentModeMaster.find(filter).sort({ modeName: 1 });
    }

    return sendSuccess(res, 'Payment modes retrieved successfully.', modes);
  } catch (error) {
    next(error);
  }
};

const updatePaymentMode = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { modeName, isActive } = req.body;

    const mode = await PaymentModeMaster.findById(id);
    if (!mode) {
      return sendError(res, 'Payment mode not found.', 404);
    }

    if (modeName && modeName.trim() !== mode.modeName) {
      const duplicate = await PaymentModeMaster.findOne({ modeName: modeName.trim(), _id: { $ne: id } });
      if (duplicate) {
        return sendError(res, `Payment mode '${modeName}' already exists.`, 400);
      }
      mode.modeName = modeName.trim();
    }

    if (isActive !== undefined) mode.isActive = isActive;
    mode.updatedBy = req.user._id;

    await mode.save();
    return sendSuccess(res, 'Payment mode updated successfully.', mode);
  } catch (error) {
    next(error);
  }
};

const deactivatePaymentMode = async (req, res, next) => {
  try {
    const { id } = req.params;

    const mode = await PaymentModeMaster.findById(id);
    if (!mode) {
      return sendError(res, 'Payment mode not found.', 404);
    }

    mode.isActive = false;
    mode.updatedBy = req.user._id;
    await mode.save();

    return sendSuccess(res, 'Payment mode deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPaymentMode,
  getPaymentModes,
  updatePaymentMode,
  deactivatePaymentMode
};
