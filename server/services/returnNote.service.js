const mongoose = require('mongoose');
const XLSX = require('xlsx');
const ReturnNote = require('../models/ReturnNote');
const ReturnNoteNumberSequence = require('../models/ReturnNoteNumberSequence');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
const Challan = require('../models/Challan');
const UnitMaster = require('../models/UnitMaster');
const stockService = require('./stock.service');

/**
 * Record a Purchase Return (Material returned to Vendor)
 * Status defaults to DRAFT with zero stock impact
 */
const createPurchaseReturn = async (data, user) => {
  const {
    vendorId,
    purchaseReferenceNote,
    productId,
    quantity,
    returnReason,
    remarks,
    returnDate
  } = data;

  let vendor = null;
  if (vendorId) {
    if (mongoose.Types.ObjectId.isValid(vendorId)) {
      vendor = await Vendor.findOne({ _id: vendorId, isActive: true });
    }
    if (!vendor) {
      vendor = await Vendor.findOne({ vendorName: { $regex: `^${vendorId}$`, $options: 'i' }, isActive: true });
    }
    if (!vendor) {
      vendor = await Vendor.findOne({ vendorName: { $regex: vendorId, $options: 'i' }, isActive: true });
    }
  }
  if (!vendor && data.vendor) {
    vendor = await Vendor.findOne({ vendorName: { $regex: data.vendor, $options: 'i' }, isActive: true });
  }
  if (!vendor) {
    vendor = await Vendor.findOne({ isActive: true });
  }
  if (!vendor) {
    const err = new Error('No active vendor found. Please register a vendor first.');
    err.statusCode = 400;
    throw err;
  }

  let product = null;
  if (productId) {
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findOne({ _id: productId, isActive: true }).populate('unit');
    }
    if (!product) {
      product = await Product.findOne({ companySkuCode: productId, isActive: true }).populate('unit');
    }
  }
  if (!product && data.sku) {
    product = await Product.findOne({ companySkuCode: data.sku, isActive: true }).populate('unit');
  }
  if (!product && data.productName) {
    product = await Product.findOne({ productName: { $regex: data.productName, $options: 'i' }, isActive: true }).populate('unit');
  }
  if (!product) {
    product = await Product.findOne({ isActive: true }).populate('unit');
  }
  if (!product) {
    const err = new Error('No active product found. Please select or add a product first.');
    err.statusCode = 400;
    throw err;
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    const err = new Error('Return quantity must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  const reason = (returnReason && returnReason.trim()) || 'Defective / Excess material return';
  const targetDate = returnDate ? new Date(returnDate) : new Date();
  const returnNoteNumber = data.returnNoteNumber || await ReturnNoteNumberSequence.generateNextNumber(targetDate);

  const returnNote = await ReturnNote.create({
    returnNoteNumber,
    returnType: 'PURCHASE_RETURN',
    returnDate: targetDate,
    vendor: vendor._id,
    purchaseReferenceNote: purchaseReferenceNote ? purchaseReferenceNote.trim() : (data.purchaseRef || null),
    product: product._id,
    skuCodeSnapshot: product.companySkuCode || data.sku || null,
    productNameSnapshot: product.productName || data.productName,
    quantity: qty,
    unit: product.unit?._id || product.unit,
    returnReason: reason,
    remarks: remarks ? remarks.trim() : null,
    returnStatus: 'DRAFT',
    createdBy: user?._id || null
  });

  return await getReturnById(returnNote._id);
};

/**
 * Record a Sales Return (Material returned by Customer)
 * Status defaults to DRAFT with zero stock impact
 */
const createSalesReturn = async (data, user) => {
  const {
    customerId,
    invoiceId,
    challanId,
    productId,
    quantity,
    returnReason,
    remarks,
    returnDate
  } = data;

  let customer = null;
  if (customerId) {
    if (mongoose.Types.ObjectId.isValid(customerId)) {
      customer = await Customer.findOne({ _id: customerId, isActive: true });
    }
    if (!customer) {
      customer = await Customer.findOne({ customerName: { $regex: `^${customerId}$`, $options: 'i' }, isActive: true });
    }
  }
  if (!customer && (data.customerName || data.customer)) {
    const cName = data.customerName || data.customer;
    customer = await Customer.findOne({ customerName: { $regex: cName, $options: 'i' }, isActive: true });
  }
  if (!customer) {
    customer = await Customer.findOne({ isActive: true });
  }
  if (!customer) {
    const err = new Error('No active customer found. Please register a customer first.');
    err.statusCode = 400;
    throw err;
  }

  // Validate optional Invoice reference
  let invoiceDoc = null;
  if (invoiceId && mongoose.Types.ObjectId.isValid(invoiceId)) {
    invoiceDoc = await Invoice.findOne({ _id: invoiceId, isActive: true });
  } else if (data.invoiceNumber) {
    invoiceDoc = await Invoice.findOne({ invoiceNumber: data.invoiceNumber, isActive: true });
  }

  // Validate optional Challan reference
  let challanDoc = null;
  if (challanId && mongoose.Types.ObjectId.isValid(challanId)) {
    challanDoc = await Challan.findOne({ _id: challanId, isActive: true });
  } else if (data.challanNumber) {
    challanDoc = await Challan.findOne({ challanNumber: data.challanNumber, isActive: true });
  }

  let product = null;
  if (productId) {
    if (mongoose.Types.ObjectId.isValid(productId)) {
      product = await Product.findOne({ _id: productId, isActive: true }).populate('unit');
    }
    if (!product) {
      product = await Product.findOne({ companySkuCode: productId, isActive: true }).populate('unit');
    }
  }
  if (!product && data.sku) {
    product = await Product.findOne({ companySkuCode: data.sku, isActive: true }).populate('unit');
  }
  if (!product && data.productName) {
    product = await Product.findOne({ productName: { $regex: data.productName, $options: 'i' }, isActive: true }).populate('unit');
  }
  if (!product) {
    product = await Product.findOne({ isActive: true }).populate('unit');
  }
  if (!product) {
    const err = new Error('No active product found.');
    err.statusCode = 400;
    throw err;
  }

  const qty = Number(quantity);
  if (!qty || qty <= 0) {
    const err = new Error('Return quantity must be greater than 0.');
    err.statusCode = 400;
    throw err;
  }

  const reason = (returnReason && returnReason.trim()) || 'Defective / Excess material return';
  const targetDate = returnDate ? new Date(returnDate) : new Date();
  const returnNoteNumber = data.returnNoteNumber || await ReturnNoteNumberSequence.generateNextNumber(targetDate);

  const returnNote = await ReturnNote.create({
    returnNoteNumber,
    returnType: 'SALES_RETURN',
    returnDate: targetDate,
    customer: customer._id,
    invoice: invoiceDoc ? invoiceDoc._id : null,
    challan: challanDoc ? challanDoc._id : null,
    product: product._id,
    skuCodeSnapshot: product.companySkuCode || data.sku || null,
    productNameSnapshot: product.productName || data.productName,
    quantity: qty,
    unit: product.unit?._id || product.unit,
    returnReason: reason,
    remarks: remarks ? remarks.trim() : null,
    returnStatus: 'DRAFT',
    createdBy: user?._id || null
  });

  return await getReturnById(returnNote._id);
};

/**
 * Get Return Note by ID with populated references
 */
const getReturnById = async (id, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };

  const returnNote = await ReturnNote.findOne(filter)
    .populate('vendor', 'vendorName contactPerson mobile email')
    .populate('customer', 'customerName mobile city state gstNumber')
    .populate('invoice', 'invoiceNumber invoiceDate grandTotal status')
    .populate('challan', 'challanNumber challanDate status')
    .populate('product', 'productName companySkuCode currentStock mrp')
    .populate('unit', 'unitName unitCode')
    .populate('createdBy', 'name email mobile role')
    .populate('confirmedBy', 'name email mobile role');

  if (!returnNote) {
    const err = new Error(`Return Note not found with ID '${id}'.`);
    err.statusCode = 404;
    throw err;
  }

  return returnNote;
};

