const mongoose = require('mongoose');

const productQuotationSummaryCacheSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
      unique: true
    },
    totalQuotationCount: {
      type: Number,
      default: 0,
      min: 0
    },
    totalQuotedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    totalQuotedValue: {
      type: Number,
      default: 0,
      min: 0
    },
    totalConfirmedQuantity: {
      type: Number,
      default: 0,
      min: 0
    },
    totalConfirmedValue: {
      type: Number,
      default: 0,
      min: 0
    },
    lastRecomputedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProductQuotationSummaryCache', productQuotationSummaryCacheSchema);
