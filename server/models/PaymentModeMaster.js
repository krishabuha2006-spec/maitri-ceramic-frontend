const mongoose = require('mongoose');

const paymentModeMasterSchema = new mongoose.Schema(
  {
    modeName: {
      type: String,
      required: [true, 'Payment mode name is required'],
      unique: true,
      trim: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentModeMaster', paymentModeMasterSchema);
