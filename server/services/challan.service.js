const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Challan = require('../models/Challan');
const ChallanNumberSequence = require('../models/ChallanNumberSequence');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const Product = require('../models/Product');
const UnitMaster = require('../models/UnitMaster');
const Customer = require('../models/Customer');
const stockService = require('./stock.service');
const confirmationService = require('./confirmation.service');

/**
 * Create a new DRAFT Challan from an active Quotation Confirmation
 */
const createChallan = async (data, user) => {
  const { confirmationId, deliveryDetails, remarks, items = [] } = data;

  if (!confirmationId) {
    const err = new Error('Quotation Confirmation ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(items) || items.length === 0) {
    const err = new Error('At least one item is required to create a Challan.');
    err.statusCode = 400;
    throw err;
  }

  const confirmation = await QuotationConfirmation.findOne({
    _id: confirmationId,
    isActive: true
  }).populate({
    path: 'quotation',
    populate: { path: 'customer' }
  });

  if (!confirmation) {
    const err = new Error(`Active Quotation Confirmation not found with ID '${confirmationId}'.`);
    err.statusCode = 404;
    throw err;
  }

  if (confirmation.pendingApproval) {
    const err = new Error('Cannot create Challan: Quotation Confirmation is still pending manager approval.');
    err.statusCode = 400;
    throw err;
  }

  const customer = confirmation.quotation?.customer;
  if (!customer) {
    const err = new Error('Customer reference could not be resolved from Quotation Confirmation.');
    err.statusCode = 400;
    throw err;
  }

  const customerContact = customer.mobile || customer.alternateNumber || null;
  const customerAddress = customer.shippingAddress || customer.billingAddress || customer.city || null;

  // Process & validate each item against live pendingDelivery
  const processedItems = [];

  for (const it of items) {
    const { confirmedItemId, quantityToIssue, remarks: itemRemarks } = it;

    if (!confirmedItemId) {
      const err = new Error('confirmedItemId is required for every Challan item.');
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(quantityToIssue);
    if (!qty || qty <= 0) {
      const err = new Error('quantityToIssue must be greater than 0 for every Challan item.');
      err.statusCode = 400;
      throw err;
    }

    const confirmedItem = confirmation.confirmedItems.id(confirmedItemId);
    if (!confirmedItem) {
      const err = new Error(
        `Confirmed item '${confirmedItemId}' does not belong to Confirmation '${confirmation.confirmationNumber || confirmationId}'.`
      );
      err.statusCode = 400;
      throw err;
    }

    const totalCommitted =
      (Number(confirmedItem.confirmedQuantity) || 0) + (Number(confirmedItem.extraQuantity) || 0);
    const delivered = Number(confirmedItem.deliveredQuantity) || 0;
    const pendingDelivery = totalCommitted - delivered;

    if (qty > pendingDelivery) {
      const err = new Error(
        `Requested quantity (${qty}) exceeds remaining pending delivery (${pendingDelivery}) for item '${confirmedItem.productNameSnapshot}'.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Resolve Unit
    let unitId = null;
    if (confirmedItem.product) {
      const productDoc = await Product.findById(confirmedItem.product).populate('unit');
      unitId = productDoc?.unit?._id || productDoc?.unit;
    }

    if (!unitId) {
      const defaultUnit = await UnitMaster.findOne({ isActive: true });
      unitId = defaultUnit ? defaultUnit._id : null;
    }

    if (!unitId) {
      const err = new Error(`Unit could not be resolved for item '${confirmedItem.productNameSnapshot}'.`);
      err.statusCode = 400;
      throw err;
    }

    processedItems.push({
      confirmedItem: confirmedItem._id,
      product: confirmedItem.product || null,
      skuCodeSnapshot: confirmedItem.skuCodeSnapshot || null,
      productNameSnapshot: confirmedItem.productNameSnapshot,
      unit: unitId,
      quantityToIssue: qty,
      remarks: itemRemarks ? itemRemarks.trim() : null
    });
  }

  const challanNumber = await ChallanNumberSequence.generateNextNumber();

  const challan = await Challan.create({
    challanNumber,
    challanDate: new Date(),
    customer: customer._id || confirmation.customer,
    customerContact,
    customerAddress,
    quotation: confirmation.quotation?._id || confirmation.quotation || null,
    confirmation: confirmation._id,
    salesperson: user._id,
    remarks: remarks ? remarks.trim() : null,
    deliveryDetails: deliveryDetails ? deliveryDetails.trim() : null,
    status: 'DRAFT',
    items: processedItems,
    createdBy: user._id
  });

  return await Challan.findById(challan._id)
    .populate('customer', 'customerName mobile city customerType')
    .populate('confirmation', 'confirmationNumber overallDeliveryStatus')
    .populate('quotation', 'quotationNumber')
    .populate('salesperson', 'name mobile')
    .populate('items.product', 'productName companySkuCode currentStock')
    .populate('items.unit', 'unitCode unitName')
    .populate('createdBy', 'name');
};

/**
 * List Challans with filtering, pagination and dataScope
 */
const getChallans = async (query = {}, scopeFilter = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { isActive: true, ...scopeFilter };

  if (query.customerId) filter.customer = query.customerId;
  if (query.confirmationId) filter.confirmation = query.confirmationId;
  if (query.quotationId) filter.quotation = query.quotationId;
  if (query.status) filter.status = query.status.toUpperCase();

  if (query.search) {
    const searchRegex = new RegExp(query.search.trim(), 'i');
    filter.$or = [
      { challanNumber: searchRegex },
      { customerContact: searchRegex },
      { deliveryDetails: searchRegex },
      { remarks: searchRegex }
    ];
  }

  if (query.from || query.to) {
    filter.challanDate = {};
    if (query.from) filter.challanDate.$gte = new Date(query.from);
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.challanDate.$lte = toDate;
    }
  }

  const total = await Challan.countDocuments(filter);
  const challans = await Challan.find(filter)
    .populate('customer', 'customerName mobile city customerType')
    .populate('confirmation', 'confirmationNumber overallDeliveryStatus')
    .populate('quotation', 'quotationNumber')
    .populate('salesperson', 'name mobile')
    .populate('finalizedBy', 'name')
    .populate('createdBy', 'name')
    .sort({ challanDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    challans,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get single Challan by ID
 */
const getChallanById = async (id, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const challan = await Challan.findOne(filter)
    .populate('customer', 'customerName mobile alternateNumber email billingAddress shippingAddress city state gstNumber')
    .populate('confirmation', 'confirmationNumber confirmationStatus overallDeliveryStatus isFullyDelivered')
    .populate('quotation', 'quotationNumber grandTotal')
    .populate('salesperson', 'name mobile email')
    .populate('items.product', 'productName companySkuCode currentStock mrp')
    .populate('items.unit', 'unitCode unitName')
    .populate('finalizedBy', 'name mobile')
    .populate('createdBy', 'name mobile');

  if (!challan) {
    const err = new Error(`Challan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  return challan;
};

/**
 * Update a DRAFT Challan (Allowed ONLY while status is DRAFT)
 */
const updateChallan = async (id, data, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const challan = await Challan.findOne(filter);

  if (!challan) {
    const err = new Error(`Challan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  if (challan.status !== 'DRAFT') {
    const err = new Error(
      `Cannot edit Challan: Challan '${challan.challanNumber}' is already ${challan.status}. Only DRAFT Challans can be modified.`
    );
    err.statusCode = 400;
    throw err;
  }

  const { deliveryDetails, remarks, items } = data;

  if (deliveryDetails !== undefined) challan.deliveryDetails = deliveryDetails ? deliveryDetails.trim() : null;
  if (remarks !== undefined) challan.remarks = remarks ? remarks.trim() : null;

  if (Array.isArray(items) && items.length > 0) {
    const confirmation = await QuotationConfirmation.findById(challan.confirmation);
    if (!confirmation) {
      const err = new Error('Associated Quotation Confirmation not found.');
      err.statusCode = 404;
      throw err;
    }

    const processedItems = [];

    for (const it of items) {
      const { confirmedItemId, quantityToIssue, remarks: itemRemarks } = it;

      const confirmedItem = confirmation.confirmedItems.id(confirmedItemId);
      if (!confirmedItem) {
        const err = new Error(`Confirmed item '${confirmedItemId}' does not belong to this confirmation.`);
        err.statusCode = 400;
        throw err;
      }

      const qty = Number(quantityToIssue);
      if (!qty || qty <= 0) {
        const err = new Error('quantityToIssue must be greater than 0.');
        err.statusCode = 400;
        throw err;
      }

      const totalCommitted =
        (Number(confirmedItem.confirmedQuantity) || 0) + (Number(confirmedItem.extraQuantity) || 0);
      const delivered = Number(confirmedItem.deliveredQuantity) || 0;
      const pendingDelivery = totalCommitted - delivered;

      if (qty > pendingDelivery) {
        const err = new Error(
          `Requested quantity (${qty}) exceeds remaining pending delivery (${pendingDelivery}) for item '${confirmedItem.productNameSnapshot}'.`
        );
        err.statusCode = 400;
        throw err;
      }

      let unitId = null;
      if (confirmedItem.product) {
        const productDoc = await Product.findById(confirmedItem.product);
        unitId = productDoc?.unit;
      }
      if (!unitId) {
        const defaultUnit = await UnitMaster.findOne({ isActive: true });
        unitId = defaultUnit?._id;
      }

      processedItems.push({
        confirmedItem: confirmedItem._id,
        product: confirmedItem.product || null,
        skuCodeSnapshot: confirmedItem.skuCodeSnapshot || null,
        productNameSnapshot: confirmedItem.productNameSnapshot,
        unit: unitId,
        quantityToIssue: qty,
        remarks: itemRemarks ? itemRemarks.trim() : null
      });
    }

    challan.items = processedItems;
  }

  challan.updatedBy = user._id;
  await challan.save();

  return await getChallanById(challan._id);
};

/**
 * Cancel a DRAFT Challan (Allowed ONLY while status is DRAFT)
 */
const cancelChallan = async (id, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const challan = await Challan.findOne(filter);

  if (!challan) {
    const err = new Error(`Challan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  if (challan.status !== 'DRAFT') {
    const err = new Error(
      `Cannot cancel Challan: Challan '${challan.challanNumber}' is already ${challan.status}. Only DRAFT Challans can be cancelled.`
    );
    err.statusCode = 400;
    throw err;
  }

  challan.status = 'CANCELLED';
  challan.updatedBy = user._id;
  await challan.save();

  return challan;
};

/**
 * FINALIZATION: The Atomic Dual-Write Event (Section 6)
 * Atomically calls:
 *  1. stockService.deductStock() for physical stock deduction (Module 8)
 *  2. confirmationService.recordDelivery() for delivery tracking (Module 7)
 */
const finalizeChallan = async (id, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const challan = await Challan.findOne(filter);

  if (!challan) {
    const err = new Error(`Challan not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  if (challan.status === 'FINALIZED') {
    const err = new Error(`Challan '${challan.challanNumber}' is already FINALIZED.`);
    err.statusCode = 400;
    throw err;
  }

  if (challan.status === 'CANCELLED') {
    const err = new Error(`Cannot finalize cancelled Challan '${challan.challanNumber}'.`);
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(challan.items) || challan.items.length === 0) {
    const err = new Error(`Cannot finalize Challan '${challan.challanNumber}': No items present.`);
    err.statusCode = 400;
    throw err;
  }

  // Execute in a MongoDB transaction for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const item of challan.items) {
      // 1. Stock Deduction (Module 8) if item is a catalog product
      if (item.product) {
        await stockService.deductStock(
          item.product,
          item.quantityToIssue,
          'CHALLAN_ISSUE',
          'CHALLAN',
          challan._id,
          {
            session,
            referenceDocNote: `Challan ${challan.challanNumber}`,
            postedBy: user._id,
            remarks: `Issued via Challan ${challan.challanNumber}`
          }
        );
      }

      // 2. Record Delivery in Quotation Confirmation (Module 7)
      await confirmationService.recordDelivery(
        challan.confirmation,
        item.confirmedItem,
        item.quantityToIssue,
        { session }
      );
    }

    // 3. Mark Challan as FINALIZED
    challan.status = 'FINALIZED';
    challan.finalizedAt = new Date();
    challan.finalizedBy = user._id;
    challan.updatedBy = user._id;

    await challan.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    if (!error.statusCode) error.statusCode = 400;
    throw error;
  } finally {
    session.endSession();
  }

  return await getChallanById(challan._id);
};

/**
 * Get Print / Delivery Note Data
 */
const getPrintData = async (id, scopeFilter = {}) => {
  const challan = await getChallanById(id, scopeFilter);

  return {
    challanNumber: challan.challanNumber,
    challanDate: challan.challanDate,
    status: challan.status,
    customer: {
      name: challan.customer?.customerName || 'N/A',
      contact: challan.customerContact || challan.customer?.mobile || 'N/A',
      address: challan.customerAddress || challan.customer?.shippingAddress || challan.customer?.billingAddress || 'N/A',
      gstNumber: challan.customer?.gstNumber || 'N/A'
    },
    quotationNumber: challan.quotation?.quotationNumber || 'N/A',
    confirmationNumber: challan.confirmation?.confirmationNumber || 'N/A',
    salesperson: challan.salesperson?.name || 'N/A',
    deliveryDetails: challan.deliveryDetails || 'N/A',
    remarks: challan.remarks || '',
    finalizedAt: challan.finalizedAt,
    finalizedBy: challan.finalizedBy?.name || 'N/A',
    items: (challan.items || []).map((it, idx) => ({
      srNo: idx + 1,
      productName: it.productNameSnapshot,
      skuCode: it.skuCodeSnapshot || it.product?.companySkuCode || 'N/A',
      quantity: it.quantityToIssue,
      unit: it.unit?.unitCode || 'PCS',
      remarks: it.remarks || ''
    }))
  };
};

/**
 * Export Challans to Excel (.xlsx)
 */
const exportChallansToExcel = async (query = {}, scopeFilter = {}) => {
  const result = await getChallans({ ...query, limit: 10000 }, scopeFilter);
  const challans = result.challans || [];

  const exportRows = [];

  challans.forEach((ch, cIdx) => {
    (ch.items || []).forEach((it, iIdx) => {
      exportRows.push({
        'Challan #': ch.challanNumber,
        'Date': ch.challanDate ? new Date(ch.challanDate).toLocaleDateString('en-IN') : '',
        'Status': ch.status,
        'Customer Name': ch.customer?.customerName || 'N/A',
        'Customer Mobile': ch.customerContact || ch.customer?.mobile || 'N/A',
        'Confirmation #': ch.confirmation?.confirmationNumber || 'N/A',
        'Quotation #': ch.quotation?.quotationNumber || 'N/A',
        'Item Sr.': iIdx + 1,
        'Product Name': it.productNameSnapshot,
        'SKU Code': it.skuCodeSnapshot || 'N/A',
        'Quantity Issued': it.quantityToIssue,
        'Delivery Vehicle/Details': ch.deliveryDetails || '',
        'Salesperson': ch.salesperson?.name || 'N/A',
        'Finalized Date': ch.finalizedAt ? new Date(ch.finalizedAt).toLocaleDateString('en-IN') : '',
        'Remarks': ch.remarks || ''
      });
    });
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Challan Deliveries');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * =========================================================================
 * FORWARD-REFERENCE SERVICES FOR DOWNSTREAM MODULES (Module 4 & Module 10)
 * =========================================================================
 */

/**
 * Consumed by Module 4: Customer 360° History
 */
const getByCustomer = async (customerId) => {
  return await Challan.find({ customer: customerId, isActive: true })
    .populate('confirmation', 'confirmationNumber')
    .sort({ challanDate: -1, createdAt: -1 })
    .lean();
};

/**
 * Consumed by Module 10: Invoice Generation
 * Returns all FINALIZED Challans for a given Quotation Confirmation
 */
const getByConfirmation = async (confirmationId) => {
  return await Challan.find({
    confirmation: confirmationId,
    status: 'FINALIZED',
    isActive: true
  })
    .populate('items.product', 'productName companySkuCode mrp')
    .populate('items.unit', 'unitCode')
    .lean();
};

/**
 * Consumed by Module 10: Invoice Generation
 * Marks a Challan as invoiced (true/false) - metadata-only update
 */
const markInvoiced = async (challanId, invoiced, options = {}) => {
  const query = Challan.findById(challanId);
  if (options.session) query.session(options.session);
  const challan = await query;
  if (!challan) {
    const err = new Error(`Challan not found with ID '${challanId}'.`);
    err.statusCode = 404;
    throw err;
  }
  challan.invoiced = Boolean(invoiced);
  await challan.save({ session: options.session || null });
  return challan;
};

module.exports = {
  createChallan,
  getChallans,
  getChallanById,
  updateChallan,
  cancelChallan,
  finalizeChallan,
  getPrintData,
  exportChallansToExcel,
  getByCustomer,
  getByConfirmation,
  markInvoiced
};


