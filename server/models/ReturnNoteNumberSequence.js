const mongoose = require('mongoose');

const returnNoteNumberSequenceSchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: [true, 'Financial year is required'],
      unique: true,
      trim: true
    },
    lastNumber: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

/**
 * Compute Indian Financial Year (e.g. '2026-27' for April 2026 to March 2027)
 */
function getIndianFinancialYear(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1; // 1-indexed (Jan=1, Dec=12)

  let startYear, endYear;
  if (month >= 4) {
    startYear = year;
    endYear = year + 1;
  } else {
    startYear = year - 1;
    endYear = year;
  }

  const endYearShort = String(endYear).slice(-2);
  return `${startYear}-${endYearShort}`;
}

/**
 * Generate Next Return Note Number Atomically
 * Format: RTN-YYYY-YY-XXXX (e.g. RTN-2026-27-0001)
 */
returnNoteNumberSequenceSchema.statics.generateNextNumber = async function (date = new Date(), options = {}) {
  const financialYear = getIndianFinancialYear(date);
  const queryOptions = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
    ...options
  };

  const sequence = await this.findOneAndUpdate(
    { financialYear },
    { $inc: { lastNumber: 1 } },
    queryOptions
  );

  const paddedNumber = String(sequence.lastNumber).padStart(4, '0');
  return `RTN-${financialYear}-${paddedNumber}`;
};

returnNoteNumberSequenceSchema.statics.getCurrentFinancialYear = function (date = new Date()) {
  return getIndianFinancialYear(date);
};

module.exports = mongoose.model('ReturnNoteNumberSequence', returnNoteNumberSequenceSchema);
