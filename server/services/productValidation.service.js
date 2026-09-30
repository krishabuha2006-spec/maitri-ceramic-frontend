const mongoose = require('mongoose');
const Product = require('../models/Product');
const UnitMaster = require('../models/UnitMaster');

/**
 * Shared Product Validation Service
 * Reused by Module 2 (Product Master) and Module 3 (Product Import)
 *
 * @param {Object} data - Product data object
 * @param {String|ObjectId} [existingProductId] - Product ID to ignore when checking uniqueness
 * @param {Boolean} [isUpdate=false] - If true, only validates fields present in data
 * @returns {Promise<{ isValid: boolean, errors: string[] }>}
 */
const validateProductData = async (data, existingProductId = null, isUpdate = false) => {
  const errors = [];

  // Auto-compose product name for Tiles if not explicitly provided
  if (data.category === 'Tiles' || (data.hsnCode && String(data.hsnCode).startsWith('6907'))) {
    if (!data.productName || !String(data.productName).trim()) {
      const parts = [];
      if (data.companyName || data.brand) parts.push(data.companyName || data.brand);
      const type = data.productSubType || data.productType || '';
      if (type && type.toLowerCase() !== 'general') parts.push(type);
      const size = data.size || data.rangeOrSize || '';
      if (size) parts.push(size);
      const finish = data.finish || '';
      if (finish && finish.toLowerCase() !== 'standard') parts.push(finish);
      const color = data.colourName || data.color || '';
      if (color && color.toLowerCase() !== 'standard') parts.push(color);
      const tileTitle = parts.join(' ').trim();
      data.productName = tileTitle ? (tileTitle.toLowerCase().includes('tile') ? tileTitle : `${tileTitle} Tile`) : 'Ceramic Tile';
    }
  }

  // 1. Mandatory Fields
  if (!isUpdate) {
    if (!data.productName || !String(data.productName).trim()) {
      errors.push('Product name is mandatory.');
    }
    if (!data.unit || !mongoose.Types.ObjectId.isValid(data.unit)) {
      // Attempt auto-lookup unit
      const foundUnit = await UnitMaster.findOne({
        $or: [
          { unitCode: String(data.unit || 'PCS').toUpperCase() },
          { unitName: new RegExp(`^${String(data.unit || 'PCS')}$`, 'i') }
        ]
      }).catch(() => null);

      if (foundUnit) {
        data.unit = foundUnit._id;
      } else {
        const anyUnit = await UnitMaster.findOne().catch(() => null);
        if (anyUnit) {
          data.unit = anyUnit._id;
        } else {
          const createdUnit = await UnitMaster.create({ unitName: 'Pieces', unitCode: 'PCS' }).catch(() => null);
          if (createdUnit) data.unit = createdUnit._id;
          else errors.push('Unit reference is mandatory.');
        }
      }
    }
  } else {
    if (data.productName !== undefined && (!data.productName || !String(data.productName).trim())) {
      errors.push('Product name cannot be empty.');
    }
  }

  // 2. SKU Validation
  const isSkuLess = data.isSkuLess !== undefined ? Boolean(data.isSkuLess) : false;
  const hasCompanySku = data.companySkuCode !== undefined && data.companySkuCode !== null && String(data.companySkuCode).trim() !== '';
  const companySku = hasCompanySku ? String(data.companySkuCode).trim() : null;

  if (!isUpdate) {
    if (!isSkuLess && !companySku) {
      errors.push('Company SKU Code is required unless product is flagged as SKU-less (isSkuLess: true).');
    }
  }

  if (companySku) {
    const query = { companySkuCode: companySku };
    if (existingProductId) {
      const parsedId = mongoose.Types.ObjectId.isValid(existingProductId)
        ? new mongoose.Types.ObjectId(existingProductId)
        : existingProductId;
      query._id = { $ne: parsedId };
    }
    const duplicate = await Product.findOne(query);
    if (duplicate) {
      errors.push(`Company SKU Code '${companySku}' already exists in the system.`);
    }
  }

  // 3. Tax Rates Validation (0 to 100%)
  const taxFields = ['gstPct', 'igstPct', 'cgstPct', 'sgstPct', 'cessPct'];
  for (const field of taxFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const val = Number(data[field]);
      if (isNaN(val) || val < 0 || val > 100) {
        errors.push(`${field} must be a valid number between 0 and 100.`);
      }
    }
  }

  // 4. Pricing & Stock Rates Validation (Non-negative numbers)
  const numericFields = [
    'mrp',
    'purchaseRate',
    'costRate',
    'salePrice',
    'saleDiscount',
    'openingStock',
    'openingStockValue',
    'defaultQuantity',
    'reorderAlertQty'
  ];

  for (const field of numericFields) {
    if (data[field] !== undefined && data[field] !== null) {
      const val = Number(data[field]);
      if (isNaN(val) || val < 0) {
        errors.push(`${field} must be a valid non-negative number.`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateProductData
};
