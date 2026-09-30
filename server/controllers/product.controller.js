const Product = require('../models/Product');
const Company = require('../models/Company');
const ProductGroup = require('../models/ProductGroup');
const Vendor = require('../models/Vendor');
const UnitMaster = require('../models/UnitMaster');
const mongoose = require('mongoose');
const { validateProductData } = require('../services/productValidation.service');
const { getQuotationUsage } = require('../services/product.service');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * Helper to resolve text names or IDs and auto-create missing master docs
 */
const resolveAndCreateMasters = async (data = {}, userId = null) => {
  const resolved = { ...data };

  // Fallback user reference for audit
  let fallbackUserId = userId;
  if (!fallbackUserId) {
    try {
      const User = require('../models/User');
      const anyUser = await User.findOne().select('_id').lean();
      if (anyUser) fallbackUserId = anyUser._id;
    } catch {
      // Ignored
    }
  }

  // 1. Resolve / Auto-create Company
  const rawCompany = data.company || data.companyName || data.brand;
  if (rawCompany) {
    if (mongoose.Types.ObjectId.isValid(rawCompany) && String(rawCompany).length === 24) {
      resolved.company = rawCompany;
    } else {
      const compName = String(rawCompany).trim();
      if (compName) {
        let compDoc = await Company.findOne({ companyName: { $regex: `^${compName}$`, $options: 'i' } });
        if (!compDoc) {
          compDoc = await Company.create({
            companyName: compName,
            companyType: 'BRAND_MANUFACTURER',
            isActive: true,
            createdBy: fallbackUserId
          }).catch((err) => {
            console.warn('[AutoCreate Company Failed]:', err.message);
            return null;
          });
        }
        resolved.company = compDoc ? compDoc._id : null;
      } else {
        resolved.company = null;
      }
    }
  } else {
    resolved.company = null;
  }

  // 2. Resolve / Auto-create Product Group
  const rawGroup = data.productGroup || data.productType || data.groupName || data.category;
  if (rawGroup) {
    if (mongoose.Types.ObjectId.isValid(rawGroup) && String(rawGroup).length === 24) {
      resolved.productGroup = rawGroup;
    } else {
      const grpName = String(rawGroup).trim();
      if (grpName) {
        let grpDoc = await ProductGroup.findOne({ groupName: { $regex: `^${grpName}$`, $options: 'i' } });
        if (!grpDoc) {
          grpDoc = await ProductGroup.create({
            groupName: grpName,
            category: resolved.category || 'Sanitaryware',
            isActive: true,
            createdBy: fallbackUserId
          }).catch((err) => {
            console.warn('[AutoCreate ProductGroup Failed]:', err.message);
            return null;
          });
        }
        resolved.productGroup = grpDoc ? grpDoc._id : null;
      } else {
        resolved.productGroup = null;
      }
    }
  } else {
    resolved.productGroup = null;
  }

  // 3. Resolve / Auto-create Vendor
  const rawVendor = data.vendor || data.vendorName;
  if (rawVendor) {
    if (mongoose.Types.ObjectId.isValid(rawVendor) && String(rawVendor).length === 24) {
      resolved.vendor = rawVendor;
    } else {
      const venName = String(rawVendor).trim();
      if (venName) {
        let venDoc = await Vendor.findOne({ vendorName: { $regex: `^${venName}$`, $options: 'i' } });
        if (!venDoc) {
          venDoc = await Vendor.create({
            vendorName: venName,
            isActive: true,
            createdBy: fallbackUserId
          }).catch((err) => {
            console.warn('[AutoCreate Vendor Failed]:', err.message);
            return null;
          });
        }
        resolved.vendor = venDoc ? venDoc._id : null;
      } else {
        resolved.vendor = null;
      }
    }
  } else {
    resolved.vendor = null;
  }

  // 4. Resolve / Auto-create Unit
  const rawUnit = data.unit || data.unitName || 'PCS';
  if (rawUnit) {
    if (mongoose.Types.ObjectId.isValid(rawUnit) && String(rawUnit).length === 24) {
      resolved.unit = rawUnit;
    } else {
      const unitCode = String(rawUnit).trim().toUpperCase();
      let unitDoc = await UnitMaster.findOne({
        $or: [
          { unitCode: unitCode },
          { unitName: { $regex: `^${String(rawUnit).trim()}$`, $options: 'i' } }
        ]
      });
      if (!unitDoc) {
        unitDoc = await UnitMaster.create({
          unitName: unitCode === 'PCS' ? 'Pieces' : unitCode,
          unitCode: unitCode,
          isActive: true,
          createdBy: fallbackUserId
        }).catch((err) => {
          console.warn('[AutoCreate Unit Failed]:', err.message);
          return null;
        });
      }
      if (unitDoc) {
        resolved.unit = unitDoc._id;
      } else {
        const anyUnit = await UnitMaster.findOne();
        resolved.unit = anyUnit?._id || null;
      }
    }
  }

  return resolved;
};

