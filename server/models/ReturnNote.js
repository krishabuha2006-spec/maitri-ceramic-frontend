const mongoose = require('mongoose');

const returnNoteSchema = new mongoose.Schema(
  {
    returnNoteNumber: {
      type: String,
      required: [true, 'Return Note number is required'],
      unique: true,
      trim: true
    },
    returnType: {
      type: String,
      enum: {
        values: ['PURCHASE_RETURN', 'SALES_RETURN'],
        message: '{VALUE} is not a valid return type'
      },
      required: [true, 'Return type is required']
    },
    returnDate: {
      type: Date,
      required: [true, 'Return date is required'],
      default: Date.now
    },

    // Purchase Return fields
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null
    },
    purchaseReferenceNote: {
      type: String,
      default: null,
      trim: true
    },

    // Sales Return fields
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null
    },
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null
    },
    challan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Challan',
      default: null
    },

    // Item details
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
    quantity: {
      type: Number,
      required: [true, 'Return quantity is required'],
      min: [0.0001, 'Quantity must be greater than 0']
    },
    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UnitMaster',
      required: [true, 'Unit is required']
    },

    returnReason: {
      type: String,
      required: [true, 'Return reason is required'],
      trim: true
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },

    returnStatus: {
      type: String,
      enum: {
        values: ['DRAFT', 'CONFIRMED', 'CANCELLED'],
        message: '{VALUE} is not a valid return status'
      },
      default: 'DRAFT'
    },

    confirmedAt: {
      type: Date,
      default: null
    },
    confirmedBy: {
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
      required: [true, 'Created by user is required']
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

returnNoteSchema.index({ returnType: 1 });
returnNoteSchema.index({ customer: 1 });
returnNoteSchema.index({ vendor: 1 });
returnNoteSchema.index({ invoice: 1 });
returnNoteSchema.index({ challan: 1 });
returnNoteSchema.index({ returnStatus: 1 });
returnNoteSchema.index({ returnDate: -1 });

module.exports = mongoose.model('ReturnNote', returnNoteSchema);
