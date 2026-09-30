const mongoose = require('mongoose');

const activityLogEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required']
    },
    userNameSnapshot: {
      type: String,
      required: [true, 'User name snapshot is required'],
      trim: true
    },
    moduleKey: {
      type: String,
      required: [true, 'Module key is required'],
      trim: true,
      uppercase: true
    },
    actionType: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'LOGIN', 'LOGOUT', 'PERMISSION_CHANGE'],
      required: [true, 'Action type is required']
    },
    entityType: {
      type: String,
      default: null,
      trim: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    entityLabel: {
      type: String,
      default: null,
      trim: true
    },
    changeSummary: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ipAddress: {
      type: String,
      default: null,
      trim: true
    },
    userAgent: {
      type: String,
      default: null,
      trim: true
    },
    status: {
      type: String,
      enum: ['SUCCESS'],
      default: 'SUCCESS'
    }
  },
  {
    timestamps: true // createdAt represents the log timestamp
  }
);

// Performance indexes for querying audit trails
activityLogEntrySchema.index({ user: 1, createdAt: -1 });
activityLogEntrySchema.index({ moduleKey: 1, actionType: 1, createdAt: -1 });
activityLogEntrySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogEntrySchema.index({ createdAt: -1 });

module.exports = mongoose.model('ActivityLogEntry', activityLogEntrySchema);
