const mongoose = require('mongoose');

const confirmedItemSchema = new mongoose.Schema(
  {
    originalQuotationItemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    isExtraProduct: {
      type: Boolean,
      default: false
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null
    },
    isSkuLessItem: {
      type: Boolean,
      default: false
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
    imageSnapshot: {
      type: String,
      default: null,
      trim: true
    },
    quotedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Quoted quantity cannot be negative']
    },
    confirmedQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Confirmed quantity cannot be negative']
    },
    extraQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Extra quantity cannot be negative']
    },
    deliveredQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Delivered quantity cannot be negative']
    },
    unitPriceSnapshot: {
      type: Number,
      required: [true, 'Unit price snapshot is required'],
      min: [0, 'Unit price cannot be negative']
    },
    gstPctSnapshot: {
      type: Number,
      default: 0,
      min: [0, 'GST % cannot be negative'],
      max: [100, 'GST % cannot exceed 100']
    },
    confirmedAmount: {
      type: Number,
      required: [true, 'Confirmed amount is required'],
      min: [0, 'Confirmed amount cannot be negative']
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    }
  },
  { _id: true }
);

const quotationConfirmationSchema = new mongoose.Schema(
  {
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      required: [true, 'Quotation reference is required']
    },
    confirmationStatus: {
      type: String,
      enum: ['FULLY_CONFIRMED', 'PARTIALLY_CONFIRMED'],
      required: [true, 'Confirmation status is required'],
      uppercase: true,
      trim: true
    },
    pendingApproval: {
      type: Boolean,
      default: false
    },
    confirmedItems: {
      type: [confirmedItemSchema],
      default: []
    },

    // Amount Comparison Figures (Cached & recomputed on every save)
    originalQuotationAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    confirmedAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    extraProductAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    differenceAmount: {
      type: Number,
      default: 0
    },
    totalActualAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    isFullyDelivered: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'ConfirmedBy user reference is required']
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

quotationConfirmationSchema.index({ quotation: 1 });
quotationConfirmationSchema.index({ 'confirmedItems.product': 1 });
quotationConfirmationSchema.index({ isActive: 1 });
quotationConfirmationSchema.index({ pendingApproval: 1 });

module.exports = mongoose.model('QuotationConfirmation', quotationConfirmationSchema);
