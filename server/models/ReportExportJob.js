const mongoose = require('mongoose');

const reportExportJobSchema = new mongoose.Schema(
  {
    reportKey: {
      type: String,
      required: [true, 'Report key is required'],
      trim: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    fileFormat: {
      type: String,
      enum: ['EXCEL', 'PDF'],
      required: [true, 'File format is required'],
      uppercase: true
    },
    status: {
      type: String,
      enum: ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'],
      default: 'QUEUED'
    },
    filePath: {
      type: String,
      default: null
    },
    errorMessage: {
      type: String,
      default: null
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'RequestedBy user reference is required']
    },
    completedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

reportExportJobSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model('ReportExportJob', reportExportJobSchema);
