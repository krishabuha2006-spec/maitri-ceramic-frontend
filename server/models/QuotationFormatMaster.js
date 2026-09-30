const mongoose = require('mongoose');

const quotationFormatMasterSchema = new mongoose.Schema(
  {
    formatKey: {
      type: String,
      required: [true, 'Format key is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    formatName: {
      type: String,
      required: [true, 'Format name is required'],
      trim: true
    },
    description: {
      type: String,
      default: null,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('QuotationFormatMaster', quotationFormatMasterSchema);