/**
 * List Return Notes with filtering, pagination, and dataScope
 */
const getReturns = async (query = {}, scopeFilter = {}) => {
  const {
    returnType,
    customerId,
    vendorId,
    invoiceId,
    challanId,
    productId,
    returnStatus,
    from,
    to,
    search,
    page = 1,
    limit = 25,
    sortBy = 'returnDate',
    sortOrder = 'desc'
  } = query;

  const filter = { isActive: true, ...scopeFilter };

  if (returnType) {
    filter.returnType = returnType.toUpperCase();
  }

  if (customerId) {
    filter.customer = customerId;
  }

  if (vendorId) {
    filter.vendor = vendorId;
  }

  if (invoiceId) {
    filter.invoice = invoiceId;
  }

  if (challanId) {
    filter.challan = challanId;
  }

  if (productId) {
    filter.product = productId;
  }

  if (returnStatus) {
    filter.returnStatus = returnStatus.toUpperCase();
  }

  if (from || to) {
    filter.returnDate = {};
    if (from) filter.returnDate.$gte = new Date(from);
    if (to) filter.returnDate.$lte = new Date(to);
  }

  if (search) {
    filter.$or = [
      { returnNoteNumber: { $regex: search, $options: 'i' } },
      { productNameSnapshot: { $regex: search, $options: 'i' } },
      { skuCodeSnapshot: { $regex: search, $options: 'i' } },
      { returnReason: { $regex: search, $options: 'i' } },
      { purchaseReferenceNote: { $regex: search, $options: 'i' } }
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [returns, total] = await Promise.all([
    ReturnNote.find(filter)
      .populate('vendor', 'vendorName contactPerson mobile')
      .populate('customer', 'customerName mobile city')
      .populate('invoice', 'invoiceNumber status')
      .populate('challan', 'challanNumber status')
      .populate('product', 'productName companySkuCode')
      .populate('unit', 'unitCode')
      .populate('createdBy', 'name')
      .populate('confirmedBy', 'name')
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ReturnNote.countDocuments(filter)
  ]);

  return {
    returns,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum)
    }
  };
};

