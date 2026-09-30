const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema(
  {
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
      required: [true, 'Product name is required'],
      trim: true
    },
    imageSnapshot: {
      type: String,
      default: null,
      trim: true
    },
    area: {
      type: String,
      default: null,
      trim: true
    },
    mrpSnapshot: {
      type: Number,
      required: [true, 'MRP / Unit rate is required'],
      min: [0, 'MRP cannot be negative']
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.001, 'Quantity must be greater than 0']
    },
    gstPctSnapshot: {
      type: Number,
      default: 0,
      min: [0, 'GST % cannot be negative'],
      max: [100, 'GST % cannot exceed 100']
    },
    discountPct: {
      type: Number,
      default: 0,
      min: [0, 'Discount % cannot be negative'],
      max: [100, 'Discount % cannot exceed 100']
    },
    grossAmount: {
      type: Number,
      required: true,
      min: 0
    },
    discountAmount: {
      type: Number,
      required: true,
      min: 0
    },
    netAmount: {
      type: Number,
      required: true,
      min: 0
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    }
  },
  { _id: true }
);

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: {
      type: String,
      required: [true, 'Quotation number is required'],
      unique: true,
      trim: true
    },
    quotationDate: {
      type: Date,
      required: [true, 'Quotation date is required'],
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
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null
    },
    salesperson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Salesperson reference is required']
    },
    reference: {
      type: String,
      default: null,
      trim: true
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },
    format: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QuotationFormatMaster',
      required: [true, 'Quotation format reference is required']
    },
    formatKey: {
      type: String,
      default: 'STANDARD',
      uppercase: true,
      trim: true
    },
    validityDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: [
        'DRAFT',
        'SENT',
        'FOLLOW_UP_PENDING',
        'FOLLOW_UP_COMPLETED',
        'CUSTOMER_INTERESTED',
        'NEGOTIATION',
        'CONFIRMED',
        'PARTIALLY_CONFIRMED',
        'REJECTED',
        'EXPIRED',
        'CLOSED'
      ],
      default: 'DRAFT'
    },
    items: {
      type: [quotationItemSchema],
      default: []
    },

    // Header Cached Totals (Server-computed on every save)
    totalGrossAmount: {
      type: Number,
      default: 0
    },
    totalDiscountAmount: {
      type: Number,
      default: 0
    },
    totalNetAmount: {
      type: Number,
      default: 0
    },
    totalGstAmount: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      default: 0
    },

    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user is required']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

// Indexes
quotationSchema.index({ customer: 1 });
quotationSchema.index({ 'items.product': 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ salesperson: 1 });
quotationSchema.index({ createdBy: 1, isActive: 1 });
quotationSchema.index({ quotationDate: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
