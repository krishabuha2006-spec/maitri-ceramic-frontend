const Quotation = require('../models/Quotation');
const QuotationNumberSequence = require('../models/QuotationNumberSequence');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const Product = require('../models/Product');
const User = require('../models/User');
const activityLogService = require('../services/activityLog.service');

const { resolveAndCalculateLineItems } = require('../services/quotationCalculation.service');
const { renderQuotationData, exportQuotationToExcel } = require('../services/quotationRender.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Create a new Quotation
 * @route   POST /api/quotations
 * @access  Private (Permission: QUOTATION:create)
 */
const createQuotation = async (req, res, next) => {
  try {
    const {
      customerId,
      customerContact,
      customerAddress,
      companyId,
      salespersonId,
      reference,
      remarks,
      formatKey,
      formatId,
      validityDate,
      quotationDate,
      items
    } = req.body;

    // 1. Validate Customer
    if (!customerId) {
      return sendError(res, 'Customer ID is required.', 400);
    }
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return sendError(res, `Customer with ID '${customerId}' not found.`, 404);
    }

    // 2. Validate Salesperson (defaults to authenticated user)
    let salespersonUser = req.user;
    if (salespersonId) {
      const foundUser = await User.findById(salespersonId);
      if (foundUser) salespersonUser = foundUser;
    }

    // 3. Validate Optional Company Filter
    let companyDoc = null;
    if (companyId) {
      companyDoc = await Company.findById(companyId);
    }

    // 4. Resolve Quotation Format
    let formatDoc = null;
    const requestedFormatKey = String(formatKey || 'STANDARD').toUpperCase();
    if (formatId) {
      formatDoc = await QuotationFormatMaster.findById(formatId);
    }
    if (!formatDoc && requestedFormatKey) {
      formatDoc = await QuotationFormatMaster.findOne({ formatKey: requestedFormatKey });
    }
    if (!formatDoc) {
      // Fallback to first active format or auto-create default STANDARD
      formatDoc = await QuotationFormatMaster.findOne({ isActive: true });
      if (!formatDoc) {
        formatDoc = await QuotationFormatMaster.create({
          formatKey: 'STANDARD',
          formatName: 'Standard Customer Quotation',
          createdBy: req.user._id
        });
      }
    }

    // 5. Resolve and Calculate Line Items & Amounts Server-Side
    const { resolvedItems, totals } = await resolveAndCalculateLineItems(items || []);

    if (resolvedItems.length === 0) {
      return sendError(res, 'A quotation must contain at least one valid line item.', 400);
    }

    // 6. Generate Atomic Concurrency-Safe Sequential Quotation Number
    const qDate = quotationDate ? new Date(quotationDate) : new Date();
    const quotationNumber = await QuotationNumberSequence.generateNextNumber(qDate);

    // 7. Create Quotation Document
    const newQuotation = await Quotation.create({
      quotationNumber,
      quotationDate: qDate,
      customer: customer._id,
      customerContact: customerContact || customer.mobile,
      customerAddress: customerAddress || customer.billingAddress,
      company: companyDoc ? companyDoc._id : null,
      salesperson: salespersonUser._id,
      reference: reference ? reference.trim() : null,
      remarks: remarks ? remarks.trim() : null,
      format: formatDoc._id,
      formatKey: formatDoc.formatKey || requestedFormatKey,
      validityDate: validityDate ? new Date(validityDate) : null,
      status: 'DRAFT',
      items: resolvedItems,
      ...totals,
      isActive: true,
      createdBy: req.user._id
    });

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'QUOTATION',
      actionType: 'CREATE',
      entityType: 'Quotation',
      entityId: newQuotation._id,
      entityLabel: `Quotation #${newQuotation.quotationNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Quotation create log error:', err.message));

    const populatedQuotation = await Quotation.findById(newQuotation._id)
      .populate('customer', 'customerName mobile email city billingAddress')
      .populate('company', 'companyName companyCode gstin logo')
      .populate('salesperson', 'name mobile email')
      .populate('format', 'formatKey formatName');

    return sendSuccess(res, 'Quotation created successfully.', populatedQuotation, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated quotation list with filters & dataScope
 * @route   GET /api/quotations
 * @access  Private (Permission: QUOTATION:view)
 */
const listQuotations = async (req, res, next) => {
  try {
    const filter = { ...(req.scopeFilter || {}) };

    // Status Filter
    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    // Customer Filter
    if (req.query.customerId) {
      filter.customer = req.query.customerId;
    }

    // Salesperson Filter
    if (req.query.salespersonId) {
      filter.salesperson = req.query.salespersonId;
    }

    // Company Filter
    if (req.query.companyId) {
      filter.company = req.query.companyId;
    }

    // Active Status Filter
    if (req.query.isActive !== undefined && req.query.isActive !== 'all') {
      filter.isActive = req.query.isActive === 'true' || req.query.isActive === true;
    } else if (req.query.isActive === undefined) {
      filter.isActive = true;
    }

    // Date Range Filters
    if (req.query.from || req.query.to) {
      filter.quotationDate = {};
      if (req.query.from) filter.quotationDate.$gte = new Date(req.query.from);
      if (req.query.to) filter.quotationDate.$lte = new Date(req.query.to);
    }

    // Text Search (quotationNumber, reference, remarks)
    if (req.query.search) {
      const searchRegex = { $regex: req.query.search.trim(), $options: 'i' };
      filter.$or = [
        { quotationNumber: searchRegex },
        { reference: searchRegex },
        { remarks: searchRegex }
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .populate('customer', 'customerName mobile city')
        .populate('company', 'companyName companyCode')
        .populate('salesperson', 'name mobile')
        .populate('format', 'formatKey formatName')
        .sort({ quotationDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Quotation.countDocuments(filter)
    ]);

    return sendSuccess(res, 'Quotations retrieved successfully.', {
      quotations,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single quotation by ID
 * @route   GET /api/quotations/:id
 * @access  Private (Permission: QUOTATION:view)
 */
const getQuotationById = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const quotation = await Quotation.findOne(filter)
      .populate('customer', 'customerName mobile email city billingAddress shippingAddress gstNumber')
      .populate('company', 'companyName companyCode gstin logo address')
      .populate('salesperson', 'name mobile email')
      .populate('format', 'formatKey formatName')
      .populate('items.product', 'productName companySkuCode vendorSkuCode productImage mrp unit');

    if (!quotation) {
      return sendError(res, 'Quotation not found or not permitted within your data scope.', 404);
    }

    return sendSuccess(res, 'Quotation retrieved successfully.', quotation);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update quotation header and line items
 * @route   PUT /api/quotations/:id
 * @access  Private (Permission: QUOTATION:edit)
 */
const updateQuotation = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const quotation = await Quotation.findOne(filter);
    if (!quotation) {
      return sendError(res, 'Quotation not found or not permitted to edit.', 404);
    }

    // Rule 4: Block item edits if status is CONFIRMED or CLOSED
    if (quotation.status === 'CONFIRMED' || quotation.status === 'CLOSED') {
      return sendError(
        res,
        `Quotation is already in '${quotation.status}' status and cannot be modified directly. Adjustments must be made in Quotation Confirmation (Module 7).`,
        400
      );
    }

    const {
      customerContact,
      customerAddress,
      companyId,
      salespersonId,
      reference,
      remarks,
      formatKey,
      validityDate,
      items
    } = req.body;

    if (customerContact !== undefined) quotation.customerContact = customerContact;
    if (customerAddress !== undefined) quotation.customerAddress = customerAddress;
    if (reference !== undefined) quotation.reference = reference;
    if (remarks !== undefined) quotation.remarks = remarks;
    if (validityDate !== undefined) quotation.validityDate = validityDate ? new Date(validityDate) : null;
    if (companyId !== undefined) quotation.company = companyId || null;
    if (salespersonId !== undefined) quotation.salesperson = salespersonId;

    if (formatKey) {
      const formatDoc = await QuotationFormatMaster.findOne({ formatKey: formatKey.toUpperCase() });
      if (formatDoc) {
        quotation.format = formatDoc._id;
        quotation.formatKey = formatDoc.formatKey;
      }
    }

    // If items are provided, re-resolve and recalculate all amounts server-side
    if (items && Array.isArray(items)) {
      const { resolvedItems, totals } = await resolveAndCalculateLineItems(items);
      if (resolvedItems.length === 0) {
        return sendError(res, 'A quotation must contain at least one valid line item.', 400);
      }
      quotation.items = resolvedItems;
      quotation.totalGrossAmount = totals.totalGrossAmount;
      quotation.totalDiscountAmount = totals.totalDiscountAmount;
      quotation.totalNetAmount = totals.totalNetAmount;
      quotation.totalGstAmount = totals.totalGstAmount;
      quotation.grandTotal = totals.grandTotal;
    }

    quotation.updatedBy = req.user._id;
    await quotation.save();

    const updatedQuotation = await Quotation.findById(quotation._id)
      .populate('customer', 'customerName mobile email')
      .populate('company', 'companyName companyCode')
      .populate('salesperson', 'name mobile')
      .populate('format', 'formatKey formatName');

    return sendSuccess(res, 'Quotation updated successfully.', updatedQuotation);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send Quotation (Transition DRAFT -> SENT)
 * @route   PUT /api/quotations/:id/send
 * @access  Private (Permission: QUOTATION:approve)
 */
const sendQuotation = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const quotation = await Quotation.findOne(filter);
    if (!quotation) {
      return sendError(res, 'Quotation not found.', 404);
    }

    if (quotation.status !== 'DRAFT') {
      return sendError(res, `Only quotations in DRAFT status can be sent. Current status: ${quotation.status}`, 400);
    }

    quotation.status = 'SENT';
    quotation.updatedBy = req.user._id;
    await quotation.save();

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'QUOTATION',
      actionType: 'APPROVE',
      entityType: 'Quotation',
      entityId: quotation._id,
      entityLabel: `Quotation #${quotation.quotationNumber} sent to customer`,
      changeSummary: { status: { before: 'DRAFT', after: 'SENT' } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Quotation send log error:', err.message));

    return sendSuccess(res, 'Quotation marked as SENT to customer.', quotation);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel Quotation (Soft-delete: isActive: false)
 * @route   PUT /api/quotations/:id/cancel
 * @access  Private (Permission: QUOTATION:delete)
 */
const cancelQuotation = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const quotation = await Quotation.findOne(filter);
    if (!quotation) {
      return sendError(res, 'Quotation not found.', 404);
    }

    quotation.isActive = false;
    quotation.updatedBy = req.user._id;
    await quotation.save();

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'QUOTATION',
      actionType: 'DELETE',
      entityType: 'Quotation',
      entityId: quotation._id,
      entityLabel: `Quotation #${quotation.quotationNumber} cancelled`,
      changeSummary: { isActive: { before: true, after: false } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Quotation cancel log error:', err.message));

    return sendSuccess(res, 'Quotation cancelled successfully. Historical record preserved.', quotation);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Render Quotation in any of the 8 formats on demand
 * @route   GET /api/quotations/:id/render
 * @access  Private (Permission: QUOTATION:view)
 */
const renderQuotation = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const quotation = await Quotation.findOne(filter)
      .populate('customer', 'customerName mobile email city billingAddress shippingAddress gstNumber')
      .populate('company', 'companyName companyCode gstin logo address')
      .populate('salesperson', 'name mobile email')
      .populate('format', 'formatKey formatName');

    if (!quotation) {
      return sendError(res, 'Quotation not found.', 404);
    }

    const requestedFormat = req.query.format || quotation.formatKey || 'STANDARD';
    const renderedData = renderQuotationData(quotation, requestedFormat);

    return sendSuccess(res, `Quotation rendered in format '${renderedData.format}'.`, renderedData);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export Quotation to Excel (.xlsx) or PDF
 * @route   GET /api/quotations/:id/export
 * @access  Private (Permission: QUOTATION:export)
 */
const exportQuotation = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const quotation = await Quotation.findOne(filter)
      .populate('customer', 'customerName mobile email city billingAddress shippingAddress gstNumber')
      .populate('company', 'companyName companyCode gstin logo address')
      .populate('salesperson', 'name mobile email')
      .populate('format', 'formatKey formatName');

    if (!quotation) {
      return sendError(res, 'Quotation not found.', 404);
    }

    const requestedFormat = req.query.format || quotation.formatKey || 'STANDARD';
    const renderedData = renderQuotationData(quotation, requestedFormat);

    const buffer = exportQuotationToExcel(renderedData);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Quotation_${quotation.quotationNumber}_${renderedData.format}.xlsx`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get list of pending quotations
 * @route   GET /api/quotations/pending
 * @access  Private (Permission: QUOTATION:view)
 */
const getPendingQuotations = async (req, res, next) => {
  try {
    const filter = {
      isActive: true,
      status: { $nin: ['CONFIRMED', 'CLOSED', 'REJECTED', 'EXPIRED'] },
      ...(req.scopeFilter || {})
    };

    const pending = await Quotation.find(filter)
      .populate('customer', 'customerName mobile city')
      .populate('company', 'companyName companyCode')
      .populate('salesperson', 'name mobile')
      .sort({ quotationDate: -1 })
      .lean();

    return sendSuccess(res, 'Pending quotations retrieved successfully.', {
      count: pending.length,
      quotations: pending
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Helper to filter Module 2 products by selected company
 * @route   GET /api/quotations/company-products/:companyId
 * @access  Private (Permission: QUOTATION:view)
 */
const getCompanyProducts = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const products = await Product.find({ company: companyId, isActive: true })
      .select('productName companySkuCode vendorSkuCode productImage mrp salePrice gstPct isSkuLess')
      .sort({ companySkuCode: 1, productName: 1 })
      .lean();

    return sendSuccess(res, 'Company products retrieved successfully.', products);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createQuotation,
  listQuotations,
  getQuotationById,
  updateQuotation,
  sendQuotation,
  cancelQuotation,
  renderQuotation,
  exportQuotation,
  getPendingQuotations,
  getCompanyProducts
};
