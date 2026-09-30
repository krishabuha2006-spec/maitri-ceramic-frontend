const mongoose = require('mongoose');

const productGroupSchema = new mongoose.Schema(
  {
    groupName: {
      type: String,
      required: [true, 'Group name is required'],
      unique: true,
      trim: true
    },
    category: {
      type: String,
      default: 'Sanitaryware',
      trim: true
    },
    subTypes: {
      type: [String],
      default: []
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

module.exports = mongoose.model('ProductGroup', productGroupSchema);