/**
 * Update Return Note (Non-stock fields if CONFIRMED, all if DRAFT)
 */
const updateReturn = async (id, updateData, user, scopeFilter = {}) => {
  const returnNote = await getReturnById(id, scopeFilter);

  if (returnNote.returnStatus === 'CANCELLED') {
    const err = new Error('Cannot update a cancelled Return Note.');
    err.statusCode = 400;
    throw err;
  }

  // If CONFIRMED, quantity and product are strictly immutable
  if (returnNote.returnStatus === 'CONFIRMED') {
    if (updateData.quantity !== undefined || updateData.product !== undefined) {
      const err = new Error('Product and Quantity are permanently immutable on a CONFIRMED Return Note.');
      err.statusCode = 400;
      throw err;
    }

    if (updateData.returnReason) returnNote.returnReason = updateData.returnReason.trim();
    if (updateData.remarks !== undefined) returnNote.remarks = updateData.remarks ? updateData.remarks.trim() : null;
    returnNote.updatedBy = user._id;

    await returnNote.save();
    return await getReturnById(returnNote._id);
  }

  // If DRAFT, allow editing details
  if (updateData.productId) {
    const product = await Product.findOne({ _id: updateData.productId, isActive: true }).populate('unit');
    if (!product) {
      const err = new Error(`Product not found with ID '${updateData.productId}'.`);
      err.statusCode = 404;
      throw err;
    }
    returnNote.product = product._id;
    returnNote.productNameSnapshot = product.productName;
    returnNote.skuCodeSnapshot = product.companySkuCode || null;
    returnNote.unit = product.unit?._id || product.unit;
  }

  if (updateData.quantity !== undefined) {
    const qty = Number(updateData.quantity);
    if (!qty || qty <= 0) {
      const err = new Error('Return quantity must be greater than 0.');
      err.statusCode = 400;
      throw err;
    }
    returnNote.quantity = qty;
  }

  if (updateData.vendorId && returnNote.returnType === 'PURCHASE_RETURN') {
    const vendor = await Vendor.findOne({ _id: updateData.vendorId, isActive: true });
    if (!vendor) {
      const err = new Error(`Vendor not found with ID '${updateData.vendorId}'.`);
      err.statusCode = 404;
      throw err;
    }
    returnNote.vendor = vendor._id;
  }

  if (updateData.customerId && returnNote.returnType === 'SALES_RETURN') {
    const customer = await Customer.findOne({ _id: updateData.customerId, isActive: true });
    if (!customer) {
      const err = new Error(`Customer not found with ID '${updateData.customerId}'.`);
      err.statusCode = 404;
      throw err;
    }
    returnNote.customer = customer._id;
  }

  if (updateData.invoiceId !== undefined && returnNote.returnType === 'SALES_RETURN') {
    if (updateData.invoiceId) {
      const inv = await Invoice.findOne({ _id: updateData.invoiceId, isActive: true });
      if (!inv) {
        const err = new Error(`Invoice not found with ID '${updateData.invoiceId}'.`);
        err.statusCode = 400;
        throw err;
      }
      returnNote.invoice = inv._id;
    } else {
      returnNote.invoice = null;
    }
  }

  if (updateData.challanId !== undefined && returnNote.returnType === 'SALES_RETURN') {
    if (updateData.challanId) {
      const ch = await Challan.findOne({ _id: updateData.challanId, isActive: true });
      if (!ch) {
        const err = new Error(`Challan not found with ID '${updateData.challanId}'.`);
        err.statusCode = 400;
        throw err;
      }
      returnNote.challan = ch._id;
    } else {
      returnNote.challan = null;
    }
  }

  if (updateData.purchaseReferenceNote !== undefined && returnNote.returnType === 'PURCHASE_RETURN') {
    returnNote.purchaseReferenceNote = updateData.purchaseReferenceNote ? updateData.purchaseReferenceNote.trim() : null;
  }

  if (updateData.returnReason) returnNote.returnReason = updateData.returnReason.trim();
  if (updateData.remarks !== undefined) returnNote.remarks = updateData.remarks ? updateData.remarks.trim() : null;
  returnNote.updatedBy = user._id;

  await returnNote.save();
  return await getReturnById(returnNote._id);
};

