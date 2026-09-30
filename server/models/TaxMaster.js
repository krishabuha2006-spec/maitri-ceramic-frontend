const mongoose = require('mongoose');

const taxMasterSchema = new mongoose.Schema(
  {
    taxName: {
      type: String,
      required: [true, 'Tax name is required'],
      unique: true,
      trim: true
    },
    gstPct: {
      type: Number,
      default: 0,
      min: [0, 'GST % cannot be negative'],
      max: [100, 'GST % cannot exceed 100']
    },
    igstPct: {
      type: Number,
      default: 0,
      min: [0, 'IGST % cannot be negative'],
      max: [100, 'IGST % cannot exceed 100']
    },
    cgstPct: {
      type: Number,
      default: 0,
      min: [0, 'CGST % cannot be negative'],
      max: [100, 'CGST % cannot exceed 100']
    },
    sgstPct: {
      type: Number,
      default: 0,
      min: [0, 'SGST % cannot be negative'],
      max: [100, 'SGST % cannot exceed 100']
    },
    cessPct: {
      type: Number,
      default: 0,
      min: [0, 'CESS % cannot be negative'],
      max: [100, 'CESS % cannot exceed 100']
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

module.exports = mongoose.model('TaxMaster', taxMasterSchema);
