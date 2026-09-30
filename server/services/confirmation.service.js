const mongoose = require('mongoose');
const XLSX = require('xlsx');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const Quotation = require('../models/Quotation');
const Product = require('../models/Product');
const quotationService = require('./quotation.service');

/**
 * Forward Reference Stubs for pending downstream modules
 */
const getInvoiceAmountStub = async (confirmationId) => {
  try {
    const invoiceService = require('./invoice.service');
    return await invoiceService.getFinalAmount(confirmationId);
  } catch (e) {
    if (mongoose.models.Invoice) {
      const invoices = await mongoose.models.Invoice.find({
        $or: [
          { confirmation: confirmationId },
          { sourceConfirmations: confirmationId }
        ],
        status: 'ISSUED',
        isActive: true
      });
      return invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
    }
    return 0;
  }
};

const getPaymentReceivedStub = async (confirmationId) => {
  try {
    const paymentService = require('./payment.service');
    return await paymentService.getReceivedAmount(confirmationId);
  } catch (e) {
    if (mongoose.models.Payment) {
      const payments = await mongoose.models.Payment.find({
        confirmation: confirmationId,
        isActive: true
      });
      return payments.reduce((sum, p) => sum + (Number(p.amountPaid) || 0), 0);
    }
    return 0;
  }
};

/**
 * Create a new Quotation Confirmation
 *
 * @param {Object} data - { quotationId, confirmedItems, extraItems, remarks }
 * @param {Object} user - Requesting User
 * @param {Boolean} hasApprovePermission - Whether user holds QUOTATION_CONFIRMATION:approve action
 */
