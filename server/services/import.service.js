const XLSX = require('xlsx');
const Company = require('../models/Company');
const ProductGroup = require('../models/ProductGroup');
const UnitMaster = require('../models/UnitMaster');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const ImportBatch = require('../models/ImportBatch');
const { validateProductData } = require('./productValidation.service');

/**
 * Resolve text names into database ObjectIds for reference masters
 *
 * @param {Object} rowData
 * @returns {Promise<{ resolvedData: Object, resolutionErrors: Array<{ field: string, message: string }> }>}
 */
const resolveMasterReferences = async (rowData) => {
  const resolved = { ...rowData };
  const resolutionErrors = [];

  // 1. Resolve Company
  if (rowData.company) {
    const compName = String(rowData.company).trim();
    let compDoc = await Company.findOne({ companyName: { $regex: `^${compName}$`, $options: 'i' } });
    if (!compDoc && compName) {
      compDoc = await Company.create({
        companyName: compName,
        isActive: true
      }).catch(() => null);
    }
    if (compDoc) {
      resolved.company = compDoc._id;
    }
  }

  // 2. Resolve Product Group
  if (rowData.productGroup || rowData.productType) {
    const grpName = String(rowData.productGroup || rowData.productType).trim();
    let grpDoc = await ProductGroup.findOne({ groupName: { $regex: `^${grpName}$`, $options: 'i' } });
    if (!grpDoc && grpName) {
      grpDoc = await ProductGroup.create({
        groupName: grpName,
        isActive: true
      }).catch(() => null);
    }
    if (grpDoc) {
      resolved.productGroup = grpDoc._id;
    }
  }

  // 3. Resolve Vendor
  if (rowData.vendor) {
    const venName = String(rowData.vendor).trim();
    let venDoc = await Vendor.findOne({ vendorName: { $regex: `^${venName}$`, $options: 'i' } });
    if (!venDoc && venName) {
      venDoc = await Vendor.create({
        vendorName: venName,
        isActive: true
      }).catch(() => null);
    }
    if (venDoc) {
      resolved.vendor = venDoc._id;
    }
  }

  // 4. Resolve Unit
  const unitText = String(rowData.unit || 'PCS').trim();
  let unitDoc = await UnitMaster.findOne({
    $or: [
      { unitCode: { $regex: `^${unitText}$`, $options: 'i' } },
      { unitName: { $regex: `^${unitText}$`, $options: 'i' } }
    ]
  });

  if (!unitDoc) {
    unitDoc = await UnitMaster.findOne({ isActive: true });
  }

  if (!unitDoc) {
    unitDoc = await UnitMaster.create({
      unitName: 'Pieces',
      unitCode: 'PCS',
      isActive: true
    }).catch(() => null);
  }

  if (unitDoc) {
    resolved.unit = unitDoc._id;
  }

  return {
    resolvedData: resolved,
    resolutionErrors
  };
};

/**
 * Apply field mapping dictionary to a raw source row
 *
 * @param {Object} rawRow
 * @param {Object} fieldMapping - { [sourceHeader]: systemField }
 * @returns {Object}
 */
const mapRow = (rawRow, fieldMapping) => {
  const mapped = {};

  for (const [sourceKey, systemKey] of Object.entries(fieldMapping || {})) {
    if (!systemKey) continue;
    const value = rawRow[sourceKey];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      mapped[systemKey] = value;
    }
  }

  return mapped;
};

/**
 * Non-destructive preview simulation running full validations with ZERO DB writes
 *
 * @param {Array<Object>} rawRows
 * @param {Object} fieldMapping
 * @returns {Promise<Array<Object>>}
 */
