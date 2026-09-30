const mongoose = require('mongoose');

const rowErrorSchema = new mongoose.Schema(
  {
    rowNumber: { type: Number, required: true },
    field: { type: String, default: null },
    message: { type: String, required: true }
  },
  { _id: false }
);

const importBatchSchema = new mongoose.Schema(
  {
    sourceType: {
      type: String,
      enum: ['EXCEL', 'PDF'],
      required: true
    },
    originalFileName: {
      type: String,
      required: true
    },
    filePath: {
      type: String,
      default: null
    },
    fileUrl: {
      type: String,
      required: [true, 'Cloudinary file URL is required']
    },
    cloudinaryPublicId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['PREVIEWED', 'COMMITTED', 'EXTRACTION_FAILED', 'PARTIAL_SUCCESS'],
      default: 'PREVIEWED'
    },
    fieldMappingUsed: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    headerSignature: {
      type: String,
      default: null
    },
    totalRows: {
      type: Number,
      default: 0
    },
    successCount: {
      type: Number,
      default: 0
    },
    createdCount: {
      type: Number,
      default: 0
    },
    updatedCount: {
      type: Number,
      default: 0
    },
    failedCount: {
      type: Number,
      default: 0
    },
    errors: {
      type: [rowErrorSchema],
      default: []
    },
    cachedRows: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    committedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true, suppressReservedKeysWarning: true }
);

module.exports = mongoose.model('ImportBatch', importBatchSchema);
