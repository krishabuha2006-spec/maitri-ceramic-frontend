const Product = require('../models/Product');

/**
 * Resolve product snapshots and strictly calculate amounts server-side
 *
 * @param {Array<Object>} rawItems - Array of item definitions from request body
 * @returns {Promise<{ resolvedItems: Array<Object>, totals: Object }>}
 */
const resolveAndCalculateLineItems = async (rawItems = []) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return {
      resolvedItems: [],
      totals: {
        totalGrossAmount: 0,
        totalDiscountAmount: 0,
        totalNetAmount: 0,
        totalGstAmount: 0,
        grandTotal: 0
      }
    };
  }

  const resolvedItems = [];
  let totalGrossAmount = 0;
  let totalDiscountAmount = 0;
  let totalNetAmount = 0;
  let totalGstAmount = 0;

  for (let i = 0; i < rawItems.length; i++) {
    const item = rawItems[i];
    const rowNum = i + 1;

    let productDoc = null;
    let productNameSnapshot = '';
    let skuCodeSnapshot = null;
    let imageSnapshot = null;
    let mrpSnapshot = 0;
    let gstPctSnapshot = 0;
    let isSkuLessItem = false;
    let productId = null;

    // Check if item references an existing Product from Module 2
    if (item.productId || item.product) {
      const pId = item.productId || item.product;
      productDoc = await Product.findById(pId);
      if (!productDoc) {
        throw new Error(`Line item #${rowNum}: Referenced product '${pId}' not found in Product Master.`);
      }

      productId = productDoc._id;
      isSkuLessItem = Boolean(productDoc.isSkuLess);
      // Rule 5: ALWAYS use companySkuCode, NEVER vendorSkuCode
      skuCodeSnapshot = productDoc.companySkuCode || null;
      productNameSnapshot = item.adHocName || item.productNameSnapshot || productDoc.productName;
      imageSnapshot = item.adHocImage || item.imageSnapshot || productDoc.productImage || null;
      mrpSnapshot = Number(item.adHocMrp !== undefined ? item.adHocMrp : (productDoc.mrp || productDoc.salePrice || 0));
      gstPctSnapshot = Number(item.adHocGstPct !== undefined ? item.adHocGstPct : (productDoc.gstPct || 0));
    } else {
      // SKU-less / Ad-hoc item without Product Master record
      const adHocName = item.adHocName || item.productNameSnapshot || item.productName;
      const adHocMrp = item.adHocMrp !== undefined ? item.adHocMrp : (item.mrpSnapshot !== undefined ? item.mrpSnapshot : item.mrp);

      if (!adHocName || !String(adHocName).trim()) {
        throw new Error(`Line item #${rowNum}: Requires either a valid productId or an adHocName for SKU-less items.`);
      }
      if (adHocMrp === undefined || adHocMrp === null || isNaN(Number(adHocMrp))) {
        throw new Error(`Line item #${rowNum}: Requires an adHocMrp / unit rate.`);
      }

      productId = null;
      isSkuLessItem = true;
      skuCodeSnapshot = null;
      productNameSnapshot = String(adHocName).trim();
      imageSnapshot = item.adHocImage || item.imageSnapshot || null;
      mrpSnapshot = Number(adHocMrp);
      gstPctSnapshot = Number(item.adHocGstPct !== undefined ? item.adHocGstPct : (item.gstPctSnapshot || 0));
    }

    const quantity = Number(item.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      throw new Error(`Line item #${rowNum}: Quantity must be a positive number greater than 0.`);
    }

    const discountPct = Number(item.discountPct) || 0;
    if (discountPct < 0 || discountPct > 100) {
      throw new Error(`Line item #${rowNum}: Discount percentage must be between 0% and 100%.`);
    }

    // Exact server calculation formulas
    const grossAmount = Math.round(mrpSnapshot * quantity * 100) / 100;
    const discountAmount = Math.round(grossAmount * (discountPct / 100) * 100) / 100;
    const netAmount = Math.round((grossAmount - discountAmount) * 100) / 100;
    const gstAmount = Math.round(netAmount * (gstPctSnapshot / 100) * 100) / 100;

    totalGrossAmount += grossAmount;
    totalDiscountAmount += discountAmount;
    totalNetAmount += netAmount;
    totalGstAmount += gstAmount;

    resolvedItems.push({
      product: productId,
      isSkuLessItem,
      skuCodeSnapshot,
      productNameSnapshot,
      imageSnapshot,
      area: item.area ? String(item.area).trim() : null,
      mrpSnapshot,
      quantity,
      gstPctSnapshot,
      discountPct,
      grossAmount,
      discountAmount,
      netAmount,
      gstAmount,
      remarks: item.remarks ? String(item.remarks).trim() : null
    });
  }

  // Round header totals to 2 decimal places
  totalGrossAmount = Math.round(totalGrossAmount * 100) / 100;
  totalDiscountAmount = Math.round(totalDiscountAmount * 100) / 100;
  totalNetAmount = Math.round(totalNetAmount * 100) / 100;
  totalGstAmount = Math.round(totalGstAmount * 100) / 100;
  const grandTotal = Math.round((totalNetAmount + totalGstAmount) * 100) / 100;

  return {
    resolvedItems,
    totals: {
      totalGrossAmount,
      totalDiscountAmount,
      totalNetAmount,
      totalGstAmount,
      grandTotal
    }
  };
};

module.exports = {
  resolveAndCalculateLineItems
};