const simulatePreview = async (rawRows, fieldMapping) => {
  const previewResults = [];
  const seenCompanySkusInFile = new Set();

  for (let i = 0; i < rawRows.length; i++) {
    const rowNumber = i + 1;
    const rawData = rawRows[i];
    const mapped = mapRow(rawData, fieldMapping);

    const rowErrors = [];

    // 1. Check duplicate companySkuCode within the same file
    if (mapped.companySkuCode && !mapped.isSkuLess) {
      const sku = String(mapped.companySkuCode).trim().toUpperCase();
      if (seenCompanySkusInFile.has(sku)) {
        rowErrors.push(`Duplicate Company SKU Code '${mapped.companySkuCode}' detected within this file (Row ${rowNumber}).`);
      } else {
        seenCompanySkusInFile.add(sku);
      }
    }

    // 2. Resolve Master text references
    const { resolvedData, resolutionErrors } = await resolveMasterReferences(mapped);
    resolutionErrors.forEach((err) => rowErrors.push(err.message));

    // Check if existing product in DB for repeat import update
    let existingProduct = null;
    if (resolvedData.companySkuCode && !resolvedData.isSkuLess) {
      existingProduct = await Product.findOne({ companySkuCode: String(resolvedData.companySkuCode).trim() });
    } else if (resolvedData.vendorSkuCode) {
      existingProduct = await Product.findOne({ vendorSkuCode: String(resolvedData.vendorSkuCode).trim() });
    }

    // 3. Run shared ProductValidationService (passing existing product ID if found)
    const validation = await validateProductData(resolvedData, existingProduct ? existingProduct._id : null, !!existingProduct);
    if (!validation.isValid) {
      validation.errors.forEach((e) => rowErrors.push(e));
    }

    previewResults.push({
      rowNumber,
      rawData,
      mappedData: resolvedData,
      isExisting: !!existingProduct,
      isValid: rowErrors.length === 0,
      errors: rowErrors
    });
  }

  return previewResults;
};

/**
 * Execute actual batch commit with partial-success bulk upsert
 *
 * @param {String|ObjectId} importBatchId
 * @param {Object} fieldMapping
 * @param {String|ObjectId} userId
 * @returns {Promise<Object>}
 */
