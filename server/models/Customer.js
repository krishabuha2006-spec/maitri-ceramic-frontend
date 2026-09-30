const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      trim: true
    },
    alternateNumber: {
      type: String,
      default: null,
      trim: true
    },
    email: {
      type: String,
      default: null,
      trim: true,
      lowercase: true
    },
    billingAddress: {
      type: String,
      default: null,
      trim: true
    },
    shippingAddress: {
      type: String,
      default: null,
      trim: true
    },
    city: {
      type: String,
      default: null,
      trim: true
    },
    state: {
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
    customerType: {
      type: String,
      enum: ['RETAIL', 'DEALER', 'CONTRACTOR', 'PLUMBER', 'OTHER'],
      default: 'RETAIL'
    },
    reference: {
      type: String,
      default: null,
      trim: true
    },
    referenceBy: {
      type: String,
      default: null,
      trim: true
    },
    notes: {
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
      required: [true, 'CreatedBy user reference is required']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

// Search & filter indexes
customerSchema.index({ customerName: 'text', mobile: 'text' });
customerSchema.index({ customerType: 1, city: 1, isActive: 1 });
customerSchema.index({ mobile: 1 });
customerSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('Customer', customerSchema);
