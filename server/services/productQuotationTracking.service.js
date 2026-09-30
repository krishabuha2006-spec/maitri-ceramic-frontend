const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Product = require('../models/Product');
const Quotation = require('../models/Quotation');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const Customer = require('../models/Customer');
const ProductQuotationSummaryCache = require('../models/ProductQuotationSummaryCache');
const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');

/**
 * Helper to resolve Quotation dataScope filter for the requesting user
 *
 * @param {Object} requestingUser
 * @returns {Promise<Object>} Mongoose filter object
 */
const resolveQuotationScopeFilter = async (requestingUser) => {
  if (!requestingUser) return {};

  // Super Admin bypass
  if (requestingUser.role && requestingUser.role.isSystemRole) {
    return {};
  }

  try {
    const quotationModule = await SystemModule.findOne({
      moduleKey: 'QUOTATION',
      isActive: true
    });

    if (!quotationModule) return {};

    const permission = await UserPermission.findOne({
      user: requestingUser._id,
      module: quotationModule._id,
      isActive: true
    });

    if (!permission) return {};

    if (permission.dataScope === 'OWN') {
      return {
        $or: [
          { createdBy: requestingUser._id },
          { salesperson: requestingUser._id }
        ]
      };
    } else if (permission.dataScope === 'TEAM') {
      return {
        $or: [
          { createdBy: requestingUser._id },
          { salesperson: requestingUser._id }
        ]
      };
    }

    return {};
  } catch (err) {
    console.warn('Error resolving quotation scope filter:', err.message);
    return {};
  }
};

/**
 * Core Aggregation Service: Get Quotation Usage for a Product
 *
 * @param {String|ObjectId} productId
 * @param {Object} requestingUser
 * @param {Object} options - { activeOnly: Boolean }
 * @returns {Promise<Object>} Full shape: { product, summary, usage }
 */
