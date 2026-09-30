const Customer = require('../models/Customer');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');
const {
  getCustomer360History,
  getCustomerOutstandingSummary
} = require('../services/customerHistory.service');
const { exportCustomersToExcel } = require('../services/customerExport.service');

/**
 * Build Mongoose query filter from request query and permission scope
 */
const buildCustomerFilter = (query, scopeFilter = {}) => {
  const filter = { ...scopeFilter };

  // Status Filter (defaults to active unless explicitly requested)
  if (query.isActive !== undefined && query.isActive !== 'all') {
    filter.isActive = query.isActive === 'true' || query.isActive === true;
  } else if (query.isActive === undefined) {
    filter.isActive = true;
  }

  // Customer Type Filter
  if (query.customerType) {
    filter.customerType = query.customerType.toUpperCase();
  }

  // City & State Filters
  if (query.city) {
    filter.city = { $regex: query.city.trim(), $options: 'i' };
  }
  if (query.state) {
    filter.state = { $regex: query.state.trim(), $options: 'i' };
  }

  // Text / Keyword Search
  if (query.search) {
    const searchRegex = { $regex: query.search.trim(), $options: 'i' };
    filter.$or = [
      { customerName: searchRegex },
      { mobile: searchRegex },
      { city: searchRegex },
      { email: searchRegex },
      { gstNumber: searchRegex },
      { reference: searchRegex },
      { referenceBy: searchRegex }
    ];
  }

  return filter;
};

/**
 * @desc    Create a new Customer
 * @route   POST /api/customers
 * @access  Private (Permission: CUSTOMER:create)
 */