/**
 * Cancel a Return Note (Only permitted while status is DRAFT)
 */
const cancelReturn = async (id, user, scopeFilter = {}) => {
  const returnNote = await getReturnById(id, scopeFilter);

  if (returnNote.returnStatus === 'CONFIRMED') {
    const err = new Error(
      'Cannot cancel a CONFIRMED Return Note. Stock movement has already been posted. Create an offsetting return entry to adjust inventory.'
    );
    err.statusCode = 400;
    throw err;
  }

  if (returnNote.returnStatus === 'CANCELLED') {
    const err = new Error('Return Note is already cancelled.');
    err.statusCode = 400;
    throw err;
  }

  returnNote.returnStatus = 'CANCELLED';
  returnNote.updatedBy = user._id;
  await returnNote.save();

  return await getReturnById(returnNote._id);
};

/**
 * Confirm a Return Note (The stock-triggering action)
 * - PURCHASE_RETURN: deducts stock via stockService.deductStock()
 * - SALES_RETURN: adds stock via stockService.addStock()
 * Gated by RETURN_NOTE:approve
 */
const confirmReturn = async (id, user, options = {}, scopeFilter = {}) => {
  const returnNote = await getReturnById(id, scopeFilter);

  if (returnNote.returnStatus === 'CONFIRMED') {
    const err = new Error(`Return Note '${returnNote.returnNoteNumber}' is already confirmed.`);
    err.statusCode = 400;
    throw err;
  }

  if (returnNote.returnStatus === 'CANCELLED') {
    const err = new Error(`Cannot confirm cancelled Return Note '${returnNote.returnNoteNumber}'.`);
    err.statusCode = 400;
    throw err;
  }

  // Trigger real Stock Movement through Module 8 stockService
  if (returnNote.returnType === 'PURCHASE_RETURN') {
    await stockService.deductStock(
      returnNote.product._id || returnNote.product,
      returnNote.quantity,
      'PURCHASE_RETURN',
      'RETURN_NOTE',
      returnNote._id,
      {
        referenceDocNote: returnNote.returnNoteNumber,
        postedBy: user._id,
        remarks: returnNote.returnReason,
        allowNegative: options.allowNegative || false
      }
    );
  } else if (returnNote.returnType === 'SALES_RETURN') {
    await stockService.addStock(
      returnNote.product._id || returnNote.product,
      returnNote.quantity,
      'SALES_RETURN',
      'RETURN_NOTE',
      returnNote._id,
      {
        referenceDocNote: returnNote.returnNoteNumber,
        postedBy: user._id,
        remarks: returnNote.returnReason
      }
    );
  }

  returnNote.returnStatus = 'CONFIRMED';
  returnNote.confirmedAt = new Date();
  returnNote.confirmedBy = user._id;
  returnNote.updatedBy = user._id;

  await returnNote.save();

  // Module 13 Integration: Auto-post CREDIT entry to Customer Ledger for Sales Return
  if (returnNote.returnType === 'SALES_RETURN' && returnNote.customer) {
    try {
      const ledgerService = require('./ledger.service');
      
      // Calculate return value based on invoice line item or product price
      let returnAmount = 0;
      if (returnNote.invoice && returnNote.invoice.items) {
        const matchingItem = returnNote.invoice.items.find(
          (it) => String(it.product) === String(returnNote.product._id || returnNote.product)
        );
        if (matchingItem && matchingItem.quantity > 0) {
          const itemUnitPrice = (matchingItem.netAmount + matchingItem.gstAmount) / matchingItem.quantity;
          returnAmount = Math.round(itemUnitPrice * returnNote.quantity * 100) / 100;
        }
      }
      
      if (!returnAmount || returnAmount <= 0) {
        const prodPrice = returnNote.product?.salePrice || returnNote.product?.mrp || 0;
        returnAmount = Math.round(prodPrice * returnNote.quantity * 100) / 100;
      }
      
      if (returnAmount <= 0) {
        returnAmount = returnNote.quantity; // Fallback unit value
      }

      await ledgerService.postEntry({
        customerId: returnNote.customer._id || returnNote.customer,
        entryDate: returnNote.returnDate || new Date(),
        particular: `Sales Return #${returnNote.returnNoteNumber}`,
        entryType: 'CREDIT',
        amount: returnAmount,
        sourceType: 'SALES_RETURN',
        sourceId: returnNote._id,
        remarks: returnNote.returnReason || null,
        postedBy: user._id
      });
    } catch (ledgerErr) {
      console.warn('Notice: Ledger posting on sales return confirmation:', ledgerErr.message);
    }
  }

  return await getReturnById(returnNote._id);
};

