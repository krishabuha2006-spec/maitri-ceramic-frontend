const mongoose = require('mongoose');

const challanItemSchema = new mongoose.Schema(
  {
    confirmedItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Confirmed item reference ID is required']
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    skuCodeSnapshot: {
      type: String,
      default: null,
      trim: true
    },
    productNameSnapshot: {
      type: String,
      required: [true, 'Product name snapshot is required'],
      trim: true
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitMaster',
      required: [true, 'Unit reference is required']
    },
    quantityToIssue: {
      type: Number,
      required: [true, 'Quantity to issue is required'],
      min: [0.0001, 'Quantity to issue must be greater than 0']
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    }
  },
  { _id: true }
);

const challanSchema = new mongoose.Schema(
  {
    challanNumber: {
      type: String,
      required: [true, 'Challan number is required'],
      unique: true,
      trim: true
    },
    challanDate: {
      type: Date,
      required: [true, 'Challan date is required'],
      default: Date.now
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required']
    },
    customerContact: {
      type: String,
      default: null,
      trim: true
    },
    customerAddress: {
      type: String,
      default: null,
      trim: true
    },
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      default: null
    },
    confirmation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuotationConfirmation',
      required: [true, 'Quotation confirmation reference is required']
    },
    salesperson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Salesperson reference is required']
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },
    deliveryDetails: {
      type: String,
      default: null,
      trim: true
    },
    status: {
      type: String,
      enum: ['DRAFT', 'FINALIZED', 'CANCELLED'],
      default: 'DRAFT'
    },
    items: {
      type: [challanItemSchema],
      default: []
    },
    finalizedAt: {
      type: Date,
      default: null
    },
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    invoiced: {
      type: Boolean,
      default: false
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

challanSchema.index({ customer: 1 });
challanSchema.index({ confirmation: 1 });
challanSchema.index({ status: 1 });
challanSchema.index({ invoiced: 1 });
challanSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('Challan', challanSchema);

