const mongoose = require('mongoose');

const savedReportFilterSchema = new mongoose.Schema(
  {
    reportKey: {
      type: String,
      required: [true, 'Report key is required'],
      trim: true
    },
    filterName: {
      type: String,
      required: [true, 'Filter name is required'],
      trim: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Filters object is required'],
      default: {}
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'CreatedBy user reference is required']
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

savedReportFilterSchema.index({ createdBy: 1, reportKey: 1 });

module.exports = mongoose.model('SavedReportFilter', savedReportFilterSchema);
