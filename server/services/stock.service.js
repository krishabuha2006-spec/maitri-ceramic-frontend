const mongoose = require('mongoose');
const XLSX = require('xlsx');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const StockEntryNumberSequence = require('../models/StockEntryNumberSequence');
const Product = require('../models/Product');
const productService = require('./product.service');
const confirmationService = require('./confirmation.service');

/**
 * Manual Stock In Entry (Opening Stock, Purchase Entry, Manual Addition, Other)
 */
const stockIn = async (data, user) => {
  const { productId, quantity, reason, referenceDocNote, remarks } = data;

  if (!productId) {
    const err = new Error('Product ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    const err = new Error('Quantity must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  const validInReasons = ['OPENING_STOCK', 'PURCHASE_ENTRY', 'MANUAL_ADDITION', 'OTHER'];
  if (!reason || !validInReasons.includes(reason.toUpperCase())) {
    const err = new Error(`Reason must be one of: ${validInReasons.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    const err = new Error(`Active product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const entryNumber = await StockEntryNumberSequence.generateNextNumber();
  const balanceAfter = (Number(product.currentStock) || 0) + qty;

  // 1. Atomically update Product.currentStock cache
  await productService.adjustStock(product._id, +qty);

  // 2. Append immutable ledger entry
  const entry = await StockLedgerEntry.create({
    product: product._id,
    skuCodeSnapshot: product.companySkuCode || null,
    entryNumber,
    entryDate: new Date(),
    direction: 'IN',
    quantity: qty,
    reason: reason.toUpperCase(),
    referenceDocType: 'MANUAL',
    referenceDocNote: referenceDocNote ? referenceDocNote.trim() : null,
    balanceAfter,
    remarks: remarks ? remarks.trim() : null,
    postedBy: user._id
  });

  return await StockLedgerEntry.findById(entry._id)
    .populate('product', 'productName companySkuCode currentStock unit')
    .populate('postedBy', 'name mobile');
};

/**
 * Manual Stock Out Entry (Manual Deduction, Other)
 */
const stockOut = async (data, user, options = {}) => {
  const { productId, quantity, reason, referenceDocNote, remarks, allowNegative = false } = data;

  if (!productId) {
    const err = new Error('Product ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    const err = new Error('Quantity must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  const validOutReasons = ['MANUAL_DEDUCTION', 'OTHER'];
  if (!reason || !validOutReasons.includes(reason.toUpperCase())) {
    const err = new Error(`Reason must be one of: ${validOutReasons.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    const err = new Error(`Active product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const currentStock = Number(product.currentStock) || 0;
  const balanceAfter = currentStock - qty;

  if (balanceAfter < 0 && !allowNegative) {
    const err = new Error(
      `Stock deduction rejected: Product '${product.productName}' current stock is ${currentStock}. Deducting ${qty} would cause negative stock (${balanceAfter}).`
    );
    err.statusCode = 400;
    throw err;
  }

  const entryNumber = await StockEntryNumberSequence.generateNextNumber();

  // 1. Atomically update Product.currentStock cache
  await productService.adjustStock(product._id, -qty, { allowNegative });

  // 2. Append immutable ledger entry
  const entry = await StockLedgerEntry.create({
    product: product._id,
    skuCodeSnapshot: product.companySkuCode || null,
    entryNumber,
    entryDate: new Date(),
    direction: 'OUT',
    quantity: qty,
    reason: reason.toUpperCase(),
    referenceDocType: 'MANUAL',
    referenceDocNote: referenceDocNote ? referenceDocNote.trim() : null,
    balanceAfter,
    remarks: remarks
      ? remarks.trim()
      : allowNegative
      ? 'Emergency stock deduction with allowNegative override'
      : null,
    postedBy: user._id
  });

  return await StockLedgerEntry.findById(entry._id)
    .populate('product', 'productName companySkuCode currentStock unit')
    .populate('postedBy', 'name mobile');
};

/**
 * List Stock Ledger Entries with filter & pagination
 */
const getEntries = async (query = {}) => {
  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const filter = {};

  if (query.productId) filter.product = query.productId;
  if (query.direction) filter.direction = query.direction.toUpperCase();
  if (query.reason) filter.reason = query.reason.toUpperCase();

  if (query.from || query.to) {
    filter.entryDate = {};
    if (query.from) filter.entryDate.$gte = new Date(query.from);
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.entryDate.$lte = toDate;
    }
  }

  const total = await StockLedgerEntry.countDocuments(filter);
  const entries = await StockLedgerEntry.find(filter)
    .populate('product', 'productName companySkuCode unit mrp currentStock')
    .populate('postedBy', 'name mobile email')
    .sort({ entryDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    entries,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get Stock Summary for a Product (Actual Stock, Management Stock, Available Stock)
 */
const getSummary = async (productId) => {
  const product = await Product.findOne({ _id: productId, isActive: true })
    .populate('unit', 'unitName unitCode')
    .populate('company', 'companyName');

  if (!product) {
    const err = new Error(`Product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const actualStock = Number(product.currentStock) || 0;

  // Management Stock: Computed LIVE from Module 7's confirmed pending deliveries
  const pendingItems = await confirmationService.getConfirmedPendingDelivery(product._id);
  const managementStock = pendingItems.reduce((sum, item) => sum + (Number(item.pendingQuantity) || 0), 0);

  const availableStock = actualStock - managementStock;
  const reorderAlertQty = Number(product.reorderAlertQty) || 0;
  const isLowStock = actualStock <= reorderAlertQty;

  return {
    productId: product._id,
    productName: product.productName,
    skuCode: product.companySkuCode || null,
    unit: product.unit ? product.unit.unitCode : 'PCS',
    company: product.company ? product.company.companyName : null,
    actualStock,
    managementStock,
    availableStock,
    reorderAlertQty,
    isLowStock,
    purchaseRequired: availableStock < 0,
    shortfallQuantity: availableStock < 0 ? Math.abs(availableStock) : 0
  };
};

/**
 * Get Movement History (Ledger) for one product
 */
const getMovementHistory = async (productId, query = {}) => {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    const err = new Error(`Product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const entries = await StockLedgerEntry.find({ product: productId })
    .populate('postedBy', 'name mobile')
    .sort({ entryDate: -1, createdAt: -1 })
    .lean();

  return {
    product: {
      _id: product._id,
      productName: product.productName,
      skuCode: product.companySkuCode || null,
      currentStock: product.currentStock || 0
    },
    totalMovements: entries.length,
    movementHistory: entries.map((e) => ({
      _id: e._id,
      entryNumber: e.entryNumber,
      entryDate: e.entryDate,
      direction: e.direction,
      quantity: e.quantity,
      signedQuantity: e.direction === 'IN' ? `+${e.quantity}` : `-${e.quantity}`,
      reason: e.reason,
      referenceDocType: e.referenceDocType,
      referenceDocNote: e.referenceDocNote,
      balanceAfter: e.balanceAfter,
      remarks: e.remarks,
      postedBy: e.postedBy ? e.postedBy.name : 'System'
    }))
  };
};

/**
 * Low Stock Report (Products where currentStock <= reorderAlertQty)
 */
const getLowStockReport = async (query = {}) => {
  const filter = {
    isActive: true,
    $expr: { $lte: ['$currentStock', '$reorderAlertQty'] }
  };

  if (query.companyId) filter.company = query.companyId;
  if (query.productGroupId) filter.productGroup = query.productGroupId;

  const lowStockProducts = await Product.find(filter)
    .populate('unit', 'unitCode unitName')
    .populate('company', 'companyName')
    .populate('productGroup', 'groupName')
    .sort({ currentStock: 1 })
    .lean();

  return {
    totalLowStockCount: lowStockProducts.length,
    products: lowStockProducts.map((p) => ({
      _id: p._id,
      productName: p.productName,
      skuCode: p.companySkuCode || 'N/A',
      company: p.company?.companyName || 'N/A',
      currentStock: p.currentStock || 0,
      reorderAlertQty: p.reorderAlertQty || 0,
      deficit: (p.reorderAlertQty || 0) - (p.currentStock || 0),
      unit: p.unit?.unitCode || 'PCS',
      mrp: p.mrp || 0
    }))
  };
};

/**
 * Purchase Alert Calculation (Section 8)
 * Identifies products where Management Stock > Actual Stock (Available Stock < 0)
 */
const getPurchaseAlerts = async (query = {}) => {
  const pendingCommitments = await confirmationService.getConfirmedPendingDelivery();

  const productCommitmentMap = new Map();
  pendingCommitments.forEach((item) => {
    const pId = String(item.product);
    const qty = Number(item.pendingQuantity) || 0;
    productCommitmentMap.set(pId, (productCommitmentMap.get(pId) || 0) + qty);
  });

  const products = await Product.find({ isActive: true })
    .populate('unit', 'unitCode')
    .populate('company', 'companyName')
    .populate('vendor', 'vendorName mobile')
    .lean();

  const alerts = [];

  products.forEach((product) => {
    const pId = String(product._id);
    const actualStock = Number(product.currentStock) || 0;
    const managementStock = productCommitmentMap.get(pId) || 0;
    const availableStock = actualStock - managementStock;
    const reorderAlertQty = Number(product.reorderAlertQty) || 0;

    // Trigger purchase alert if availableStock is negative or below reorder level with commitments
    if (availableStock < 0 || (managementStock > 0 && availableStock <= reorderAlertQty)) {
      const shortfall = availableStock < 0 ? Math.abs(availableStock) : 0;
      const suggestedPurchaseQty = shortfall > 0 ? shortfall + reorderAlertQty : reorderAlertQty;

      alerts.push({
        productId: product._id,
        productName: product.productName,
        skuCode: product.companySkuCode || 'N/A',
        company: product.company?.companyName || 'N/A',
        preferredVendor: product.vendor ? { name: product.vendor.vendorName, mobile: product.vendor.mobile } : null,
        actualStock,
        managementStock,
        availableStock,
        reorderAlertQty,
        shortfallQuantity: shortfall,
        suggestedPurchaseQuantity: suggestedPurchaseQty,
        unit: product.unit?.unitCode || 'PCS',
        alertLevel: availableStock < 0 ? 'CRITICAL_SHORTFALL' : 'LOW_AVAILABLE_STOCK'
      });
    }
  });

  return {
    totalAlertsCount: alerts.length,
    criticalShortfallCount: alerts.filter((a) => a.alertLevel === 'CRITICAL_SHORTFALL').length,
    alerts
  };
};

/**
 * Reconcile Stock for a Product (Admin Safety Net)
 * Re-sums all ledger entries and updates Product.currentStock
 */
const reconcileStock = async (productId, user) => {
  const product = await Product.findOne({ _id: productId, isActive: true });
  if (!product) {
    const err = new Error(`Product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const entries = await StockLedgerEntry.find({ product: productId }).sort({ entryDate: 1, createdAt: 1 });

  let computedStock = 0;
  entries.forEach((e) => {
    if (e.direction === 'IN') {
      computedStock += Number(e.quantity) || 0;
    } else {
      computedStock -= Number(e.quantity) || 0;
    }
  });

  const previousCache = product.currentStock || 0;
  const drift = computedStock - previousCache;

  product.currentStock = computedStock;
  product.updatedBy = user._id;
  await product.save();

  return {
    productId: product._id,
    productName: product.productName,
    previousStockCache: previousCache,
    reconciledStock: computedStock,
    driftIdentified: drift,
    totalLedgerEntriesEvaluated: entries.length,
    reconciledAt: new Date(),
    reconciledBy: user.name || user._id
  };
};

/**
 * Export Stock Reports to Excel (.xlsx)
 */
const exportStockToExcel = async (query = {}) => {
  const { reportType = 'movement', productId } = query;
  const workbook = XLSX.utils.book_new();

  if (reportType === 'low-stock') {
    const reportData = await getLowStockReport(query);
    const exportRows = (reportData.products || []).map((p, idx) => ({
      'Sr. No.': idx + 1,
      'Product Name': p.productName,
      'SKU Code': p.skuCode,
      'Company': p.company,
      'Actual Stock': p.currentStock,
      'Reorder Level': p.reorderAlertQty,
      'Deficit': p.deficit,
      'Unit': p.unit,
      'MRP (₹)': p.mrp
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'Low Stock Report');
  } else if (reportType === 'purchase-alert') {
    const alertData = await getPurchaseAlerts(query);
    const exportRows = (alertData.alerts || []).map((a, idx) => ({
      'Sr. No.': idx + 1,
      'Product Name': a.productName,
      'SKU Code': a.skuCode,
      'Alert Level': a.alertLevel,
      'Actual Stock': a.actualStock,
      'Management Stock': a.managementStock,
      'Available Stock': a.availableStock,
      'Shortfall Qty': a.shortfallQuantity,
      'Suggested Purchase Qty': a.suggestedPurchaseQuantity,
      'Preferred Vendor': a.preferredVendor?.name || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'Purchase Alerts');
  } else {
    // Default: Movement History
    const entriesData = await getEntries({ ...query, limit: 10000 });
    const exportRows = (entriesData.entries || []).map((e, idx) => ({
      'Sr. No.': idx + 1,
      'Entry #': e.entryNumber,
      'Date': e.entryDate ? new Date(e.entryDate).toLocaleDateString('en-IN') : '',
      'Product Name': e.product?.productName || 'N/A',
      'SKU Code': e.skuCodeSnapshot || e.product?.companySkuCode || 'N/A',
      'Direction': e.direction,
      'Quantity': e.quantity,
      'Transaction Reason': e.reason,
      'Balance After': e.balanceAfter,
      'Reference Note': e.referenceDocNote || '',
      'Remarks': e.remarks || '',
      'Posted By': e.postedBy?.name || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'Stock Movement History');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * =========================================================================
 * FORWARD-REFERENCE SERVICES FOR DOWNSTREAM MODULES (Module 9 Challan & Module 12 Returns)
 * =========================================================================
 */

/**
 * Deduct stock automatically upon Challan Issue / Purchase Return
 * Consumed exclusively by Module 9 (Challan) & Module 12 (Purchase Return)
 */
const deductStock = async (productId, quantity, reason, referenceDocType, referenceDocId, options = {}) => {
  const { session = null, allowNegative = false, referenceDocNote = null, postedBy = null } = options;

  const automatedReasons = ['CHALLAN_ISSUE', 'PURCHASE_RETURN', 'MANUAL_DEDUCTION', 'OTHER'];
  if (!automatedReasons.includes(reason)) {
    throw new Error(`Invalid stock deduction reason '${reason}'.`);
  }

  if (['CHALLAN_ISSUE', 'PURCHASE_RETURN'].includes(reason) && (!referenceDocType || !referenceDocId)) {
    throw new Error(`Reference document type and ID are mandatory for automated stock deduction reason '${reason}'.`);
  }

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error(`Product not found with ID '${productId}'.`);
  }

  const qty = Number(quantity);
  const currentStock = Number(product.currentStock) || 0;
  const balanceAfter = currentStock - qty;

  if (balanceAfter < 0 && !allowNegative) {
    const err = new Error(
      `Insufficient physical stock for '${product.productName}'. Current stock: ${currentStock}, required: ${qty}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const entryNumber = await StockEntryNumberSequence.generateNextNumber();

  // 1. Adjust Product currentStock cache
  await productService.adjustStock(product._id, -qty, { session, allowNegative });

  // 2. Append immutable ledger entry
  const entry = new StockLedgerEntry({
    product: product._id,
    skuCodeSnapshot: product.companySkuCode || null,
    entryNumber,
    entryDate: new Date(),
    direction: 'OUT',
    quantity: qty,
    reason,
    referenceDocType: referenceDocType || null,
    referenceDocId: referenceDocId || null,
    referenceDocNote,
    balanceAfter,
    remarks: options.remarks || null,
    postedBy: postedBy || product.createdBy
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

/**
 * Add stock automatically upon Sales Return
 * Consumed exclusively by Module 12 (Sales Return)
 */
const addStock = async (productId, quantity, reason, referenceDocType, referenceDocId, options = {}) => {
  const { session = null, referenceDocNote = null, postedBy = null } = options;

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error(`Product not found with ID '${productId}'.`);
  }

  const qty = Number(quantity);
  const balanceAfter = (Number(product.currentStock) || 0) + qty;
  const entryNumber = await StockEntryNumberSequence.generateNextNumber();

  // 1. Adjust Product currentStock cache
  await productService.adjustStock(product._id, +qty, { session });

  // 2. Append immutable ledger entry
  const entry = new StockLedgerEntry({
    product: product._id,
    skuCodeSnapshot: product.companySkuCode || null,
    entryNumber,
    entryDate: new Date(),
    direction: 'IN',
    quantity: qty,
    reason,
    referenceDocType: referenceDocType || null,
    referenceDocId: referenceDocId || null,
    referenceDocNote,
    balanceAfter,
    remarks: options.remarks || null,
    postedBy: postedBy || product.createdBy
  });

  if (session) {
    await entry.save({ session });
  } else {
    await entry.save();
  }

  return entry;
};

const getActualStock = async (productId) => {
  const p = await Product.findById(productId).select('currentStock');
  return Number(p?.currentStock) || 0;
};

const getManagementStock = async (productId) => {
  const summary = await getSummary(productId);
  return summary.managementStock;
};

const getAvailableStock = async (productId) => {
  const summary = await getSummary(productId);
  return summary.availableStock;
};

module.exports = {
  stockIn,
  stockOut,
  getEntries,
  getSummary,
  getMovementHistory,
  getLowStockReport,
  getPurchaseAlerts,
  reconcileStock,
  exportStockToExcel,
  deductStock,
  addStock,
  getActualStock,
  getManagementStock,
  getAvailableStock
};
