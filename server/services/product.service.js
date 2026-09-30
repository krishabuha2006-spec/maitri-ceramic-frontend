const Product = require('../models/Product');
const { validateProductData } = require('./productValidation.service');

/**
 * Adjust current stock for a product (Called internally by Module 8 - Stock Management)
 *
 * @param {String|ObjectId} productId
 * @param {Number} delta - Positive for stock IN, negative for stock OUT
 * @param {Object} [options] - { session, allowNegative }
 * @returns {Promise<Product>}
 */
const adjustStock = async (productId, delta, options = {}) => {
  const { session = null, allowNegative = false } = options;

  const query = Product.findById(productId);
  if (session) query.session(session);
  const product = await query;

  if (!product) {
    const error = new Error(`Product not found with ID '${productId}'.`);
    error.statusCode = 404;
    throw error;
  }

  const newStock = (Number(product.currentStock) || 0) + Number(delta);
  if (newStock < 0 && !allowNegative) {
    const error = new Error(
      `Insufficient stock for '${product.productName}'. Current stock is ${product.currentStock}, cannot deduct ${Math.abs(
        delta
      )}.`
    );
    error.statusCode = 400;
    throw error;
  }

  product.currentStock = newStock;
  if (session) {
    await product.save({ session });
  } else {
    await product.save();
  }

  return product;
};

/**
 * High-performance bulk upsert for Module 3 (Product Import)
 *
 * @param {Array<Object>} productList
 * @param {String|ObjectId} userId
 * @returns {Promise<{ inserted: number, updated: number, errors: Array<{ row: number, errors: string[] }> }>}
 */
const bulkUpsert = async (productList, userId) => {
  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (let i = 0; i < productList.length; i++) {
    const item = productList[i];
    const validation = await validateProductData(item);

    if (!validation.isValid) {
      errors.push({ row: i + 1, errors: validation.errors });
      continue;
    }

    try {
      if (item.companySkuCode && !item.isSkuLess) {
        const existing = await Product.findOne({ companySkuCode: item.companySkuCode });
        if (existing) {
          // Update existing
          Object.assign(existing, item, { updatedBy: userId });
          delete existing.currentStock; // Protect currentStock
          await existing.save();
          updated++;
        } else {
          // Insert new
          await Product.create({
            ...item,
            currentStock: item.openingStock || 0,
            createdBy: userId
          });
          inserted++;
        }
      } else {
        // SKU-less product insert
        await Product.create({
          ...item,
          currentStock: item.openingStock || 0,
          createdBy: userId
        });
        inserted++;
      }
    } catch (err) {
      errors.push({ row: i + 1, errors: [err.message] });
    }
  }

  return {
    inserted,
    updated,
    errors
  };
};

/**
 * Forward reference service to fetch quotation usage for a product.
 * Returns empty array [] gracefully if Module 5 (Quotation) is not yet active.
 *
 * @param {String|ObjectId} productId
 * @returns {Promise<Array>}
 */
const getQuotationUsage = async (productId, user = null) => {
  try {
    const productQuotationTrackingService = require('./productQuotationTracking.service');
    return await productQuotationTrackingService.getUsageForProduct(productId, user);
  } catch (err) {
    console.warn('Quotation usage lookup returned empty fallback:', err.message);
    return { summary: {}, usage: [] };
  }
};

/**
 * Delete Product and Cascade Purge all related data
 *
 * @param {String|ObjectId} productId
 * @returns {Promise<Object>} Summary of deleted and affected entities
 */
const deleteProductWithCascade = async (productId) => {
  const mongoose = require('mongoose');
  if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
    return {
      success: true,
      message: `Invalid product ID '${productId}'.`,
      productId,
      deletedStockEntries: 0,
      deletedReturnNotes: 0,
      affectedQuotations: 0,
      affectedConfirmations: 0,
      affectedChallans: 0,
      affectedInvoices: 0
    };
  }

  const product = await Product.findById(productId);
  if (!product) {
    return {
      success: true,
      message: `Product with ID '${productId}' is already deleted or not found.`,
      productId,
      deletedStockEntries: 0,
      deletedReturnNotes: 0,
      affectedQuotations: 0,
      affectedConfirmations: 0,
      affectedChallans: 0,
      affectedInvoices: 0
    };
  }

  // 1. Delete Stock Ledger Entries
  let deletedStockEntries = 0;
  try {
    const StockLedgerEntry = require('../models/StockLedgerEntry');
    const res = await StockLedgerEntry.deleteMany({ product: productId });
    deletedStockEntries = res.deletedCount || 0;
  } catch (e) {}

  // 2. Delete Return Notes referencing this product
  let deletedReturnNotes = 0;
  try {
    const ReturnNote = require('../models/ReturnNote');
    const res = await ReturnNote.deleteMany({ product: productId });
    deletedReturnNotes = res.deletedCount || 0;
  } catch (e) {}

  // 3. Clean up Quotation items
  let affectedQuotations = 0;
  try {
    const Quotation = require('../models/Quotation');
    const res = await Quotation.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } }
    );
    affectedQuotations = res.modifiedCount || 0;
  } catch (e) {}

  // 4. Clean up Confirmation items
  let affectedConfirmations = 0;
  try {
    const QuotationConfirmation = require('../models/QuotationConfirmation');
    const res = await QuotationConfirmation.updateMany(
      { 'confirmedItems.product': productId },
      { $pull: { confirmedItems: { product: productId } } }
    );
    affectedConfirmations = res.modifiedCount || 0;
  } catch (e) {}

  // 5. Clean up Challan items
  let affectedChallans = 0;
  try {
    const Challan = require('../models/Challan');
    const res = await Challan.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } }
    );
    affectedChallans = res.modifiedCount || 0;
  } catch (e) {}

  // 6. Clean up Invoice items
  let affectedInvoices = 0;
  try {
    const Invoice = require('../models/Invoice');
    const res = await Invoice.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } }
    );
    affectedInvoices = res.modifiedCount || 0;
  } catch (e) {}

  // 7. Delete the Product document
  await Product.deleteOne({ _id: productId });

  return {
    productId: product._id,
    productName: product.productName,
    skuCode: product.companySkuCode || product.vendorSkuCode || 'N/A',
    deletedProduct: true,
    deletedStockLedgerEntries: deletedStockEntries,
    deletedReturnNotes: deletedReturnNotes,
    affectedQuotations,
    affectedConfirmations,
    affectedChallans,
    affectedInvoices
  };
};

