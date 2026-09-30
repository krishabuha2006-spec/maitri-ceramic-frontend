const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema(
  {
    sourceChallan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challan',
      required: [true, 'Source Challan reference is required']
    },
    sourceChallanItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, 'Source Challan Item reference ID is required']
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
    descriptionSnapshot: {
      type: String,
      required: [true, 'Description snapshot is required'],
      trim: true
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitMaster',
      required: [true, 'Unit reference is required']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.0001, 'Quantity must be greater than 0']
    },
    rateSnapshot: {
      type: Number,
      required: [true, 'Rate snapshot is required'],
      min: [0, 'Rate snapshot cannot be negative']
    },
    discountPct: {
      type: Number,
      default: 0,
      min: [0, 'Discount percentage cannot be negative'],
      max: [100, 'Discount percentage cannot exceed 100']
    },
    gstPctSnapshot: {
      type: Number,
      default: 0,
      min: [0, 'GST percentage cannot be negative']
    },
    amount: {
      type: Number,
      required: [true, 'Computed amount is required']
    },
    discountAmount: {
      type: Number,
      required: [true, 'Computed discount amount is required'],
      default: 0
    },
    netAmount: {
      type: Number,
      required: [true, 'Computed net amount is required']
    },
    gstAmount: {
      type: Number,
      required: [true, 'Computed GST amount is required'],
      default: 0
    }
  },
  { _id: true }
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, 'Invoice number is required'],
      unique: true,
      trim: true
    },
    invoiceDate: {
      type: Date,
      required: [true, 'Invoice date is required'],
      default: Date.now
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required']
    },
    consigneeShipTo: {
      type: String,
      default: null,
      trim: true
    },
    buyerBillTo: {
      type: String,
      default: null,
      trim: true
    },
    customerMobile: {
      type: String,
      default: null,
      trim: true
    },
    customerAddress: {
      type: String,
      default: null,
      trim: true
    },
    customerGstNumber: {
      type: String,
      default: null,
      trim: true
    },
    referenceNumber: {
      type: String,
      default: null,
      trim: true
    },
    referenceDate: {
      type: Date,
      default: null
    },
    buyersOrderNumber: {
      type: String,
      default: null,
      trim: true
    },
    dispatchDocNumber: {
      type: String,
      default: null,
      trim: true
    },
    deliveryNote: {
      type: String,
      default: null,
      trim: true
    },
    termsOfPayment: {
      type: String,
      default: null,
      trim: true
    },
    termsOfDelivery: {
      type: String,
      default: null,
      trim: true
    },
    sourceChallans: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challan' }],
      default: []
    },
    sourceConfirmations: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'QuotationConfirmation' }],
      default: []
    },
    items: {
      type: [invoiceItemSchema],
      default: []
    },
    subTotal: {
      type: Number,
      default: 0
    },
    totalGst: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      default: 0
    },
    amountInWords: {
      type: String,
      default: null,
      trim: true
    },
    status: {
      type: String,
      enum: ['ISSUED', 'CANCELLED'],
      default: 'ISSUED'
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

invoiceSchema.index({ customer: 1 });
invoiceSchema.index({ sourceChallans: 1 });
invoiceSchema.index({ sourceConfirmations: 1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
