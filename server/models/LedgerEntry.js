const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: [true, 'Customer reference is required'],
      index: true
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry date is required'],
      default: Date.now
    },
    particular: {
      type: String,
      required: [true, 'Particular is required'],
      trim: true
    },
    entryType: {
      type: String,
      enum: ['DEBIT', 'CREDIT'],
      required: [true, 'Entry type (DEBIT or CREDIT) is required']
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0.01, 'Amount must be greater than 0']
    },
    runningBalance: {
      type: Number,
      required: [true, 'Running balance is required']
    },
    sourceType: {
      type: String,
      enum: ['INVOICE', 'PAYMENT', 'PAYMENT_REVERSAL', 'SALES_RETURN', 'MANUAL', 'MANUAL_REVERSAL'],
      required: [true, 'Source type is required']
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    reversalOf: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LedgerEntry',
      default: null
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Posted by user reference is required']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

ledgerEntrySchema.index({ customer: 1, entryDate: 1, createdAt: 1 });
ledgerEntrySchema.index({ sourceType: 1, sourceId: 1 });

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