const executeCommit = async (importBatchId, fieldMapping, userId) => {
  const batch = await ImportBatch.findById(importBatchId);
  if (!batch) {
    throw new Error('Import batch record not found.');
  }

  const rawRows = batch.cachedRows || [];
  if (rawRows.length === 0) {
    throw new Error('Import batch contains no cached rows to commit.');
  }

  const preview = await simulatePreview(rawRows, fieldMapping);

  let successCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let failedCount = 0;
  const batchErrors = [];

  for (const item of preview) {
    if (!item.isValid) {
      failedCount++;
      item.errors.forEach((msg) => {
        batchErrors.push({
          rowNumber: item.rowNumber,
          field: null,
          message: msg
        });
      });
      continue;
    }

    const data = item.mappedData;

    try {
      let existingProduct = null;

      // Priority 1: Match by companySkuCode
      if (data.companySkuCode && !data.isSkuLess) {
        existingProduct = await Product.findOne({ companySkuCode: String(data.companySkuCode).trim() });
      }

      // Priority 2: Match by vendorSkuCode if companySkuCode absent
      if (!existingProduct && data.vendorSkuCode) {
        existingProduct = await Product.findOne({ vendorSkuCode: String(data.vendorSkuCode).trim() });
      }

      if (existingProduct) {
        // UPDATE existing product
        // Rule 5: Explicitly protect currentStock from modification
        const updatePayload = {
          productName: data.productName ? String(data.productName).trim() : existingProduct.productName,
          hsnCode: data.hsnCode !== undefined ? data.hsnCode : existingProduct.hsnCode,
          company: data.company || existingProduct.company,
          vendor: data.vendor || existingProduct.vendor,
          productGroup: data.productGroup || existingProduct.productGroup,
          unit: data.unit || existingProduct.unit,
          gstPct: data.gstPct !== undefined ? Number(data.gstPct) : existingProduct.gstPct,
          mrp: data.mrp !== undefined ? Number(data.mrp) : existingProduct.mrp,
          purchaseRate: data.purchaseRate !== undefined ? Number(data.purchaseRate) : existingProduct.purchaseRate,
          costRate: data.costRate !== undefined ? Number(data.costRate) : existingProduct.costRate,
          salePrice: data.salePrice !== undefined ? Number(data.salePrice) : existingProduct.salePrice,
          saleDiscount: data.saleDiscount !== undefined ? Number(data.saleDiscount) : existingProduct.saleDiscount,
          updatedBy: userId
        };

        if (data.productImage || data.image || data.imageUrl) {
          updatePayload.productImage = data.productImage || data.image || data.imageUrl;
        }

        if (data.companySkuCode) updatePayload.companySkuCode = String(data.companySkuCode).trim();
        if (data.vendorSkuCode) updatePayload.vendorSkuCode = String(data.vendorSkuCode).trim();

        await Product.findByIdAndUpdate(existingProduct._id, updatePayload);
        updatedCount++;
        successCount++;
      } else {
        // CREATE new product
        const opStock = Number(data.openingStock) || 0;
        const createPayload = {
          vendorSkuCode: data.vendorSkuCode ? String(data.vendorSkuCode).trim() : null,
          isSkuLess: Boolean(data.isSkuLess),
          productName: String(data.productName).trim(),
          hsnCode: data.hsnCode ? String(data.hsnCode).trim() : null,
          company: data.company || null,
          vendor: data.vendor || null,
          productGroup: data.productGroup || null,
          productImage: data.productImage || data.image || data.imageUrl || null,
          unit: data.unit,
          gstPct: Number(data.gstPct) || 0,
          mrp: Number(data.mrp) || 0,
          purchaseRate: Number(data.purchaseRate) || 0,
          costRate: Number(data.costRate) || 0,
          salePrice: Number(data.salePrice) || 0,
          saleDiscount: Number(data.saleDiscount) || 0,
          openingStock: opStock,
          openingStockValue: Number(data.openingStockValue) || 0,
          defaultQuantity: Number(data.defaultQuantity) || 0,
          currentStock: opStock, // Initialized to opening stock
          reorderAlertQty: Number(data.reorderAlertQty) || 0,
          isActive: true,
          createdBy: userId
        };

        if (data.companySkuCode && !data.isSkuLess) {
          createPayload.companySkuCode = String(data.companySkuCode).trim();
        }

        await Product.create(createPayload);
        createdCount++;
        successCount++;
      }
    } catch (err) {
      failedCount++;
      batchErrors.push({
        rowNumber: item.rowNumber,
        field: null,
        message: `Database write error: ${err.message}`
      });
    }
  }

  // Determine final status
  let finalStatus = 'COMMITTED';
  if (failedCount > 0 && successCount > 0) {
    finalStatus = 'PARTIAL_SUCCESS';
  } else if (failedCount > 0 && successCount === 0) {
    finalStatus = 'EXTRACTION_FAILED';
  }

  batch.status = finalStatus;
  batch.fieldMappingUsed = fieldMapping;
  batch.totalRows = preview.length;
  batch.successCount = successCount;
  batch.createdCount = createdCount;
  batch.updatedCount = updatedCount;
  batch.failedCount = failedCount;
  batch.errors = batchErrors;
  batch.committedAt = new Date();

  await batch.save();

  return {
    importBatchId: batch._id,
    status: finalStatus,
    totalRows: preview.length,
    successCount,
    createdCount,
    updatedCount,
    failedCount,
    errors: batchErrors,
    fileUrl: batch.fileUrl
  };
};

/**
 * Generate a downloadable Excel error report buffer of failed rows
 *
 * @param {Object} batch
 * @returns {Buffer}
 */
const generateErrorReport = (batch) => {
  const errorMap = new Map();
  (batch.errors || []).forEach((e) => {
    const existing = errorMap.get(e.rowNumber) || [];
    existing.push(e.message);
    errorMap.set(e.rowNumber, existing);
  });

  const reportData = [];
  const rawRows = batch.cachedRows || [];

  for (const [rowNum, messages] of errorMap.entries()) {
    const rawRow = rawRows[rowNum - 1] || {};
    reportData.push({
      'Row Number': rowNum,
      'Error Reasons': messages.join(' | '),
      ...rawRow
    });
  }

  const worksheet = XLSX.utils.json_to_sheet(reportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import Errors');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  resolveMasterReferences,
  mapRow,
  simulatePreview,
  executeCommit,
  generateErrorReport
};
