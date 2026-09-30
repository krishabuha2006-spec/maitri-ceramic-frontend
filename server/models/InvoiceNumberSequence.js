const mongoose = require('mongoose');

const invoiceNumberSequenceSchema = new mongoose.Schema({
  financialYear: {
    type: String,
    required: true,
    unique: true
  },
  lastNumber: {
    type: Number,
    default: 0
  }
});

/**
 * Get current Indian Financial Year string (e.g., '2026-27' for April 2026 - March 2027)
 * @param {Date} [date=new Date()]
 * @returns {string} Financial year string
 */
const getFinancialYearString = (date = new Date()) => {
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth(); // 0-indexed, 3 is April

  if (currentMonth >= 3) {
    const nextYearShort = String((currentYear + 1) % 100).padStart(2, '0');
    return `${currentYear}-${nextYearShort}`;
  } else {
    const currentYearShort = String(currentYear % 100).padStart(2, '0');
    return `${currentYear - 1}-${currentYearShort}`;
  }
};

/**
 * Atomically generate the next sequential Invoice number
 * Example format: 'INV-2026-27-0001'
 *
 * @param {Date} [date=new Date()]
 * @returns {Promise<string>} Next unique invoice number
 */
invoiceNumberSequenceSchema.statics.generateNextNumber = async function (date = new Date()) {
  const financialYear = getFinancialYearString(date);

  const seq = await this.findOneAndUpdate(
    { financialYear },
    { $inc: { lastNumber: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const paddedNumber = String(seq.lastNumber).padStart(4, '0');
  return `INV-${financialYear}-${paddedNumber}`;
};

module.exports = mongoose.model('InvoiceNumberSequence', invoiceNumberSequenceSchema);
