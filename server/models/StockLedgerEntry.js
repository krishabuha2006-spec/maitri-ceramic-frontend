const mongoose = require('mongoose');

const stockLedgerEntrySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required']
    },
    skuCodeSnapshot: {
      type: String,
      default: null,
      trim: true
    },
    entryNumber: {
      type: String,
      required: [true, 'Entry number is required'],
      unique: true,
      trim: true
    },
    entryDate: {
      type: Date,
      required: [true, 'Entry date is required'],
      default: Date.now
    },
    direction: {
      type: String,
      enum: ['IN', 'OUT'],
      required: [true, 'Direction (IN / OUT) is required'],
      uppercase: true,
      trim: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.0001, 'Quantity must be greater than 0']
    },
    reason: {
      type: String,
      enum: [
        'OPENING_STOCK',
        'PURCHASE_ENTRY',
        'MANUAL_ADDITION',
        'MANUAL_DEDUCTION',
        'CHALLAN_ISSUE',
        'PURCHASE_RETURN',
        'SALES_RETURN',
        'OTHER'
      ],
      required: [true, 'Reason is required'],
      uppercase: true,
      trim: true
    },
    referenceDocType: {
      type: String,
      enum: ['CHALLAN', 'RETURN_NOTE', 'MANUAL', null],
      default: null
    },
    referenceDocId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    referenceDocNote: {
      type: String,
      default: null,
      trim: true
    },
    balanceAfter: {
      type: Number,
      required: [true, 'Running balance after entry is required']
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Posted by user is required']
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockLedgerEntrySchema.index({ product: 1, entryDate: -1, createdAt: -1 });
stockLedgerEntrySchema.index({ referenceDocType: 1, referenceDocId: 1 });
stockLedgerEntrySchema.index({ entryDate: -1 });

module.exports = mongoose.model('StockLedgerEntry', stockLedgerEntrySchema);
