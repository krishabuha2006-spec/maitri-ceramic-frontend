/**
 * Middleware to strip immutable financial, calculation, and system fields
 * from Invoice update payloads before reaching controller/service.
 */
const stripImmutableFields = (req, res, next) => {
  const IMMUTABLE_FIELDS = [
    'invoiceNumber',
    'invoiceDate',
    'customer',
    'customerMobile',
    'customerAddress',
    'customerGstNumber',
    'sourceChallans',
    'sourceConfirmations',
    'items',
    'quantity',
    'rateSnapshot',
    'discountPct',
    'gstPctSnapshot',
    'amount',
    'discountAmount',
    'netAmount',
    'gstAmount',
    'subTotal',
    'totalGst',
    'grandTotal',
    'amountInWords',
    'status',
    'isActive',
    'createdBy',
    'createdAt',
    'updatedAt'
  ];

  if (req.body && typeof req.body === 'object') {
    IMMUTABLE_FIELDS.forEach((field) => {
      delete req.body[field];
    });
  }

  next();
};

module.exports = {
  stripImmutableFields
};
