/**
 * Return Note Middleware
 * Enforces field immutability on update operations
 */

const ReturnNote = require('../models/ReturnNote');

const stripImmutableReturnFields = async (req, res, next) => {
  try {
    const returnId = req.params.id;
    if (!returnId) {
      return next();
    }

    const returnDoc = await ReturnNote.findById(returnId);
    if (!returnDoc) {
      return next(); // Let controller throw 404
    }

    // Always strip system control fields
    delete req.body.returnNoteNumber;
    delete req.body.returnStatus;
    delete req.body.confirmedAt;
    delete req.body.confirmedBy;
    delete req.body.createdBy;
    delete req.body.createdAt;
    delete req.body.updatedAt;

    // If CONFIRMED, strip product, quantity, unit, vendor, customer, invoice, challan, snapshots
    if (returnDoc.returnStatus === 'CONFIRMED') {
      delete req.body.product;
      delete req.body.quantity;
      delete req.body.unit;
      delete req.body.returnType;
      delete req.body.vendor;
      delete req.body.customer;
      delete req.body.invoice;
      delete req.body.challan;
      delete req.body.purchaseReferenceNote;
      delete req.body.skuCodeSnapshot;
      delete req.body.productNameSnapshot;
      delete req.body.returnDate;
    }

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  stripImmutableReturnFields
};