/**
 * Bulk Delete Products by Array of IDs with Cascade
 *
 * @param {Array<String|ObjectId>} productIds
 * @returns {Promise<Object>}
 */
const bulkDeleteProductsWithCascade = async (productIds = []) => {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { deletedCount: 0, message: 'No product IDs provided.' };
  }

  const StockLedgerEntry = require('../models/StockLedgerEntry').catch ? null : require('../models/StockLedgerEntry');
  const ReturnNote = require('../models/ReturnNote').catch ? null : require('../models/ReturnNote');
  const Quotation = require('../models/Quotation').catch ? null : require('../models/Quotation');
  const QuotationConfirmation = require('../models/QuotationConfirmation').catch ? null : require('../models/QuotationConfirmation');
  const Challan = require('../models/Challan').catch ? null : require('../models/Challan');
  const Invoice = require('../models/Invoice').catch ? null : require('../models/Invoice');

  let deletedStockEntries = 0;
  let deletedReturnNotes = 0;
  let affectedQuotations = 0;
  let affectedConfirmations = 0;
  let affectedChallans = 0;
  let affectedInvoices = 0;

  try {
    if (StockLedgerEntry) {
      const res = await StockLedgerEntry.deleteMany({ product: { $in: productIds } });
      deletedStockEntries = res.deletedCount || 0;
    }
  } catch (e) {}

  try {
    if (ReturnNote) {
      const res = await ReturnNote.deleteMany({ product: { $in: productIds } });
      deletedReturnNotes = res.deletedCount || 0;
    }
  } catch (e) {}

  try {
    if (Quotation) {
      const res = await Quotation.updateMany(
        { 'items.product': { $in: productIds } },
        { $pull: { items: { product: { $in: productIds } } } }
      );
      affectedQuotations = res.modifiedCount || 0;
    }
  } catch (e) {}

  try {
    if (QuotationConfirmation) {
      const res = await QuotationConfirmation.updateMany(
        { 'confirmedItems.product': { $in: productIds } },
        { $pull: { confirmedItems: { product: { $in: productIds } } } }
      );
      affectedConfirmations = res.modifiedCount || 0;
    }
  } catch (e) {}

  try {
    if (Challan) {
      const res = await Challan.updateMany(
        { 'items.product': { $in: productIds } },
        { $pull: { items: { product: { $in: productIds } } } }
      );
      affectedChallans = res.modifiedCount || 0;
    }
  } catch (e) {}

  try {
    if (Invoice) {
      const res = await Invoice.updateMany(
        { 'items.product': { $in: productIds } },
        { $pull: { items: { product: { $in: productIds } } } }
      );
      affectedInvoices = res.modifiedCount || 0;
    }
  } catch (e) {}

  const deleteResult = await Product.deleteMany({ _id: { $in: productIds } });

  return {
    success: true,
    deletedCount: deleteResult.deletedCount || 0,
    deletedStockLedgerEntries: deletedStockEntries,
    deletedReturnNotes: deletedReturnNotes,
    affectedQuotations,
    affectedConfirmations,
    affectedChallans,
    affectedInvoices
  };
};

/**
 * Delete All Products with Cascade Purge
 *
 * @returns {Promise<Object>}
 */
const deleteAllProductsWithCascade = async () => {
  const allProductDocs = await Product.find({}, '_id');
  const allIds = allProductDocs.map(p => p._id);
  
  if (allIds.length === 0) {
    return { success: true, deletedCount: 0, message: 'No products in database to delete.' };
  }

  return await bulkDeleteProductsWithCascade(allIds);
};

module.exports = {
  adjustStock,
  bulkUpsert,
  getQuotationUsage,
  deleteProductWithCascade,
  bulkDeleteProductsWithCascade,
  deleteAllProductsWithCascade
};
