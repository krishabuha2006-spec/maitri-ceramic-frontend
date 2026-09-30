const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // Identification
    companySkuCode: {
      type: String,
      trim: true
    },
    vendorSkuCode: {
      type: String,
      default: null,
      trim: true
    },
    isSkuLess: {
      type: Boolean,
      default: false
    },
    productName: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true
    },
    hsnCode: {
      type: String,
      default: null,
      trim: true
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null
    },
    productGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductGroup',
      default: null
    },
    category: {
      type: String,
      default: 'Sanitaryware',
      trim: true
    },
    productType: {
      type: String,
      default: null,
      trim: true
    },
    productSubType: {
      type: String,
      default: null,
      trim: true
    },
    rangeOrSize: {
      type: String,
      default: null,
      trim: true
    },
    range: {
      type: String,
      default: null,
      trim: true
    },
    size: {
      type: String,
      default: null,
      trim: true
    },
    colourName: {
      type: String,
      default: null,
      trim: true
    },
    finish: {
      type: String,
      default: null,
      trim: true
    },
    fullDescription: {
      type: String,
      default: null,
      trim: true
    },
    piecesPerBox: {
      type: Number,
      default: null
    },
    sqftPerBox: {
      type: Number,
      default: null
    },
    weightPerBox: {
      type: Number,
      default: null
    },
    productImage: {
      type: String,
      default: null,
      trim: true
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitMaster',
      required: [true, 'Unit reference is required']
    },

    // Tax Information
    gstPct: {
      type: Number,
      default: 0,
      min: [0, 'GST % cannot be negative'],
      max: [100, 'GST % cannot exceed 100']
    },
    igstPct: {
      type: Number,
      default: 0,
      min: [0, 'IGST % cannot be negative'],
      max: [100, 'IGST % cannot exceed 100']
    },
    cgstPct: {
      type: Number,
      default: 0,
      min: [0, 'CGST % cannot be negative'],
      max: [100, 'CGST % cannot exceed 100']
    },
    sgstPct: {
      type: Number,
      default: 0,
      min: [0, 'SGST % cannot be negative'],
      max: [100, 'SGST % cannot exceed 100']
    },
    cessPct: {
      type: Number,
      default: 0,
      min: [0, 'CESS % cannot be negative'],
      max: [100, 'CESS % cannot exceed 100']
    },

    // Pricing Information
    mrp: {
      type: Number,
      default: 0,
      min: [0, 'MRP cannot be negative']
    },
    purchaseRate: {
      type: Number,
      default: 0,
      min: [0, 'Purchase rate cannot be negative']
    },
    costRate: {
      type: Number,
      default: 0,
      min: [0, 'Cost rate cannot be negative']
    },
    salePrice: {
      type: Number,
      default: 0,
      min: [0, 'Sale price cannot be negative']
    },
    saleDiscount: {
      type: Number,
      default: 0,
      min: [0, 'Sale discount cannot be negative']
    },

    // Stock Information (Snapshots only - movements governed by Module 8)
    openingStock: {
      type: Number,
      default: 0,
      min: [0, 'Opening stock cannot be negative']
    },
    openingStockValue: {
      type: Number,
      default: 0,
      min: [0, 'Opening stock value cannot be negative']
    },
    defaultQuantity: {
      type: Number,
      default: 0,
      min: [0, 'Default quantity cannot be negative']
    },
    currentStock: {
      type: Number,
      default: 0
    },
    reorderAlertQty: {
      type: Number,
      default: 0,
      min: [0, 'Reorder alert quantity cannot be negative']
    },

    // Status & Audit
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy reference is required']
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
productSchema.index(
  { companySkuCode: 1 },
  {
    unique: true,
    partialFilterExpression: { companySkuCode: { $type: 'string' } }
  }
);
productSchema.index({ productName: 'text', companySkuCode: 'text', vendorSkuCode: 'text' });
productSchema.index({ company: 1, productGroup: 1, vendor: 1, isActive: 1 });

module.exports = mongoose.model('Product', productSchema);
