const mongoose = require('mongoose');

const systemModuleSchema = new mongoose.Schema(
  {
    moduleKey: {
      type: String,
      required: [true, 'Module key is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    moduleName: {
      type: String,
      required: [true, 'Module name is required'],
      trim: true
    },
    parentModule: {
      type: String,
      default: null,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('SystemModule', systemModuleSchema);
