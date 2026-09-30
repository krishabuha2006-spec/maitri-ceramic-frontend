const invoiceService = require('../services/invoice.service');
const activityLogService = require('../services/activityLog.service');
const { sendSuccess, sendError } = require('../utils/response.util');

/**
 * @desc    Get eligible, finalized Challans available for invoicing
 * @route   GET /api/invoices/invoiceable-challans
 * @access  Private (Permission: INVOICE:view)
 */
const getInvoiceableChallans = async (req, res, next) => {
  try {
    const challans = await invoiceService.getInvoiceableChallans(req.query, req.scopeFilter);
    return sendSuccess(res, 'Invoiceable challans retrieved successfully.', challans);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new Invoice from finalized Challan(s)
 * @route   POST /api/invoices
 * @access  Private (Permission: INVOICE:create)
 */
const createInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.body, req.user);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'INVOICE',
      actionType: 'CREATE',
      entityType: 'Invoice',
      entityId: invoice._id,
      entityLabel: `Invoice #${invoice.invoiceNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Invoice create log error:', err.message));

    return sendSuccess(res, 'Invoice created and issued successfully.', invoice, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List Invoices with filtering and pagination
 * @route   GET /api/invoices
 * @access  Private (Permission: INVOICE:view)
 */
const getInvoices = async (req, res, next) => {
  try {
    const result = await invoiceService.getInvoices(req.query, req.scopeFilter);
    return sendSuccess(res, 'Invoices retrieved successfully.', result.invoices, 200, result.pagination);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed Invoice by ID
 * @route   GET /api/invoices/:id
 * @access  Private (Permission: INVOICE:view)
 */
const getInvoiceById = async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoiceById(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Invoice retrieved successfully.', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update non-monetary header fields of an Invoice
 * @route   PUT /api/invoices/:id
 * @access  Private (Permission: INVOICE:edit)
 */
const updateInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.params.id, req.body, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'INVOICE',
      actionType: 'UPDATE',
      entityType: 'Invoice',
      entityId: invoice._id,
      entityLabel: `Invoice #${invoice.invoiceNumber}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Invoice update log error:', err.message));

    return sendSuccess(res, 'Invoice header details updated successfully.', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel an Invoice and reopen its source Challans
 * @route   PUT /api/invoices/:id/cancel
 * @access  Private (Permission: INVOICE:delete)
 */
const cancelInvoice = async (req, res, next) => {
  try {
    const invoice = await invoiceService.cancelInvoice(req.params.id, req.user, req.scopeFilter);

    activityLogService.record({
      user: req.user?._id,
      moduleKey: 'INVOICE',
      actionType: 'DELETE',
      entityType: 'Invoice',
      entityId: invoice._id,
      entityLabel: `Invoice #${invoice.invoiceNumber} cancelled`,
      changeSummary: { status: { before: 'ISSUED', after: 'CANCELLED' } },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    }).catch((err) => console.error('[ActivityLog] Invoice cancel log error:', err.message));

    return sendSuccess(res, 'Invoice cancelled successfully and source challans reopened.', invoice);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get render-ready tax invoice printable structure
 * @route   GET /api/invoices/:id/print
 * @access  Private (Permission: INVOICE:view)
 */
const getPrintData = async (req, res, next) => {
  try {
    const printDoc = await invoiceService.getPrintData(req.params.id, req.scopeFilter);
    return sendSuccess(res, 'Tax invoice print data generated successfully.', printDoc);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Export filtered Invoices to Excel
 * @route   GET /api/invoices/export
 * @access  Private (Permission: INVOICE:export)
 */
const exportInvoices = async (req, res, next) => {
  try {
    const buffer = await invoiceService.exportInvoicesToExcel(req.query, req.scopeFilter);

    res.setHeader('Content-Disposition', 'attachment; filename=Invoices_Export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get live balance due and payment received for an invoice
 * @route   GET /api/invoices/:id/balance-due
 * @access  Private (Permission: INVOICE:view)
 */
const getBalanceDue = async (req, res, next) => {
  try {
    const balance = await invoiceService.getBalanceDue(req.params.id);
    return sendSuccess(res, 'Invoice balance due calculated successfully.', balance);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInvoiceableChallans,
  createInvoice,
  getInvoices,
  getInvoiceById,
  updateInvoice,
  cancelInvoice,
  getPrintData,
  exportInvoices,
  getBalanceDue
};

