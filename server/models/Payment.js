const mongoose = require('mongoose');

const paymentAllocationSchema = new mongoose.Schema(
  {
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: [true, 'Invoice reference is required']
    },
    invoiceNumberSnapshot: {
      type: String,
      required: [true, 'Invoice number snapshot is required'],
      trim: true
    },
    allocatedAmount: {
      type: Number,
      required: [true, 'Allocated amount is required'],
      min: [0.01, 'Allocated amount must be at least 0.01']
    }
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    receiptNumber: {
      type: String,
      required: [true, 'Receipt number is required'],
      unique: true,
      trim: true
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required']
    },
    paymentMode: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentModeMaster',
      required: [true, 'Payment mode reference is required']
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0.01, 'Total amount must be at least 0.01']
    },
    allocations: {
      type: [paymentAllocationSchema],
      default: []
    },
    referenceNumber: {
      type: String,
      default: null,
      trim: true
    },
    bankCashAccount: {
      type: String,
      default: null,
      trim: true
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },
    entryType: {
      type: String,
      enum: ['PAYMENT', 'REVERSAL'],
      default: 'PAYMENT'
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null
    },
    reversalReason: {
      type: String,
      default: null,
      trim: true
    },
    reversedAt: {
      type: Date,
      default: null
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
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

paymentSchema.index({ customer: 1 });
paymentSchema.index({ 'allocations.invoice': 1 });
paymentSchema.index({ entryType: 1 });
paymentSchema.index({ reversalOf: 1 });
paymentSchema.index({ createdBy: 1, isActive: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
