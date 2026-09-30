const Quotation = require('../models/Quotation');

/**
 * Forward Reference Service: Get all quotation usages for a specific product
 * Consumed by Module 2's `GET /api/products/:id/quotation-usage`
 *
 * @param {String|ObjectId} productId
 * @returns {Promise<Array<Object>>}
 */
const getUsageForProduct = async (productId) => {
  try {
    const quotations = await Quotation.find({
      'items.product': productId,
      isActive: true
    })
      .select('quotationNumber quotationDate customer salesperson status items totalNetAmount grandTotal')
      .populate('customer', 'customerName mobile city')
      .populate('salesperson', 'name mobile')
      .sort({ quotationDate: -1 })
      .lean();

    const usages = [];
    quotations.forEach((q) => {
      const matchingItems = (q.items || []).filter(
        (it) => it.product && String(it.product) === String(productId)
      );

      matchingItems.forEach((item) => {
        usages.push({
          quotationId: q._id,
          quotationNumber: q.quotationNumber,
          quotationDate: q.quotationDate,
          customer: q.customer ? q.customer.customerName : 'Unknown',
          customerMobile: q.customer ? q.customer.mobile : '',
          salesperson: q.salesperson ? q.salesperson.name : '',
          status: q.status,
          quantity: item.quantity,
          mrp: item.mrpSnapshot,
          discountPct: item.discountPct,
          netAmount: item.netAmount,
          gstAmount: item.gstAmount
        });
      });
    });

    return usages;
  } catch (err) {
    console.warn('Error fetching quotation usage for product:', err.message);
    return [];
  }
};

/**
 * Forward Reference Service: Get quotations and confirmed orders for a customer
 * Consumed by Module 4's `GET /api/customers/:id/history`
 *
 * @param {String|ObjectId} customerId
 * @returns {Promise<{ quotations: Array<Object>, confirmedOrders: Array<Object> }>}
 */
const getByCustomer = async (customerId) => {
  try {
    const quotations = await Quotation.find({
      customer: customerId,
      isActive: true
    })
      .select('quotationNumber quotationDate validityDate status totalGrossAmount totalNetAmount totalGstAmount grandTotal items')
      .sort({ quotationDate: -1 })
      .lean();

    const confirmedOrders = quotations.filter(
      (q) => q.status === 'CONFIRMED' || q.status === 'PARTIALLY_CONFIRMED'
    );

    return {
      quotations: quotations.map((q) => ({
        ...q,
        totalAmount: q.grandTotal
      })),
      confirmedOrders: confirmedOrders.map((q) => ({
        ...q,
        totalAmount: q.grandTotal
      }))
    };
  } catch (err) {
    console.warn('Error fetching quotations for customer:', err.message);
    return { quotations: [], confirmedOrders: [] };
  }
};

const ALLOWED_FOLLOW_UP_STATUSES = [
  'FOLLOW_UP_PENDING',
  'FOLLOW_UP_COMPLETED',
  'CUSTOMER_INTERESTED',
  'NEGOTIATION',
  'REJECTED',
  'EXPIRED',
  'CLOSED'
];

const ALLOWED_CONFIRMATION_STATUSES = [
  'CONFIRMED',
  'PARTIALLY_CONFIRMED',
  'CUSTOMER_INTERESTED'
];

/**
 * Update Quotation Status (Owned by Module 5, called by Module 6 or Module 7)
 *
 * @param {String|ObjectId} quotationId
 * @param {String} newStatus
 * @param {Object} [options] - { userId, sourceModule, session }
 * @returns {Promise<Object>} Updated quotation document
 */
const updateStatus = async (quotationId, newStatus, options = {}) => {
  const { userId, sourceModule = 'FOLLOW_UP', session = null } = options;

  const query = Quotation.findOne({ _id: quotationId, isActive: true });
  if (session) query.session(session);
  const quotation = await query;

  if (!quotation) {
    const error = new Error(`Active Quotation not found with ID '${quotationId}'.`);
    error.statusCode = 404;
    throw error;
  }

  // If called by Module 6 (Follow-Up), enforce Module-6-owned status restriction
  if (sourceModule === 'FOLLOW_UP') {
    if (!ALLOWED_FOLLOW_UP_STATUSES.includes(newStatus)) {
      const error = new Error(
        `Status '${newStatus}' cannot be set via Follow-Up module. Module 6 can only set: ${ALLOWED_FOLLOW_UP_STATUSES.join(', ')}. Transitions like CONFIRMED/PARTIALLY_CONFIRMED belong to Module 7.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // If called by Module 7 (Quotation Confirmation), enforce Module-7-owned status restriction
  if (sourceModule === 'QUOTATION_CONFIRMATION') {
    if (!ALLOWED_CONFIRMATION_STATUSES.includes(newStatus)) {
      const error = new Error(
        `Status '${newStatus}' cannot be set via Quotation Confirmation module. Module 7 can only set: ${ALLOWED_CONFIRMATION_STATUSES.join(', ')}.`
      );
      error.statusCode = 400;
      throw error;
    }
  }

  quotation.status = newStatus;
  if (userId) {
    quotation.updatedBy = userId;
  }

  if (session) {
    await quotation.save({ session });
  } else {
    await quotation.save();
  }

  return quotation;
};

module.exports = {
  getUsageForProduct,
  getByCustomer,
  updateStatus,
  ALLOWED_FOLLOW_UP_STATUSES
};