const getUsageForProduct = async (productId, requestingUser, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const err = new Error(`Invalid Product ID '${productId}'.`);
    err.statusCode = 400;
    throw err;
  }

  const product = await Product.findById(productId)
    .populate('company', 'companyName companyType')
    .populate('unit', 'unitName unitCode')
    .populate('productGroup', 'groupName');

  if (!product) {
    const err = new Error(`Product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Build Quotation Query
  const scopeFilter = await resolveQuotationScopeFilter(requestingUser);
  const quotationFilter = {
    'items.product': product._id,
    ...scopeFilter
  };

  if (options.activeOnly === 'true' || options.activeOnly === true) {
    quotationFilter.isActive = true;
    quotationFilter.status = { $nin: ['CANCELLED', 'REJECTED'] };
  }

  // 2. Fetch Matching Quotations
  const quotations = await Quotation.find(quotationFilter)
    .populate('customer', 'customerName mobile city state customerType')
    .populate('salesperson', 'name mobile')
    .sort({ quotationDate: -1, createdAt: -1 });

  // 3. Cross-reference QuotationConfirmation for confirmed quantity
  const quotationIds = quotations.map((q) => q._id);
  const confirmations = await QuotationConfirmation.find({
    quotation: { $in: quotationIds }
  });

  const confirmationMap = new Map();
  for (const conf of confirmations) {
    confirmationMap.set(String(conf.quotation), conf);
  }

  // 4. Assemble Usage Rows
  const usage = [];

  for (const q of quotations) {
    const matchingItems = (q.items || []).filter(
      (item) => item.product && String(item.product) === String(product._id)
    );

    const conf = confirmationMap.get(String(q._id));

    for (const item of matchingItems) {
      let confirmedQuantity = null;
      let actualTransactionValue = null;

      if (conf) {
        // Confirmation document exists
        const matchedConfirmedItem = (conf.confirmedItems || []).find(
          (ci) =>
            (ci.product && String(ci.product) === String(product._id)) ||
            (ci.originalQuotationItemId && String(ci.originalQuotationItemId) === String(item._id))
        );

        if (matchedConfirmedItem) {
          confirmedQuantity =
            typeof matchedConfirmedItem.confirmedQuantity === 'number'
              ? matchedConfirmedItem.confirmedQuantity
              : 0;
          const unitRate =
            matchedConfirmedItem.unitPriceSnapshot ||
            item.quotedRate ||
            item.mrpSnapshot ||
            product.salePrice ||
            0;
          actualTransactionValue =
            matchedConfirmedItem.confirmedAmount !== undefined
              ? matchedConfirmedItem.confirmedAmount
              : Math.round(confirmedQuantity * unitRate * 100) / 100;
        } else {
          // Confirmation exists but item was dropped/not confirmed
          confirmedQuantity = 0;
          actualTransactionValue = 0;
        }
      }

      const quotedAmt =
        item.totalAmount !== undefined
          ? item.totalAmount
          : (item.netAmount || 0) + (item.taxAmount || 0);

      usage.push({
        quotationId: q._id,
        quotationNumber: q.quotationNumber,
        customerId: q.customer?._id || null,
        customerName: q.customer?.customerName || 'Unknown Customer',
        customerMobile: q.customer?.mobile || null,
        quotationDate: q.quotationDate || q.createdAt,
        quotedQuantity: item.quantity || 0,
        quotedAmount: Math.round(quotedAmt * 100) / 100,
        status: q.status,
        confirmedQuantity,
        actualTransactionValue:
          actualTransactionValue !== null
            ? Math.round(actualTransactionValue * 100) / 100
            : null,
        salesperson: q.salesperson
          ? { _id: q.salesperson._id, name: q.salesperson.name }
          : null
      });
    }
  }

  // 5. Compute Summary Totals
  const totalQuotationCount = usage.length;
  const totalQuotedQuantity = usage.reduce(
    (sum, r) => sum + (Number(r.quotedQuantity) || 0),
    0
  );
  const totalQuotedValue = usage.reduce(
    (sum, r) => sum + (Number(r.quotedAmount) || 0),
    0
  );
  const totalConfirmedQuantity = usage.reduce((sum, r) => {
    return r.confirmedQuantity !== null ? sum + Number(r.confirmedQuantity) : sum;
  }, 0);
  const totalConfirmedValue = usage.reduce((sum, r) => {
    return r.actualTransactionValue !== null
      ? sum + Number(r.actualTransactionValue)
      : sum;
  }, 0);

  return {
    product: {
      _id: product._id,
      productName: product.productName,
      companySkuCode: product.companySkuCode,
      vendorSkuCode: product.vendorSkuCode,
      unit: product.unit,
      mrp: product.mrp,
      salePrice: product.salePrice
    },
    summary: {
      totalQuotationCount,
      totalQuotedQuantity,
      totalQuotedValue: Math.round(totalQuotedValue * 100) / 100,
      totalConfirmedQuantity,
      totalConfirmedValue: Math.round(totalConfirmedValue * 100) / 100
    },
    usage
  };
};

/**
 * Get Ranked Most-Quoted Products
 *
 * @param {Object} query - { limit, from, to, activeOnly }
 * @param {Object} requestingUser
 * @returns {Promise<Array>}
 */
const getMostQuotedProducts = async (query = {}, requestingUser) => {
  const scopeFilter = await resolveQuotationScopeFilter(requestingUser);
  const matchFilter = { ...scopeFilter };

  if (query.activeOnly === 'true' || query.activeOnly === true) {
    matchFilter.isActive = true;
    matchFilter.status = { $ne: 'CANCELLED' };
  }

  if (query.from || query.to) {
    matchFilter.quotationDate = {};
    if (query.from) matchFilter.quotationDate.$gte = new Date(query.from);
    if (query.to) matchFilter.quotationDate.$lte = new Date(query.to);
  }

  const limitNum = Math.min(parseInt(query.limit, 10) || 10, 100);

  const pipeline = [
    { $match: matchFilter },
    { $unwind: '$items' },
    { $match: { 'items.product': { $ne: null } } },
    {
      $group: {
        _id: '$items.product',
        quotationIds: { $addToSet: '$_id' },
        totalQuotedQuantity: { $sum: '$items.quantity' },
        totalQuotedValue: {
          $sum: {
            $ifNull: [
              '$items.totalAmount',
              { $add: ['$items.netAmount', { $ifNull: ['$items.taxAmount', 0] }] }
            ]
          }
        }
      }
    },
    {
      $project: {
        product: '$_id',
        quotationCount: { $size: '$quotationIds' },
        totalQuotedQuantity: 1,
        totalQuotedValue: { $round: ['$totalQuotedValue', 2] }
      }
    },
    { $sort: { quotationCount: -1, totalQuotedValue: -1 } },
    { $limit: limitNum },
    {
      $lookup: {
        from: 'products',
        localField: 'product',
        foreignField: '_id',
        as: 'productDetails'
      }
    },
    { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'unitmasters',
        localField: 'productDetails.unit',
        foreignField: '_id',
        as: 'unitDetails'
      }
    },
    { $unwind: { path: '$unitDetails', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        productId: '$product',
        productName: '$productDetails.productName',
        companySkuCode: '$productDetails.companySkuCode',
        unit: '$unitDetails.unitCode',
        mrp: '$productDetails.mrp',
        salePrice: '$productDetails.salePrice',
        quotationCount: 1,
        totalQuotedQuantity: 1,
        totalQuotedValue: 1
      }
    }
  ];

  return await Quotation.aggregate(pipeline);
};

/**
 * Get Distinct Customers Quoted a Specific Product
 *
 * @param {String|ObjectId} productId
 * @param {Object} requestingUser
 * @returns {Promise<Array>}
 */
const getCustomersForProduct = async (productId, requestingUser) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const err = new Error(`Invalid Product ID '${productId}'.`);
    err.statusCode = 400;
    throw err;
  }

  const product = await Product.findById(productId);
  if (!product) {
    const err = new Error(`Product not found with ID '${productId}'.`);
    err.statusCode = 404;
    throw err;
  }

  const scopeFilter = await resolveQuotationScopeFilter(requestingUser);
  const quotations = await Quotation.find({
    'items.product': product._id,
    ...scopeFilter
  }).populate('customer', 'customerName mobile city state gstNumber customerType');

  const customerMap = new Map();

  for (const q of quotations) {
    if (!q.customer) continue;
    const cid = String(q.customer._id);

    const matchingItems = (q.items || []).filter(
      (i) => i.product && String(i.product) === String(product._id)
    );

    const quotedQty = matchingItems.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0),
      0
    );
    const quotedVal = matchingItems.reduce(
      (sum, i) => sum + (Number(i.totalAmount) || 0),
      0
    );

    if (customerMap.has(cid)) {
      const existing = customerMap.get(cid);
      existing.quotationCount += 1;
      existing.totalQuotedQuantity += quotedQty;
      existing.totalQuotedValue += quotedVal;
      if (new Date(q.quotationDate || q.createdAt) > new Date(existing.latestQuotationDate)) {
        existing.latestQuotationDate = q.quotationDate || q.createdAt;
      }
    } else {
      customerMap.set(cid, {
        customerId: q.customer._id,
        customerName: q.customer.customerName,
        mobile: q.customer.mobile,
        city: q.customer.city || '-',
        state: q.customer.state || '-',
        customerType: q.customer.customerType || 'RETAIL',
        gstNumber: q.customer.gstNumber || null,
        quotationCount: 1,
        totalQuotedQuantity: quotedQty,
        totalQuotedValue: Math.round(quotedVal * 100) / 100,
        latestQuotationDate: q.quotationDate || q.createdAt
      });
    }
  }

  return Array.from(customerMap.values()).sort(
    (a, b) => b.totalQuotedValue - a.totalQuotedValue
  );
};

/**
 * Recompute and Update Summary Cache for a Product
 *
 * @param {String|ObjectId} productId
 * @returns {Promise<Object>}
 */
const recomputeSummaryCache = async (productId) => {
  // Recompute live summary without dataScope restrictions
  const liveData = await getUsageForProduct(productId, null);

  const cache = await ProductQuotationSummaryCache.findOneAndUpdate(
    { product: productId },
    {
      $set: {
        totalQuotationCount: liveData.summary.totalQuotationCount,
        totalQuotedQuantity: liveData.summary.totalQuotedQuantity,
        totalQuotedValue: liveData.summary.totalQuotedValue,
        totalConfirmedQuantity: liveData.summary.totalConfirmedQuantity,
        totalConfirmedValue: liveData.summary.totalConfirmedValue,
        lastRecomputedAt: new Date()
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return cache;
};

/**
 * Export Product-Quotation Tracking Data to Excel (.xlsx)
 *
 * @param {Object} query - { productId, reportType: 'usage'|'most-quoted'|'customer-list' }
 * @param {Object} requestingUser
 * @returns {Promise<{ workbook: XLSX.WorkBook, filename: string }>}
 */
const exportProductTracking = async (query = {}, requestingUser) => {
  const { productId, reportType = 'usage' } = query;
  const workbook = XLSX.utils.book_new();

  if (reportType === 'usage') {
    if (!productId) {
      const err = new Error('Product ID is required for usage export.');
      err.statusCode = 400;
      throw err;
    }

    const data = await getUsageForProduct(productId, requestingUser);
    const rows = data.usage.map((r, idx) => ({
      'Sr. No.': idx + 1,
      'Quotation No.': r.quotationNumber,
      'Customer Name': r.customerName,
      'Date': r.quotationDate ? new Date(r.quotationDate).toLocaleDateString('en-IN') : '-',
      'Quoted Qty': r.quotedQuantity,
      'Quoted Amount (₹)': r.quotedAmount,
      'Status': r.status,
      'Confirmed Qty': r.confirmedQuantity !== null ? r.confirmedQuantity : '-',
      'Actual Value (₹)': r.actualTransactionValue !== null ? r.actualTransactionValue : '-'
    }));

    // Add Summary Row
    rows.push({
      'Sr. No.': '',
      'Quotation No.': 'TOTAL',
      'Customer Name': '',
      'Date': '',
      'Quoted Qty': data.summary.totalQuotedQuantity,
      'Quoted Amount (₹)': data.summary.totalQuotedValue,
      'Status': '',
      'Confirmed Qty': data.summary.totalConfirmedQuantity,
      'Actual Value (₹)': data.summary.totalConfirmedValue
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quotation Usage');

    return {
      workbook,
      filename: `Product_Usage_${(data.product.productName || 'Product').replace(/\s+/g, '_')}_${Date.now()}.xlsx`
    };
  } else if (reportType === 'most-quoted') {
    const list = await getMostQuotedProducts(query, requestingUser);
    const rows = list.map((item, idx) => ({
      'Rank': idx + 1,
      'SKU Code': item.companySkuCode,
      'Product Name': item.productName,
      'Unit': item.unit || '-',
      'Quotation Count': item.quotationCount,
      'Total Quoted Qty': item.totalQuotedQuantity,
      'Total Quoted Value (₹)': item.totalQuotedValue
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Most Quoted');

    return {
      workbook,
      filename: `Most_Quoted_Products_${Date.now()}.xlsx`
    };
  } else if (reportType === 'customer-list') {
    if (!productId) {
      const err = new Error('Product ID is required for customer list export.');
      err.statusCode = 400;
      throw err;
    }

    const list = await getCustomersForProduct(productId, requestingUser);
    const rows = list.map((item, idx) => ({
      'Sr. No.': idx + 1,
      'Customer Name': item.customerName,
      'Mobile': item.mobile || '-',
      'City': item.city || '-',
      'Customer Type': item.customerType,
      'Quotation Count': item.quotationCount,
      'Total Quoted Qty': item.totalQuotedQuantity,
      'Total Quoted Value (₹)': item.totalQuotedValue,
      'Latest Date': item.latestQuotationDate
        ? new Date(item.latestQuotationDate).toLocaleDateString('en-IN')
        : '-'
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Quoted Customers');

    return {
      workbook,
      filename: `Quoted_Customers_${Date.now()}.xlsx`
    };
  }

  const err = new Error(`Unsupported reportType '${reportType}'.`);
  err.statusCode = 400;
  throw err;
};

module.exports = {
  getUsageForProduct,
  getMostQuotedProducts,
  getCustomersForProduct,
  recomputeSummaryCache,
  exportProductTracking
};
