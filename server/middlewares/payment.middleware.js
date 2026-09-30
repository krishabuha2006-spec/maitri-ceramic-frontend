/**
 * Middleware to strip immutable financial, calculation, and ledger fields
 * from Payment update payloads before reaching controller/service.
 */
const stripImmutablePaymentFields = (req, res, next) => {
  const IMMUTABLE_FIELDS = [
    'receiptNumber',
    'paymentDate',
    'customer',
    'paymentMode',
    'totalAmount',
    'allocations',
    'entryType',
    'reversalOf',
    'reversalReason',
    'reversedAt',
    'reversedBy',
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
  stripImmutablePaymentFields
};