/**
 * @desc    Create a new Product
 * @route   POST /api/products
 * @access  checkPermission('PRODUCT_MASTER', 'create')
 */
const createProduct = async (req, res, next) => {
  try {
    const resolvedBody = await resolveAndCreateMasters(req.body, req.user?._id);
    const validation = await validateProductData(resolvedBody);
    if (!validation.isValid) {
      return sendError(res, 'Product validation failed.', 400, validation.errors);
    }

    const {
      companySkuCode,
      vendorSkuCode,
      isSkuLess,
      productName,
      hsnCode,
      company,
      vendor,
      productGroup,
      category,
      productType,
      productSubType,
      rangeOrSize,
      range,
      size,
      colourName,
      finish,
      fullDescription,
      piecesPerBox,
      sqftPerBox,
      weightPerBox,
      productImage,
      unit,
      gstPct,
      igstPct,
      cgstPct,
      sgstPct,
      cessPct,
      mrp,
      purchaseRate,
      costRate,
      salePrice,
      saleDiscount,
      openingStock,
      openingStockValue,
      defaultQuantity,
      reorderAlertQty,
      isActive
    } = resolvedBody;

    const opStock = Number(openingStock) || 0;

    const productPayload = {
      vendorSkuCode: vendorSkuCode ? vendorSkuCode.trim() : null,
      isSkuLess: Boolean(isSkuLess),
      productName: productName.trim(),
      hsnCode: hsnCode ? hsnCode.trim() : null,
      company: (company && mongoose.Types.ObjectId.isValid(company) && String(company).length === 24) ? company : null,
      vendor: (vendor && mongoose.Types.ObjectId.isValid(vendor) && String(vendor).length === 24) ? vendor : null,
      productGroup: (productGroup && mongoose.Types.ObjectId.isValid(productGroup) && String(productGroup).length === 24) ? productGroup : null,
      category: category ? category.trim() : 'Sanitaryware',
      productType: productType ? productType.trim() : null,
      productSubType: productSubType ? productSubType.trim() : null,
      rangeOrSize: rangeOrSize ? rangeOrSize.trim() : (size || range || null),
      range: range ? range.trim() : null,
      size: size ? size.trim() : null,
      colourName: colourName ? colourName.trim() : null,
      finish: finish ? finish.trim() : null,
      fullDescription: fullDescription ? fullDescription.trim() : null,
      piecesPerBox: piecesPerBox !== undefined && piecesPerBox !== null && piecesPerBox !== '' ? Number(piecesPerBox) : null,
      sqftPerBox: sqftPerBox !== undefined && sqftPerBox !== null && sqftPerBox !== '' ? Number(sqftPerBox) : null,
      weightPerBox: weightPerBox !== undefined && weightPerBox !== null && weightPerBox !== '' ? Number(weightPerBox) : null,
      productImage: productImage || resolvedBody.image || resolvedBody.imageUrl || resolvedBody.photo || null,
      unit,
      gstPct: Number(gstPct) || 0,
      igstPct: Number(igstPct) || 0,
      cgstPct: Number(cgstPct) || 0,
      sgstPct: Number(sgstPct) || 0,
      cessPct: Number(cessPct) || 0,
      mrp: Number(mrp) || 0,
      purchaseRate: Number(purchaseRate) || 0,
      costRate: Number(costRate) || 0,
      salePrice: Number(salePrice) || 0,
      saleDiscount: Number(saleDiscount) || 0,
      openingStock: opStock,
      openingStockValue: Number(openingStockValue) || 0,
      defaultQuantity: Number(defaultQuantity) || 0,
      currentStock: opStock, // Initialized to opening stock
      reorderAlertQty: Number(reorderAlertQty) || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    };

    if (companySkuCode && companySkuCode.trim()) {
      productPayload.companySkuCode = companySkuCode.trim();
    }

    const product = await Product.create(productPayload);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PRODUCT_MASTER',
      actionType: 'CREATE',
      entityType: 'Product',
      entityId: product._id,
      entityLabel: `Product ${product.productName} (${product.companySkuCode || 'SKU-less'})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Product create log error:', err.message));

    const populated = await Product.findById(product._id)
      .populate('company', 'companyName companyType')
      .populate('vendor', 'vendorName')
      .populate('productGroup', 'groupName')
      .populate('unit', 'unitName unitCode');

    return sendSuccess(res, 'Product created successfully.', populated, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all Products with filtering & pagination
 * @route   GET /api/products
 * @access  checkPermission('PRODUCT_MASTER', 'view')
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      groupId,
      companyId,
      vendorId,
      isActive,
      lowStock,
      page = 1,
      limit = 50
    } = req.query;

    const filter = {};

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { companySkuCode: { $regex: search, $options: 'i' } },
        { vendorSkuCode: { $regex: search, $options: 'i' } },
        { hsnCode: { $regex: search, $options: 'i' } }
      ];
    }

    if (groupId) filter.productGroup = groupId;
    if (companyId) filter.company = companyId;
    if (vendorId) filter.vendor = vendorId;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$currentStock', '$reorderAlertQty'] };
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('company', 'companyName companyType')
        .populate('vendor', 'vendorName')
        .populate('productGroup', 'groupName')
        .populate('unit', 'unitName unitCode')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter)
    ]);

    return sendSuccess(res, 'Products retrieved successfully.', {
      products,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Product by ID
 * @route   GET /api/products/:id
 * @access  checkPermission('PRODUCT_MASTER', 'view')
 */
const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id)
      .populate('company')
      .populate('vendor')
      .populate('productGroup')
      .populate('unit')
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    return sendSuccess(res, 'Product retrieved successfully.', product);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Product (currentStock is strictly write-protected)
 * @route   PUT /api/products/:id
 * @access  checkPermission('PRODUCT_MASTER', 'edit')
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    const resolvedBody = await resolveAndCreateMasters(req.body);
    const validation = await validateProductData(resolvedBody, id, true);
    if (!validation.isValid) {
      return sendError(res, 'Product validation failed.', 400, validation.errors);
    }

    const oldProduct = {
      productName: product.productName,
      companySkuCode: product.companySkuCode,
      vendorSkuCode: product.vendorSkuCode,
      mrp: product.mrp,
      purchaseRate: product.purchaseRate,
      salePrice: product.salePrice,
      saleDiscount: product.saleDiscount,
      reorderAlertQty: product.reorderAlertQty,
      isActive: product.isActive
    };

    const allowedUpdates = { ...resolvedBody };

    // Explicitly strip write-protected fields
    delete allowedUpdates.currentStock;
    delete allowedUpdates.createdBy;
    delete allowedUpdates._id;
    delete allowedUpdates.id;

    // Sanitize ObjectId relations to prevent CastErrors on empty strings
    if (allowedUpdates.company !== undefined) {
      allowedUpdates.company = (allowedUpdates.company && String(allowedUpdates.company).trim()) ? allowedUpdates.company : null;
    }
    if (allowedUpdates.vendor !== undefined) {
      allowedUpdates.vendor = (allowedUpdates.vendor && String(allowedUpdates.vendor).trim()) ? allowedUpdates.vendor : null;
    }
    if (allowedUpdates.productGroup !== undefined) {
      allowedUpdates.productGroup = (allowedUpdates.productGroup && String(allowedUpdates.productGroup).trim()) ? allowedUpdates.productGroup : null;
    }
    if (allowedUpdates.unit !== undefined) {
      if (!allowedUpdates.unit || !String(allowedUpdates.unit).trim()) {
        delete allowedUpdates.unit; // Keep existing unit if not provided
      }
    }

    // Sanitize ceramic tile package numbers
    if (allowedUpdates.piecesPerBox === '' || allowedUpdates.piecesPerBox === undefined) {
      if (allowedUpdates.piecesPerBox === '') allowedUpdates.piecesPerBox = null;
    } else if (allowedUpdates.piecesPerBox !== null) {
      allowedUpdates.piecesPerBox = Number(allowedUpdates.piecesPerBox);
    }

    if (allowedUpdates.sqftPerBox === '' || allowedUpdates.sqftPerBox === undefined) {
      if (allowedUpdates.sqftPerBox === '') allowedUpdates.sqftPerBox = null;
    } else if (allowedUpdates.sqftPerBox !== null) {
      allowedUpdates.sqftPerBox = Number(allowedUpdates.sqftPerBox);
    }

    if (allowedUpdates.weightPerBox === '' || allowedUpdates.weightPerBox === undefined) {
      if (allowedUpdates.weightPerBox === '') allowedUpdates.weightPerBox = null;
    } else if (allowedUpdates.weightPerBox !== null) {
      allowedUpdates.weightPerBox = Number(allowedUpdates.weightPerBox);
    }

    // Apply allowed updates
    Object.assign(product, allowedUpdates);
    product.updatedBy = req.user._id;

    if (allowedUpdates.companySkuCode) {
      product.companySkuCode = allowedUpdates.companySkuCode.trim();
    }
    if (allowedUpdates.vendorSkuCode !== undefined) {
      product.vendorSkuCode = allowedUpdates.vendorSkuCode ? allowedUpdates.vendorSkuCode.trim() : null;
    }

    await product.save();

    const diff = activityLogService.computeDiff(oldProduct, product, Object.keys(oldProduct));
    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PRODUCT_MASTER',
      actionType: 'UPDATE',
      entityType: 'Product',
      entityId: product._id,
      entityLabel: `Product ${product.productName} (${product.companySkuCode || 'SKU-less'})`,
      changeSummary: diff,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Product update log error:', err.message));

    const updatedProduct = await Product.findById(id)
      .populate('company', 'companyName companyType')
      .populate('vendor', 'vendorName')
      .populate('productGroup', 'groupName')
      .populate('unit', 'unitName unitCode');

    return sendSuccess(res, 'Product updated successfully.', updatedProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate Product (Soft delete only)
 * @route   PUT /api/products/:id/deactivate
 * @access  checkPermission('PRODUCT_MASTER', 'delete')
 */
const deactivateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    product.isActive = false;
    product.updatedBy = req.user._id;
    await product.save();

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PRODUCT_MASTER',
      actionType: 'DELETE',
      entityType: 'Product',
      entityId: product._id,
      entityLabel: `Product ${product.productName} deactivated`,
      changeSummary: { isActive: { before: true, after: false } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Product deactivate log error:', err.message));

    return sendSuccess(res, 'Product deactivated successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Permanently delete Product and cascade purge all related records
 * @route   DELETE /api/products/:id
 * @access  checkPermission('PRODUCT_MASTER', 'delete')
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deleteProductWithCascade } = require('../services/product.service');
    const result = await deleteProductWithCascade(id);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PRODUCT_MASTER',
      actionType: 'DELETE',
      entityType: 'Product',
      entityId: id,
      entityLabel: `Product permanently deleted`,
      changeSummary: result,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Product delete log error:', err.message));

    return sendSuccess(res, 'Product and all associated records deleted successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Bulk delete products by IDs
 * @route   POST /api/products/bulk-delete
 * @access  checkPermission('PRODUCT_MASTER', 'delete')
 */
const bulkDeleteProducts = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return sendError(res, 'Please provide an array of productIds to delete.', 400);
    }

    const { bulkDeleteProductsWithCascade } = require('../services/product.service');
    const result = await bulkDeleteProductsWithCascade(productIds);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PRODUCT_MASTER',
      actionType: 'DELETE',
      entityType: 'Product',
      entityId: null,
      entityLabel: `Bulk deleted ${result.deletedCount} products`,
      changeSummary: result,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Bulk delete log error:', err.message));

    return sendSuccess(res, `Successfully deleted ${result.deletedCount} products.`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete ALL products from database (Purge Catalog)
 * @route   DELETE /api/products/delete-all
 * @access  checkPermission('PRODUCT_MASTER', 'delete')
 */
const deleteAllProducts = async (req, res, next) => {
  try {
    const { deleteAllProductsWithCascade } = require('../services/product.service');
    const result = await deleteAllProductsWithCascade();

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'PRODUCT_MASTER',
      actionType: 'DELETE',
      entityType: 'Product',
      entityId: null,
      entityLabel: `Purged all ${result.deletedCount} products from database`,
      changeSummary: result,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Delete all products log error:', err.message));

    return sendSuccess(res, `Successfully purged all ${result.deletedCount} products from database.`, result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search products by either Company SKU or Vendor SKU
 * @route   GET /api/products/search-by-sku
 * @access  checkPermission('PRODUCT_MASTER', 'view')
 */
const searchBySku = async (req, res, next) => {
  try {
    const { code } = req.query;

    if (!code || !code.trim()) {
      return sendError(res, 'SKU code parameter is required.', 400);
    }

    const skuQuery = code.trim();

    const products = await Product.find({
      $or: [
        { companySkuCode: skuQuery },
        { vendorSkuCode: skuQuery }
      ],
      isActive: true
    })
      .populate('company', 'companyName companyType')
      .populate('vendor', 'vendorName')
      .populate('productGroup', 'groupName')
      .populate('unit', 'unitName unitCode');

    return sendSuccess(res, `Found ${products.length} products matching SKU '${skuQuery}'.`, products);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get low stock products (currentStock <= reorderAlertQty)
 * @route   GET /api/products/low-stock
 * @access  checkPermission('PRODUCT_MASTER', 'view')
 */
const getLowStockProducts = async (req, res, next) => {
  try {
    const products = await Product.find({
      $expr: { $lte: ['$currentStock', '$reorderAlertQty'] },
      isActive: true
    })
      .populate('company', 'companyName')
      .populate('productGroup', 'groupName')
      .populate('unit', 'unitName unitCode')
      .sort({ currentStock: 1 });

    return sendSuccess(res, 'Low stock products retrieved successfully.', products);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get quotation usage for a product (Module 14: Product-Quotation Tracking)
 * @route   GET /api/products/:id/quotation-usage
 * @access  checkPermission('PRODUCT_MASTER', 'view') AND checkPermission('PRODUCT_QUOTATION_TRACKING', 'view')
 */
const getProductQuotationUsage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const productQuotationTrackingService = require('../services/productQuotationTracking.service');
    const result = await productQuotationTrackingService.getUsageForProduct(id, req.user, req.query);
    return sendSuccess(res, 'Quotation usage retrieved successfully.', result);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export products for Excel/PDF download
 * @route   GET /api/products/export
 * @access  checkPermission('PRODUCT_MASTER', 'export')
 */
const exportProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ isActive: true })
      .populate('company', 'companyName')
      .populate('vendor', 'vendorName')
      .populate('productGroup', 'groupName')
      .populate('unit', 'unitName unitCode')
      .sort({ companySkuCode: 1, productName: 1 });

    return sendSuccess(res, 'Products export data prepared successfully.', products);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload product image to Cloudinary
 * @route   POST /api/products/upload-image
 * @access  checkPermission('PRODUCT_MASTER', 'create')
 */
const uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return sendError(res, 'No image file provided.', 400);
    }

    const { uploadToCloudinary } = require('../config/cloudinary');
    const result = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      'maitri-ceramic/products',
      'image'
    );

    return sendSuccess(res, 'Product image uploaded to Cloudinary successfully.', {
      url: result.secure_url,
      publicId: result.public_id,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deactivateProduct,
  deleteProduct,
  bulkDeleteProducts,
  deleteAllProducts,
  searchBySku,
  getLowStockProducts,
  getProductQuotationUsage,
  exportProducts,
  uploadProductImage
};
