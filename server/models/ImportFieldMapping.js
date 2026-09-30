const mongoose = require('mongoose');

const importFieldMappingSchema = new mongoose.Schema(
  {
    mappingName: {
      type: String,
      required: [true, 'Mapping profile name is required'],
      trim: true
    },
    sourceType: {
      type: String,
      enum: ['EXCEL', 'PDF'],
      required: true
    },
    headerSignature: {
      type: String,
      required: [true, 'Header signature is required'],
      trim: true
    },
    mapping: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Field mapping definition is required']
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

importFieldMappingSchema.index({ headerSignature: 1, sourceType: 1 });

module.exports = mongoose.model('ImportFieldMapping', importFieldMappingSchema);