const createCustomer = async (req, res, next) => {
  try {
    const {
      customerName,
      mobile,
      alternateNumber,
      email,
      billingAddress,
      shippingAddress,
      city,
      state,
      gstNumber,
      customerType,
      reference,
      referenceBy,
      notes
    } = req.body;

    if (!customerName || !customerName.trim()) {
      return sendError(res, 'Customer name is mandatory.', 400);
    }
    if (!mobile || !mobile.trim()) {
      return sendError(res, 'Mobile number is mandatory.', 400);
    }

    const cleanMobile = mobile.trim();
    const refVal = reference ? reference.trim() : (referenceBy ? referenceBy.trim() : null);

    // Check for duplicate mobile to return soft warning
    const existingMobileCustomer = await Customer.findOne({ mobile: cleanMobile, isActive: true });
    let warningMessage = null;
    if (existingMobileCustomer) {
      warningMessage = `Duplicate mobile warning: An active customer ('${existingMobileCustomer.customerName}') is already registered with mobile number ${cleanMobile}.`;
    }

    const newCustomer = await Customer.create({
      customerName: customerName.trim(),
      mobile: cleanMobile,
      alternateNumber: alternateNumber ? alternateNumber.trim() : null,
      email: email ? email.trim().toLowerCase() : null,
      billingAddress: billingAddress ? billingAddress.trim() : null,
      shippingAddress: shippingAddress ? shippingAddress.trim() : null,
      city: city ? city.trim() : null,
      state: state ? state.trim() : null,
      gstNumber: gstNumber ? gstNumber.trim().toUpperCase() : null,
      customerType: customerType ? customerType.toUpperCase() : 'RETAIL',
      reference: refVal,
      referenceBy: refVal,
      notes: notes ? notes.trim() : null,
      isActive: true,
      createdBy: req.user._id
    });

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CUSTOMER',
      actionType: 'CREATE',
      entityType: 'Customer',
      entityId: newCustomer._id,
      entityLabel: `Customer ${newCustomer.customerName} (${newCustomer.mobile})`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Customer create log error:', err.message));

    const responseData = {
      customer: newCustomer,
      duplicateWarning: warningMessage
    };

    return sendSuccess(
      res,
      warningMessage
        ? `Customer created with duplicate-mobile notice.`
        : 'Customer created successfully.',
      responseData,
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get paginated customer list with filters and dataScope
 * @route   GET /api/customers
 * @access  Private (Permission: CUSTOMER:view)
 */
const listCustomers = async (req, res, next) => {
  try {
    const filter = buildCustomerFilter(req.query, req.scopeFilter);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const sortField = req.query.sortBy || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    const [customers, total] = await Promise.all([
      Customer.find(filter)
        .populate('createdBy', 'fullName username')
        .populate('updatedBy', 'fullName username')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Customer.countDocuments(filter)
    ]);

    return sendSuccess(res, 'Customers retrieved successfully.', {
      customers,
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
 * @desc    Get single customer profile by ID
 * @route   GET /api/customers/:id
 * @access  Private (Permission: CUSTOMER:view)
 */
const getCustomerById = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const customer = await Customer.findOne(filter)
      .populate('createdBy', 'fullName username')
      .populate('updatedBy', 'fullName username');

    if (!customer) {
      return sendError(res, 'Customer not found or not permitted within your data scope.', 404);
    }

    return sendSuccess(res, 'Customer details retrieved successfully.', customer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update customer profile
 * @route   PUT /api/customers/:id
 * @access  Private (Permission: CUSTOMER:edit)
 */
const updateCustomer = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const customer = await Customer.findOne(filter);
    if (!customer) {
      return sendError(res, 'Customer not found or not permitted to edit.', 404);
    }

    const {
      customerName,
      mobile,
      alternateNumber,
      email,
      billingAddress,
      shippingAddress,
      city,
      state,
      gstNumber,
      customerType,
      reference,
      referenceBy,
      notes
    } = req.body;

    const oldCustomer = {
      customerName: customer.customerName,
      mobile: customer.mobile,
      alternateNumber: customer.alternateNumber,
      email: customer.email,
      billingAddress: customer.billingAddress,
      shippingAddress: customer.shippingAddress,
      city: customer.city,
      state: customer.state,
      gstNumber: customer.gstNumber,
      customerType: customer.customerType,
      reference: customer.reference,
      notes: customer.notes
    };

    if (customerName !== undefined) {
      if (!customerName.trim()) return sendError(res, 'Customer name cannot be empty.', 400);
      customer.customerName = customerName.trim();
    }
    if (mobile !== undefined) {
      if (!mobile.trim()) return sendError(res, 'Mobile number cannot be empty.', 400);
      customer.mobile = mobile.trim();
    }
    if (alternateNumber !== undefined) customer.alternateNumber = alternateNumber ? alternateNumber.trim() : null;
    if (email !== undefined) customer.email = email ? email.trim().toLowerCase() : null;
    if (billingAddress !== undefined) customer.billingAddress = billingAddress ? billingAddress.trim() : null;
    if (shippingAddress !== undefined) customer.shippingAddress = shippingAddress ? shippingAddress.trim() : null;
    if (city !== undefined) customer.city = city ? city.trim() : null;
    if (state !== undefined) customer.state = state ? state.trim() : null;
    if (gstNumber !== undefined) customer.gstNumber = gstNumber ? gstNumber.trim().toUpperCase() : null;
    if (customerType !== undefined) customer.customerType = customerType.toUpperCase();
    if (reference !== undefined || referenceBy !== undefined) {
      const refVal = reference !== undefined ? (reference ? reference.trim() : null) : (referenceBy ? referenceBy.trim() : null);
      customer.reference = refVal;
      customer.referenceBy = refVal;
    }
    if (notes !== undefined) customer.notes = notes ? notes.trim() : null;

    customer.updatedBy = req.user._id;
    await customer.save();

    const diff = activityLogService.computeDiff(oldCustomer, customer, Object.keys(oldCustomer));
    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CUSTOMER',
      actionType: 'UPDATE',
      entityType: 'Customer',
      entityId: customer._id,
      entityLabel: `Customer ${customer.customerName} (${customer.mobile})`,
      changeSummary: diff,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Customer update log error:', err.message));

    return sendSuccess(res, 'Customer profile updated successfully.', customer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Deactivate customer (Soft-delete only)
 * @route   PUT /api/customers/:id/deactivate
 * @access  Private (Permission: CUSTOMER:delete)
 */
const deactivateCustomer = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const customer = await Customer.findOne(filter);
    if (!customer) {
      return sendError(res, 'Customer not found or not permitted to delete.', 404);
    }

    customer.isActive = false;
    customer.updatedBy = req.user._id;
    await customer.save();

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'CUSTOMER',
      actionType: 'DELETE',
      entityType: 'Customer',
      entityId: customer._id,
      entityLabel: `Customer ${customer.customerName} deactivated`,
      changeSummary: { isActive: { before: true, after: false } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Customer deactivate log error:', err.message));

    return sendSuccess(res, 'Customer deactivated successfully. Historical records remain intact.', customer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reactivate customer
 * @route   PUT /api/customers/:id/reactivate
 * @access  Private (Permission: CUSTOMER:edit)
 */
const reactivateCustomer = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const customer = await Customer.findOne(filter);
    if (!customer) {
      return sendError(res, 'Customer not found or not permitted to edit.', 404);
    }

    customer.isActive = true;
    customer.updatedBy = req.user._id;
    await customer.save();

    return sendSuccess(res, 'Customer reactivated successfully.', customer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get complete 360° Customer Journey History (Aggregated across forward services)
 * @route   GET /api/customers/:id/history
 * @access  Private (Permission: CUSTOMER:view)
 */
const getCustomerHistory = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    // Find customer (allows viewing history even for deactivated customers)
    const customer = await Customer.findOne(filter)
      .populate('createdBy', 'fullName username')
      .populate('updatedBy', 'fullName username');

    if (!customer) {
      return sendError(res, 'Customer not found or not permitted within your data scope.', 404);
    }

    const history = await getCustomer360History(customer);

    return sendSuccess(res, 'Customer 360° history aggregated successfully.', history);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get quick outstanding financial summary
 * @route   GET /api/customers/:id/outstanding
 * @access  Private (Permission: CUSTOMER:view)
 */
const getCustomerOutstanding = async (req, res, next) => {
  try {
    const filter = { _id: req.params.id, ...(req.scopeFilter || {}) };

    const customer = await Customer.findOne(filter);
    if (!customer) {
      return sendError(res, 'Customer not found or not permitted within your data scope.', 404);
    }

    const summary = await getCustomerOutstandingSummary(customer._id);

    return sendSuccess(res, 'Customer outstanding summary retrieved successfully.', {
      customerId: customer._id,
      customerName: customer.customerName,
      ...summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export filtered customers list to Excel
 * @route   GET /api/customers/export
 * @access  Private (Permission: CUSTOMER:export)
 */
const exportCustomers = async (req, res, next) => {
  try {
    const filter = buildCustomerFilter(req.query, req.scopeFilter);

    const customers = await Customer.find(filter)
      .populate('createdBy', 'fullName username')
      .sort({ customerName: 1 })
      .limit(5000)
      .lean();

    const buffer = exportCustomersToExcel(customers);

    res.setHeader('Content-Disposition', 'attachment; filename=Customers_Export.xlsx');
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCustomer,
  listCustomers,
  getCustomerById,
  updateCustomer,
  deactivateCustomer,
  reactivateCustomer,
  getCustomerHistory,
  getCustomerOutstanding,
  exportCustomers
};
