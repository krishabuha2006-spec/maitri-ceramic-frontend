const XLSX = require('xlsx');
const productQuotationTrackingService = require('../services/productQuotationTracking.service');
const { sendSuccess } = require('../utils/response.util');

/**
 * @desc    Get Quotation Usage for a Product
 * @route   GET /api/product-tracking/:productId/quotation-usage
 * @access  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view')
 */
const getUsage = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await productQuotationTrackingService.getUsageForProduct(
      productId,
      req.user,
      req.query
    );
    return sendSuccess(res, 'Product quotation usage retrieved successfully.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Ranked Most Quoted Products
 * @route   GET /api/product-tracking/most-quoted
 * @access  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view')
 */
const getMostQuoted = async (req, res, next) => {
  try {
    const result = await productQuotationTrackingService.getMostQuotedProducts(
      req.query,
      req.user
    );
    return sendSuccess(res, 'Most quoted products retrieved successfully.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Get Distinct Customers Quoted a Specific Product
 * @route   GET /api/product-tracking/:productId/customer-list
 * @access  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view')
 */
const getCustomerList = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await productQuotationTrackingService.getCustomersForProduct(
      productId,
      req.user
    );
    return sendSuccess(res, 'Quoted customer list retrieved successfully.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Recompute and Update Summary Cache for a Product
 * @route   POST /api/product-tracking/:productId/recompute-summary
 * @access  checkPermission('PRODUCT_QUOTATION_TRACKING', 'view') + Admin
 */
const recomputeSummary = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await productQuotationTrackingService.recomputeSummaryCache(productId);
    return sendSuccess(res, 'Product quotation summary cache recomputed successfully.', result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Export Product Quotation Tracking Report to Excel
 * @route   GET /api/product-tracking/export
 * @access  checkPermission('PRODUCT_QUOTATION_TRACKING', 'export')
 */
const exportReport = async (req, res, next) => {
  try {
    const { workbook, filename } = await productQuotationTrackingService.exportProductTracking(
      req.query,
      req.user
    );

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(buffer);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsage,
  getMostQuoted,
  getCustomerList,
  recomputeSummary,
  exportReport
};
