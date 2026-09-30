const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    quotation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quotation',
      required: [true, 'Quotation reference is required']
    },
    followUpDate: {
      type: Date,
      required: [true, 'Follow-up date is required'],
      default: Date.now
    },
    nextFollowUpDate: {
      type: Date,
      default: null
    },
    followUpUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Follow-up user is required']
    },
    communicationType: {
      type: String,
      enum: ['CALL', 'WHATSAPP', 'EMAIL', 'IN_PERSON', 'OTHER'],
      required: [true, 'Communication type is required'],
      uppercase: true,
      trim: true
    },
    customerResponse: {
      type: String,
      default: null,
      trim: true
    },
    remarks: {
      type: String,
      default: null,
      trim: true
    },
    expectedOrderValue: {
      type: Number,
      default: null,
      min: [0, 'Expected order value cannot be negative']
    },
    nextAction: {
      type: String,
      default: null,
      trim: true
    },
    resultingStatus: {
      type: String,
      enum: [
        'FOLLOW_UP_PENDING',
        'FOLLOW_UP_COMPLETED',
        'CUSTOMER_INTERESTED',
        'NEGOTIATION',
        'REJECTED',
        'EXPIRED',
        'CLOSED'
      ],
      required: [true, 'Resulting status is required'],
      uppercase: true,
      trim: true
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

followUpSchema.index({ quotation: 1, followUpDate: -1, createdAt: -1 });
followUpSchema.index({ nextFollowUpDate: 1 });
followUpSchema.index({ followUpUser: 1 });
followUpSchema.index({ isActive: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
