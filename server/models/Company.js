const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    companyType: {
      type: String,
      enum: ['OWN', 'BRAND_MANUFACTURER'],
      default: 'BRAND_MANUFACTURER'
    },
    logo: {
      type: String,
      default: null,
      trim: true
    },
    gstNumber: {
      type: String,
      default: null,
      trim: true,
      uppercase: true
    },
    address: {
      type: String,
      default: null,
      trim: true
    },
    contactPerson: {
      type: String,
      default: null,
      trim: true
    },
    contactMobile: {
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

module.exports = mongoose.model('Company', companySchema);