/**
 * Export Return Notes to Excel (.xlsx)
 */
const exportReturnsToExcel = async (query = {}, scopeFilter = {}) => {
  const { returnType } = query;
  const exportData = await getReturns({ ...query, limit: 10000 }, scopeFilter);
  const workbook = XLSX.utils.book_new();

  const exportRows = (exportData.returns || []).map((r, idx) => ({
    'Sr. No.': idx + 1,
    'Return Note #': r.returnNoteNumber,
    'Type': r.returnType === 'PURCHASE_RETURN' ? 'Purchase Return' : 'Sales Return',
    'Date': r.returnDate ? new Date(r.returnDate).toLocaleDateString('en-IN') : '',
    'Party': r.returnType === 'PURCHASE_RETURN' ? (r.vendor?.vendorName || 'N/A') : (r.customer?.customerName || 'N/A'),
    'Product Name': r.productNameSnapshot || r.product?.productName || 'N/A',
    'SKU Code': r.skuCodeSnapshot || r.product?.companySkuCode || 'N/A',
    'Quantity': r.quantity,
    'Unit': r.unit?.unitCode || 'PCS',
    'Status': r.returnStatus,
    'Reference Doc': r.returnType === 'PURCHASE_RETURN' ? (r.purchaseReferenceNote || '') : (r.invoice?.invoiceNumber || r.challan?.challanNumber || ''),
    'Return Reason': r.returnReason || '',
    'Remarks': r.remarks || '',
    'Confirmed By': r.confirmedBy?.name || ''
  }));

  const sheetName = returnType ? (returnType === 'PURCHASE_RETURN' ? 'Purchase Returns' : 'Sales Returns') : 'Return Notes';
  const ws = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, ws, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * =========================================================================
 * FORWARD-REFERENCE SERVICES FOR DOWNSTREAM MODULES (Module 4 & Module 13)
 * =========================================================================
 */

/**
 * Consumed by Module 4: Customer 360° History
 * Returns sales returns for a given customer
 */
const getByCustomer = async (customerId) => {
  try {
    const returns = await ReturnNote.find({
      customer: customerId,
      returnType: 'SALES_RETURN',
      isActive: true
    })
      .populate('invoice', 'invoiceNumber')
      .populate('challan', 'challanNumber')
      .populate('unit', 'unitCode')
      .sort({ returnDate: -1, createdAt: -1 })
      .lean();

    return returns.map((r) => ({
      _id: r._id,
      returnNoteNumber: r.returnNoteNumber,
      returnDate: r.returnDate,
      productName: r.productNameSnapshot,
      skuCode: r.skuCodeSnapshot || 'N/A',
      quantity: r.quantity,
      unit: r.unit?.unitCode || 'PCS',
      invoiceNumber: r.invoice?.invoiceNumber || null,
      challanNumber: r.challan?.challanNumber || null,
      returnReason: r.returnReason,
      returnStatus: r.returnStatus
    }));
  } catch (err) {
    console.warn('Error in returnService.getByCustomer:', err.message);
    return [];
  }
};

/**
 * Consumed by Module 13: Customer Ledger Credit-Note computation
 * Computes total monetary value of CONFIRMED Sales Returns against a specific Invoice
 */
const getSalesReturnAmount = async (invoiceId) => {
  try {
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return 0;

    const confirmedReturns = await ReturnNote.find({
      invoice: invoiceId,
      returnType: 'SALES_RETURN',
      returnStatus: 'CONFIRMED',
      isActive: true
    });

    let totalReturnAmount = 0;

    for (const ret of confirmedReturns) {
      // Look up line item in invoice to resolve rateSnapshot and tax
      const matchedItem = (invoice.items || []).find(
        (item) => String(item.product) === String(ret.product) || item.skuCodeSnapshot === ret.skuCodeSnapshot
      );

      if (matchedItem) {
        const rate = Number(matchedItem.rateSnapshot) || 0;
        const discountPct = Number(matchedItem.discountPct) || 0;
        const gstPct = Number(matchedItem.gstPctSnapshot !== undefined ? matchedItem.gstPctSnapshot : matchedItem.gstPct) || 0;

        const effectiveRate = rate * (1 - discountPct / 100);
        const lineNet = ret.quantity * effectiveRate;
        const lineGst = lineNet * (gstPct / 100);
        totalReturnAmount += (lineNet + lineGst);
      }
    }

    return Math.round(totalReturnAmount * 100) / 100;
  } catch (err) {
    console.warn('Error in returnService.getSalesReturnAmount:', err.message);
    return 0;
  }
};

module.exports = {
  createPurchaseReturn,
  createSalesReturn,
  getReturnById,
  getReturns,
  updateReturn,
  cancelReturn,
  confirmReturn,
  exportReturnsToExcel,
  getByCustomer,
  getSalesReturnAmount
};
