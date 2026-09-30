const mongoose = require('mongoose');

const unitMasterSchema = new mongoose.Schema(
  {
    unitName: {
      type: String,
      required: [true, 'Unit name is required'],
      unique: true,
      trim: true
    },
    unitCode: {
      type: String,
      required: [true, 'Unit code is required'],
      unique: true,
      trim: true,
      uppercase: true
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

module.exports = mongoose.model('UnitMaster', unitMasterSchema);