const createConfirmation = async (data, user, hasApprovePermission = true) => {
  const { quotationId, confirmedItems = [], extraItems = [], remarks } = data;

  if (!quotationId) {
    const err = new Error('Quotation ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify target Quotation exists and is active
  const quotation = await Quotation.findOne({ _id: quotationId, isActive: true });
  if (!quotation) {
    const err = new Error(`Quotation not found with ID '${quotationId}'.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Enforce Single Active Confirmation Rule (Section 12 Rule 1)
  const existingActive = await QuotationConfirmation.findOne({
    quotation: quotation._id,
    isActive: true
  });
  if (existingActive) {
    const err = new Error(
      `An active Confirmation already exists for Quotation '${quotation.quotationNumber}'. Please cancel the existing confirmation before creating a new one.`
    );
    err.statusCode = 400;
    throw err;
  }

  // 3. Resolve Original Items Confirmation
  const quotationItemsMap = new Map();
  (quotation.items || []).forEach((item) => {
    quotationItemsMap.set(String(item._id), item);
  });

  const resolvedConfirmedItems = [];
  let isFullyConfirmed = true;

  // Process confirmed original items
  const processedOriginalItemIds = new Set();

  for (const itemInput of confirmedItems) {
    const origId = String(itemInput.originalQuotationItemId || '');
    const originalItem = quotationItemsMap.get(origId);

    if (!originalItem) {
      const err = new Error(`Original quotation item not found with ID '${itemInput.originalQuotationItemId}'.`);
      err.statusCode = 400;
      throw err;
    }

    processedOriginalItemIds.add(origId);

    const quotedQty = Number(originalItem.quantity) || 0;
    const confirmedQty = Number(itemInput.confirmedQuantity) || 0;
    const extraQty = Number(itemInput.extraQuantity) || 0;

    if (confirmedQty < 0 || extraQty < 0) {
      const err = new Error('Confirmed quantity and extra quantity cannot be negative.');
      err.statusCode = 400;
      throw err;
    }

    // Check if deviated from original quoted quantity
    if (confirmedQty !== quotedQty) {
      isFullyConfirmed = false;
    }

    const unitPrice = Number(originalItem.mrpSnapshot) || 0;
    const gstPct = Number(originalItem.gstPctSnapshot) || 0;
    const totalLineQty = confirmedQty + extraQty;
    const lineConfirmedAmount = totalLineQty * unitPrice;

    resolvedConfirmedItems.push({
      originalQuotationItemId: originalItem._id,
      isExtraProduct: false,
      product: originalItem.product || null,
      isSkuLessItem: Boolean(originalItem.isSkuLessItem),
      skuCodeSnapshot: originalItem.skuCodeSnapshot || null,
      productNameSnapshot: originalItem.productNameSnapshot,
      imageSnapshot: originalItem.imageSnapshot || null,
      quotedQuantity: quotedQty,
      confirmedQuantity: confirmedQty,
      extraQuantity: extraQty,
      deliveredQuantity: 0,
      unitPriceSnapshot: unitPrice,
      gstPctSnapshot: gstPct,
      confirmedAmount: lineConfirmedAmount,
      remarks: itemInput.remarks || originalItem.remarks || null
    });
  }

  // Check if any original items from the quotation were omitted
  (quotation.items || []).forEach((origItem) => {
    if (!processedOriginalItemIds.has(String(origItem._id))) {
      isFullyConfirmed = false;
      // Record omitted items with confirmedQuantity: 0
      const unitPrice = Number(origItem.mrpSnapshot) || 0;
      resolvedConfirmedItems.push({
        originalQuotationItemId: origItem._id,
        isExtraProduct: false,
        product: origItem.product || null,
        isSkuLessItem: Boolean(origItem.isSkuLessItem),
        skuCodeSnapshot: origItem.skuCodeSnapshot || null,
        productNameSnapshot: origItem.productNameSnapshot,
        imageSnapshot: origItem.imageSnapshot || null,
        quotedQuantity: Number(origItem.quantity) || 0,
        confirmedQuantity: 0,
        extraQuantity: 0,
        deliveredQuantity: 0,
        unitPriceSnapshot: unitPrice,
        gstPctSnapshot: Number(origItem.gstPctSnapshot) || 0,
        confirmedAmount: 0,
        remarks: 'Item omitted by customer at confirmation'
      });
    }
  });

  // 4. Resolve Extra Items (Section 6)
  for (const extraInput of extraItems) {
    const extraQty = Number(extraInput.quantity || extraInput.confirmedQuantity) || 0;
    if (extraQty <= 0) {
      const err = new Error('Extra item quantity must be greater than 0.');
      err.statusCode = 400;
      throw err;
    }

    let productDoc = null;
    let productName = extraInput.adHocName || null;
    let unitPrice = Number(extraInput.adHocMrp) || 0;
    let skuCode = null;
    let image = null;
    let gstPct = Number(extraInput.gstPct) || 0;
    let isSkuLess = true;

    if (extraInput.productId) {
      productDoc = await Product.findOne({ _id: extraInput.productId, isActive: true });
      if (productDoc) {
        productName = productDoc.productName;
        unitPrice = Number(productDoc.mrp) || Number(productDoc.salePrice) || 0;
        skuCode = productDoc.companySkuCode || null;
        image = productDoc.productImage || null;
        gstPct = Number(productDoc.gstPct) || 0;
        isSkuLess = Boolean(productDoc.isSkuLess);
      }
    }

    if (!productName) {
      const err = new Error('Product name or valid product reference is required for extra items.');
      err.statusCode = 400;
      throw err;
    }

    const lineConfirmedAmount = extraQty * unitPrice;

    resolvedConfirmedItems.push({
      originalQuotationItemId: null,
      isExtraProduct: true,
      product: productDoc ? productDoc._id : null,
      isSkuLessItem: isSkuLess,
      skuCodeSnapshot: skuCode,
      productNameSnapshot: productName,
      imageSnapshot: image,
      quotedQuantity: 0,
      confirmedQuantity: extraQty,
      extraQuantity: 0,
      deliveredQuantity: 0,
      unitPriceSnapshot: unitPrice,
      gstPctSnapshot: gstPct,
      confirmedAmount: lineConfirmedAmount,
      remarks: extraInput.remarks || 'Extra product added at confirmation'
    });
  }

  // 5. Compute Summary Comparison Amounts (Section 7)
  const originalQuotationAmount = Number(quotation.grandTotal) || 0;

  let confirmedAmount = 0;
  let extraProductAmount = 0;

  resolvedConfirmedItems.forEach((item) => {
    if (item.isExtraProduct) {
      extraProductAmount += item.confirmedAmount;
    } else {
      confirmedAmount += item.confirmedAmount;
    }
  });

  const differenceAmount = originalQuotationAmount - confirmedAmount;
  const totalActualAmount = confirmedAmount + extraProductAmount;
  const confirmationStatus = isFullyConfirmed ? 'FULLY_CONFIRMED' : 'PARTIALLY_CONFIRMED';
  const pendingApproval = !hasApprovePermission;

  // 6. Create Confirmation Document
  const confirmation = await QuotationConfirmation.create({
    quotation: quotation._id,
    confirmationStatus,
    pendingApproval,
    confirmedItems: resolvedConfirmedItems,
    originalQuotationAmount,
    confirmedAmount,
    extraProductAmount,
    differenceAmount,
    totalActualAmount,
    isFullyDelivered: false,
    isActive: true,
    confirmedBy: user._id,
    createdBy: user._id
  });

  // 7. If approved, update Quotation status via quotationService
  if (!pendingApproval) {
    const targetStatus = confirmationStatus === 'FULLY_CONFIRMED' ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED';
    await quotationService.updateStatus(quotation._id, targetStatus, {
      userId: user._id,
      sourceModule: 'QUOTATION_CONFIRMATION'
    });
  }

  return await getConfirmationById(confirmation._id);
};

/**
 * Approve a pending confirmation (Managers with 'approve' permission)
 */
const approveConfirmation = async (id, user) => {
  const confirmation = await QuotationConfirmation.findOne({ _id: id, isActive: true });
  if (!confirmation) {
    const err = new Error('Quotation confirmation not found or inactive.');
    err.statusCode = 404;
    throw err;
  }

  confirmation.pendingApproval = false;
  confirmation.updatedBy = user._id;
  await confirmation.save();

  const targetStatus =
    confirmation.confirmationStatus === 'FULLY_CONFIRMED' ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED';

  await quotationService.updateStatus(confirmation.quotation, targetStatus, {
    userId: user._id,
    sourceModule: 'QUOTATION_CONFIRMATION'
  });

  return await getConfirmationById(confirmation._id);
};

/**
 * List Quotation Confirmations with filter, pagination & dataScope
 */
const getConfirmations = async (query = {}, scopeFilter = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = { ...scopeFilter };

  if (query.isActive !== undefined && query.isActive !== 'all') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  } else if (query.isActive === undefined) {
    filter.isActive = true;
  }

  if (query.quotationId) {
    filter.quotation = query.quotationId;
  }

  if (query.status) {
    filter.confirmationStatus = query.status.toUpperCase();
  }

  if (query.pendingApproval !== undefined) {
    filter.pendingApproval = query.pendingApproval === 'true' || query.pendingApproval === true;
  }

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = toDate;
    }
  }

  const total = await QuotationConfirmation.countDocuments(filter);
  const confirmations = await QuotationConfirmation.find(filter)
    .populate({
      path: 'quotation',
      select: 'quotationNumber quotationDate customer salesperson grandTotal status',
      populate: [
        { path: 'customer', select: 'customerName mobile city' },
        { path: 'salesperson', select: 'name mobile' }
      ]
    })
    .populate('confirmedBy', 'name mobile email')
    .populate('createdBy', 'name mobile')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    confirmations,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get Confirmation by ID
 */
const getConfirmationById = async (id, scopeFilter = {}) => {
  const filter = { _id: id, ...scopeFilter };
  const confirmation = await QuotationConfirmation.findOne(filter)
    .populate({
      path: 'quotation',
      select: 'quotationNumber quotationDate customer salesperson grandTotal status formatKey validityDate',
      populate: [
        { path: 'customer', select: 'customerName mobile email city billingAddress' },
        { path: 'salesperson', select: 'name mobile email' }
      ]
    })
    .populate('confirmedBy', 'name mobile email')
    .populate('createdBy', 'name mobile')
    .populate('updatedBy', 'name mobile');

  if (!confirmation) {
    const err = new Error('Quotation confirmation not found or inaccessible under current scope.');
    err.statusCode = 404;
    throw err;
  }

  return confirmation;
};

/**
 * Update Confirmation (Permitted ONLY if no material has been delivered yet)
 */
const updateConfirmation = async (id, data, user, scopeFilter = {}) => {
  const filter = { _id: id, ...scopeFilter };
  const confirmation = await QuotationConfirmation.findOne(filter);

  if (!confirmation) {
    const err = new Error('Quotation confirmation not found or not permitted to edit.');
    err.statusCode = 404;
    throw err;
  }

  // Delivery Lock: Check if ANY item has deliveredQuantity > 0 (Section 5 / Section 12 Rule 6)
  const hasDelivery = (confirmation.confirmedItems || []).some((it) => (Number(it.deliveredQuantity) || 0) > 0);
  if (hasDelivery) {
    const err = new Error(
      'Cannot edit confirmation: Material delivery has already started on one or more items. Use Return / Exchange module for post-delivery adjustments.'
    );
    err.statusCode = 400;
    throw err;
  }

  const { confirmedItems = [], extraItems = [] } = data;

  const quotation = await Quotation.findById(confirmation.quotation);
  const quotationItemsMap = new Map();
  (quotation.items || []).forEach((item) => {
    quotationItemsMap.set(String(item._id), item);
  });

  const updatedConfirmedItems = [];
  let isFullyConfirmed = true;
  const processedOriginalItemIds = new Set();

  for (const itemInput of confirmedItems) {
    const origId = String(itemInput.originalQuotationItemId || '');
    const originalItem = quotationItemsMap.get(origId);

    if (originalItem) {
      processedOriginalItemIds.add(origId);
      const quotedQty = Number(originalItem.quantity) || 0;
      const confirmedQty = Number(itemInput.confirmedQuantity) || 0;
      const extraQty = Number(itemInput.extraQuantity) || 0;

      if (confirmedQty !== quotedQty) isFullyConfirmed = false;

      const unitPrice = Number(originalItem.mrpSnapshot) || 0;
      const lineConfirmedAmount = (confirmedQty + extraQty) * unitPrice;

      updatedConfirmedItems.push({
        originalQuotationItemId: originalItem._id,
        isExtraProduct: false,
        product: originalItem.product || null,
        isSkuLessItem: Boolean(originalItem.isSkuLessItem),
        skuCodeSnapshot: originalItem.skuCodeSnapshot || null,
        productNameSnapshot: originalItem.productNameSnapshot,
        imageSnapshot: originalItem.imageSnapshot || null,
        quotedQuantity: quotedQty,
        confirmedQuantity: confirmedQty,
        extraQuantity: extraQty,
        deliveredQuantity: 0,
        unitPriceSnapshot: unitPrice,
        gstPctSnapshot: Number(originalItem.gstPctSnapshot) || 0,
        confirmedAmount: lineConfirmedAmount,
        remarks: itemInput.remarks || null
      });
    }
  }

  // Check omitted original items
  (quotation.items || []).forEach((origItem) => {
    if (!processedOriginalItemIds.has(String(origItem._id))) {
      isFullyConfirmed = false;
      updatedConfirmedItems.push({
        originalQuotationItemId: origItem._id,
        isExtraProduct: false,
        product: origItem.product || null,
        isSkuLessItem: Boolean(origItem.isSkuLessItem),
        skuCodeSnapshot: origItem.skuCodeSnapshot || null,
        productNameSnapshot: origItem.productNameSnapshot,
        imageSnapshot: origItem.imageSnapshot || null,
        quotedQuantity: Number(origItem.quantity) || 0,
        confirmedQuantity: 0,
        extraQuantity: 0,
        deliveredQuantity: 0,
        unitPriceSnapshot: Number(origItem.mrpSnapshot) || 0,
        gstPctSnapshot: Number(origItem.gstPctSnapshot) || 0,
        confirmedAmount: 0,
        remarks: 'Item omitted by customer at confirmation'
      });
    }
  });

  // Resolve extra items
  for (const extraInput of extraItems) {
    const extraQty = Number(extraInput.quantity || extraInput.confirmedQuantity) || 0;
    if (extraQty > 0) {
      let productDoc = null;
      let productName = extraInput.adHocName || null;
      let unitPrice = Number(extraInput.adHocMrp) || 0;
      let skuCode = null;
      let image = null;
      let gstPct = 0;
      let isSkuLess = true;

      if (extraInput.productId) {
        productDoc = await Product.findOne({ _id: extraInput.productId, isActive: true });
        if (productDoc) {
          productName = productDoc.productName;
          unitPrice = Number(productDoc.mrp) || Number(productDoc.salePrice) || 0;
          skuCode = productDoc.companySkuCode || null;
          image = productDoc.productImage || null;
          gstPct = Number(productDoc.gstPct) || 0;
          isSkuLess = Boolean(productDoc.isSkuLess);
        }
      }

      if (productName) {
        const lineConfirmedAmount = extraQty * unitPrice;
        updatedConfirmedItems.push({
          originalQuotationItemId: null,
          isExtraProduct: true,
          product: productDoc ? productDoc._id : null,
          isSkuLessItem: isSkuLess,
          skuCodeSnapshot: skuCode,
          productNameSnapshot: productName,
          imageSnapshot: image,
          quotedQuantity: 0,
          confirmedQuantity: extraQty,
          extraQuantity: 0,
          deliveredQuantity: 0,
          unitPriceSnapshot: unitPrice,
          gstPctSnapshot: gstPct,
          confirmedAmount: lineConfirmedAmount,
          remarks: extraInput.remarks || 'Extra product'
        });
      }
    }
  }

  // Recalculate summary amounts
  let confirmedAmount = 0;
  let extraProductAmount = 0;
  updatedConfirmedItems.forEach((item) => {
    if (item.isExtraProduct) extraProductAmount += item.confirmedAmount;
    else confirmedAmount += item.confirmedAmount;
  });

  confirmation.confirmedItems = updatedConfirmedItems;
  confirmation.confirmedAmount = confirmedAmount;
  confirmation.extraProductAmount = extraProductAmount;
  confirmation.differenceAmount = confirmation.originalQuotationAmount - confirmedAmount;
  confirmation.totalActualAmount = confirmedAmount + extraProductAmount;
  confirmation.confirmationStatus = isFullyConfirmed ? 'FULLY_CONFIRMED' : 'PARTIALLY_CONFIRMED';
  confirmation.updatedBy = user._id;

  await confirmation.save();

  // If already approved, update Quotation status
  if (!confirmation.pendingApproval) {
    const targetStatus =
      confirmation.confirmationStatus === 'FULLY_CONFIRMED' ? 'CONFIRMED' : 'PARTIALLY_CONFIRMED';
    await quotationService.updateStatus(confirmation.quotation, targetStatus, {
      userId: user._id,
      sourceModule: 'QUOTATION_CONFIRMATION'
    });
  }

  return await getConfirmationById(confirmation._id);
};

/**
 * Cancel a confirmation (Permitted ONLY if no delivery has occurred)
 * Reverts Quotation status back to CUSTOMER_INTERESTED
 */
const cancelConfirmation = async (id, user, scopeFilter = {}) => {
  const filter = { _id: id, ...scopeFilter };
  const confirmation = await QuotationConfirmation.findOne(filter);

  if (!confirmation) {
    const err = new Error('Quotation confirmation not found or not permitted to cancel.');
    err.statusCode = 404;
    throw err;
  }

  // Delivery Lock Check
  const hasDelivery = (confirmation.confirmedItems || []).some((it) => (Number(it.deliveredQuantity) || 0) > 0);
  if (hasDelivery) {
    const err = new Error(
      'Cannot cancel confirmation: Material delivery has already occurred against this record.'
    );
    err.statusCode = 400;
    throw err;
  }

  confirmation.isActive = false;
  confirmation.updatedBy = user._id;
  await confirmation.save();

  // Revert Quotation status back to CUSTOMER_INTERESTED so Follow-Up module can resume
  await quotationService.updateStatus(confirmation.quotation, 'CUSTOMER_INTERESTED', {
    userId: user._id,
    sourceModule: 'QUOTATION_CONFIRMATION'
  });

  return confirmation;
};

/**
 * Get 4-Stage Quantity Ledger per item
 * (Quoted -> Confirmed -> Extra -> Issued/Delivered -> Pending)
 */
const getQuantityLedger = async (id, scopeFilter = {}) => {
  const confirmation = await getConfirmationById(id, scopeFilter);

  const ledger = (confirmation.confirmedItems || []).map((item) => {
    const totalCommitted = (Number(item.confirmedQuantity) || 0) + (Number(item.extraQuantity) || 0);
    const delivered = Number(item.deliveredQuantity) || 0;
    const pendingDelivery = Math.max(0, totalCommitted - delivered);

    return {
      itemId: item._id,
      productName: item.productNameSnapshot,
      skuCode: item.skuCodeSnapshot,
      isExtraProduct: item.isExtraProduct,
      quotedQuantity: item.quotedQuantity,
      confirmedQuantity: item.confirmedQuantity,
      extraQuantity: item.extraQuantity,
      totalCommittedQuantity: totalCommitted,
      deliveredQuantity: delivered,
      pendingDeliveryQuantity: pendingDelivery,
      unitPrice: item.unitPriceSnapshot,
      confirmedAmount: item.confirmedAmount
    };
  });

  return {
    confirmationId: confirmation._id,
    quotationNumber: confirmation.quotation?.quotationNumber || 'N/A',
    confirmationStatus: confirmation.confirmationStatus,
    isFullyDelivered: confirmation.isFullyDelivered,
    itemsLedger: ledger
  };
};

/**
 * Get Quotation Amount vs Actual Amount Comparison Breakdown (Section 7)
 */
const getAmountComparison = async (id, scopeFilter = {}) => {
  const confirmation = await getConfirmationById(id, scopeFilter);

  const finalInvoiceAmount = await getInvoiceAmountStub(confirmation._id);
  const paymentReceived = await getPaymentReceivedStub(confirmation._id);
  const outstandingAmount = Math.max(0, (finalInvoiceAmount || confirmation.totalActualAmount) - paymentReceived);

  return {
    confirmationId: confirmation._id,
    quotationNumber: confirmation.quotation?.quotationNumber || 'N/A',
    originalQuotationAmount: confirmation.originalQuotationAmount,
    confirmedAmount: confirmation.confirmedAmount,
    extraProductAmount: confirmation.extraProductAmount,
    differenceAmount: confirmation.differenceAmount,
    totalActualAmount: confirmation.totalActualAmount,
    finalInvoiceAmount,
    paymentReceived,
    outstandingAmount
  };
};

/**
 * Export Confirmation & Quantity Ledger to Excel (.xlsx)
 */
const exportConfirmationToExcel = async (id, scopeFilter = {}) => {
  const confirmation = await getConfirmationById(id, scopeFilter);
  const ledgerData = await getQuantityLedger(id, scopeFilter);

  const exportData = (ledgerData.itemsLedger || []).map((it, idx) => ({
    'Sr. No.': idx + 1,
    'Product Name': it.productName,
    'SKU Code': it.skuCode || 'N/A',
    'Type': it.isExtraProduct ? 'Extra / Added' : 'Originally Quoted',
    'Quoted Qty': it.quotedQuantity,
    'Confirmed Qty': it.confirmedQuantity,
    'Extra Qty': it.extraQuantity,
    'Total Committed Qty': it.totalCommittedQuantity,
    'Delivered Qty': it.deliveredQuantity,
    'Pending Delivery': it.pendingDeliveryQuantity,
    'Unit Rate (₹)': it.unitPrice,
    'Confirmed Amount (₹)': it.confirmedAmount
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quantity Ledger');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * Forward Reference Internal Service (Consumed by Module 8 Stock)
 * Finds all confirmed items where deliveredQuantity < totalCommitted
 */
const getConfirmedPendingDelivery = async (productId = null) => {
  try {
    const filter = { isActive: true };
    const confirmations = await QuotationConfirmation.find(filter).lean();

    const pendingItems = [];
    confirmations.forEach((c) => {
      (c.confirmedItems || []).forEach((item) => {
        const totalCommitted = (Number(item.confirmedQuantity) || 0) + (Number(item.extraQuantity) || 0);
        const delivered = Number(item.deliveredQuantity) || 0;
        const pending = totalCommitted - delivered;

        if (pending > 0) {
          if (!productId || (item.product && String(item.product) === String(productId))) {
            pendingItems.push({
              confirmationId: c._id,
              quotationId: c.quotation,
              product: item.product,
              productName: item.productNameSnapshot,
              skuCode: item.skuCodeSnapshot,
              pendingQuantity: pending,
              unitPrice: item.unitPriceSnapshot
            });
          }
        }
      });
    });

    return pendingItems;
  } catch (err) {
    console.warn('Error in getConfirmedPendingDelivery:', err.message);
    return [];
  }
};

/**
 * Forward Reference Internal Service (Consumed Exclusively by Module 9 Challan)
 * Records delivery against a confirmed line item, updates status, and re-evaluates isFullyDelivered
 */
const recordDelivery = async (confirmationId, itemId, deliveredQty, options = {}) => {
  const { session = null } = options;
  const query = QuotationConfirmation.findOne({
    _id: confirmationId,
    isActive: true
  });
  if (session) query.session(session);
  const confirmation = await query;

  if (!confirmation) {
    throw new Error(`Quotation Confirmation not found with ID '${confirmationId}'.`);
  }

  const targetItem = confirmation.confirmedItems.id(itemId);
  if (!targetItem) {
    throw new Error(`Item not found with ID '${itemId}' in confirmation '${confirmationId}'.`);
  }

  const currentDelivered = Number(targetItem.deliveredQuantity) || 0;
  const totalCommitted = (Number(targetItem.confirmedQuantity) || 0) + (Number(targetItem.extraQuantity) || 0);
  const pending = totalCommitted - currentDelivered;

  if (Number(deliveredQty) > pending) {
    throw new Error(
      `Delivery overflow rejected for '${targetItem.productNameSnapshot}'. Requested: ${deliveredQty}, remaining pending delivery: ${pending}.`
    );
  }

  targetItem.deliveredQuantity = currentDelivered + Number(deliveredQty);
  targetItem.pendingQuantity = Math.max(0, totalCommitted - targetItem.deliveredQuantity);
  targetItem.deliveryStatus = targetItem.deliveredQuantity >= totalCommitted ? 'DELIVERED' : 'PARTIALLY_DELIVERED';

  // Check if every item is now fully delivered
  const allDelivered = (confirmation.confirmedItems || []).every((it) => {
    const committed = (Number(it.confirmedQuantity) || 0) + (Number(it.extraQuantity) || 0);
    return (Number(it.deliveredQuantity) || 0) >= committed;
  });

  confirmation.isFullyDelivered = allDelivered;
  confirmation.overallDeliveryStatus = allDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED';

  if (session) {
    await confirmation.save({ session });
  } else {
    await confirmation.save();
  }

  return confirmation;
};

module.exports = {
  createConfirmation,
  approveConfirmation,
  getConfirmations,
  getConfirmationById,
  updateConfirmation,
  cancelConfirmation,
  getQuantityLedger,
  getAmountComparison,
  exportConfirmationToExcel,
  getConfirmedPendingDelivery,
  recordDelivery
};
