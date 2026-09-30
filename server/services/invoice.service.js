const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Invoice = require('../models/Invoice');
const InvoiceNumberSequence = require('../models/InvoiceNumberSequence');
const Challan = require('../models/Challan');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const challanService = require('./challan.service');
const { amountToWords } = require('../utils/numberToWords.util');

/**
 * Forward-reference payment check stub (Module 11)
 */
const hasPayments = async (invoiceId) => {
  try {
    const paymentService = require('./payment.service');
    return await paymentService.hasPayments(invoiceId);
  } catch (err) {
    if (mongoose.models.Payment) {
      const payment = await mongoose.models.Payment.findOne({
        'allocations.invoice': invoiceId,
        isActive: true
      });
      return Boolean(payment);
    }
    return false;
  }
};

/**
 * Resolve state name from string or address
 */
const resolveState = (stateValue, addressValue) => {
  if (stateValue && stateValue.trim()) {
    return stateValue.trim();
  }
  if (addressValue && typeof addressValue === 'string') {
    const states = [
      'Gujarat', 'Maharashtra', 'Rajasthan', 'Madhya Pradesh', 'Delhi',
      'Karnataka', 'Tamil Nadu', 'Uttar Pradesh', 'Punjab', 'Haryana',
      'West Bengal', 'Kerala', 'Telangana', 'Andhra Pradesh', 'Bihar',
      'Odisha', 'Assam', 'Goa'
    ];
    for (const st of states) {
      if (new RegExp(`\\b${st}\\b`, 'i').test(addressValue)) {
        return st;
      }
    }
  }
  return null;
};

/**
 * Get eligible, finalized Challans available for invoicing
 */
const getInvoiceableChallans = async (query = {}, scopeFilter = {}) => {
  const filter = {
    status: 'FINALIZED',
    invoiced: false,
    isActive: true,
    ...scopeFilter
  };

  if (query.customerId) {
    filter.customer = query.customerId;
  }
  if (query.confirmationId) {
    filter.confirmation = query.confirmationId;
  }
  if (query.search) {
    const s = { $regex: query.search.trim(), $options: 'i' };
    filter.$or = [
      { challanNumber: s },
      { customerContact: s },
      { deliveryDetails: s },
      { remarks: s }
    ];
  }

  return await Challan.find(filter)
    .populate('customer', 'customerName mobile state city billingAddress shippingAddress gstNumber')
    .populate('confirmation', 'confirmationNumber')
    .populate('salesperson', 'name mobile')
    .populate('items.product', 'productName companySkuCode')
    .populate('items.unit', 'unitCode unitName')
    .sort({ challanDate: -1, createdAt: -1 })
    .lean();
};

/**
 * Create a new Invoice from one or more finalized Challans
 */
const createInvoice = async (data, user) => {
  const {
    customerId,
    challanIds = [],
    consigneeShipTo,
    buyerBillTo,
    referenceNumber,
    referenceDate,
    buyersOrderNumber,
    dispatchDocNumber,
    deliveryNote,
    termsOfPayment,
    termsOfDelivery
  } = data;

  if (!customerId) {
    const err = new Error('Customer ID is required to generate an invoice.');
    err.statusCode = 400;
    throw err;
  }

  if (!Array.isArray(challanIds) || challanIds.length === 0) {
    const err = new Error('At least one Challan ID is required to generate an invoice.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch Customer details
  const customer = await Customer.findOne({ _id: customerId, isActive: true });
  if (!customer) {
    const err = new Error(`Customer not found with ID '${customerId}'.`);
    err.statusCode = 404;
    throw err;
  }

  // 2. Fetch Own Company details for tax determination
  const ownCompany = await Company.findOne({ companyType: 'OWN', isActive: true });
  const companyState = ownCompany ? resolveState(ownCompany.state, ownCompany.address) : 'Gujarat';
  const customerState = resolveState(customer.state, customer.billingAddress || customer.shippingAddress);

  if (!companyState || !customerState) {
    const err = new Error('Customer state is required for tax calculation.');
    err.statusCode = 400;
    throw err;
  }

  const isInterState = companyState.trim().toLowerCase() !== customerState.trim().toLowerCase();

  // 3. Fetch and validate all candidate Challans
  const challans = await Challan.find({
    _id: { $in: challanIds },
    isActive: true
  });

  if (challans.length !== challanIds.length) {
    const err = new Error('One or more specified Challans could not be found.');
    err.statusCode = 404;
    throw err;
  }

  for (const ch of challans) {
    if (ch.status !== 'FINALIZED') {
      const err = new Error(`Challan '${ch.challanNumber}' is not FINALIZED (status: ${ch.status}). Only FINALIZED challans can be invoiced.`);
      err.statusCode = 400;
      throw err;
    }
    if (ch.invoiced) {
      const err = new Error(`Challan '${ch.challanNumber}' has already been invoiced.`);
      err.statusCode = 400;
      throw err;
    }
    if (String(ch.customer) !== String(customerId)) {
      const err = new Error(`Challan '${ch.challanNumber}' belongs to a different customer. Cross-customer invoice consolidation is not allowed.`);
      err.statusCode = 400;
      throw err;
    }
  }

  // 4. Batch fetch referenced Confirmations for pricing snapshot resolution
  const confirmationIds = [...new Set(challans.map((ch) => String(ch.confirmation)).filter(Boolean))];
  const confirmations = await QuotationConfirmation.find({
    _id: { $in: confirmationIds },
    isActive: true
  });
  const confirmationMap = new Map();
  confirmations.forEach((conf) => {
    confirmationMap.set(String(conf._id), conf);
  });

  // 5. Construct invoice items with fresh, independent pricing snapshots
  const invoiceItems = [];
  let subTotal = 0;
  let totalGst = 0;

  for (const ch of challans) {
    const conf = confirmationMap.get(String(ch.confirmation));
    if (!conf) {
      const err = new Error(`Quotation Confirmation for Challan '${ch.challanNumber}' could not be found.`);
      err.statusCode = 404;
      throw err;
    }

    for (const item of ch.items) {
      // Find confirmed item snapshot from confirmation
      let confirmedItem = conf.confirmedItems.id(item.confirmedItem);
      if (!confirmedItem && conf.extraItems) {
        confirmedItem = conf.extraItems.id(item.confirmedItem);
      }

      const rateSnapshot = confirmedItem ? Number(confirmedItem.unitPriceSnapshot) : 0;
      const discountPct = (confirmedItem && Number(confirmedItem.discountPctSnapshot)) || 0;
      const gstPctSnapshot = confirmedItem ? Number(confirmedItem.gstPctSnapshot) : 0;
      const skuCodeSnapshot = item.skuCodeSnapshot || (confirmedItem && confirmedItem.skuCodeSnapshot) || null;
      const descriptionSnapshot = item.productNameSnapshot || (confirmedItem && confirmedItem.productNameSnapshot) || 'Standard Item';
      const quantity = Number(item.quantityToIssue);

      const amount = Math.round(rateSnapshot * quantity * 100) / 100;
      const discountAmount = Math.round(amount * (discountPct / 100) * 100) / 100;
      const netAmount = Math.round((amount - discountAmount) * 100) / 100;
      const gstAmount = Math.round(netAmount * (gstPctSnapshot / 100) * 100) / 100;

      invoiceItems.push({
        sourceChallan: ch._id,
        sourceChallanItemId: item._id,
        product: item.product || (confirmedItem && confirmedItem.product) || null,
        skuCodeSnapshot,
        descriptionSnapshot,
        unit: item.unit,
        quantity,
        rateSnapshot,
        discountPct,
        gstPctSnapshot,
        amount,
        discountAmount,
        netAmount,
        gstAmount
      });

      subTotal += netAmount;
      totalGst += gstAmount;
    }
  }

  subTotal = Math.round(subTotal * 100) / 100;
  totalGst = Math.round(totalGst * 100) / 100;
  const grandTotal = Math.round((subTotal + totalGst) * 100) / 100;
  const amountInWords = amountToWords(grandTotal);

  // 6. Generate atomic sequence invoice number
  const invoiceNumber = await InvoiceNumberSequence.generateNextNumber();

  // 7. Assemble Invoice document
  const invoice = new Invoice({
    invoiceNumber,
    invoiceDate: new Date(),
    customer: customer._id,
    consigneeShipTo: consigneeShipTo ? consigneeShipTo.trim() : (customer.shippingAddress || customer.billingAddress || null),
    buyerBillTo: buyerBillTo ? buyerBillTo.trim() : (customer.customerName || null),
    customerMobile: customer.mobile || customer.alternateNumber || null,
    customerAddress: customer.billingAddress || customer.shippingAddress || customer.city || null,
    customerGstNumber: customer.gstNumber || null,
    referenceNumber: referenceNumber ? referenceNumber.trim() : null,
    referenceDate: referenceDate ? new Date(referenceDate) : null,
    buyersOrderNumber: buyersOrderNumber ? buyersOrderNumber.trim() : null,
    dispatchDocNumber: dispatchDocNumber ? dispatchDocNumber.trim() : null,
    deliveryNote: deliveryNote ? deliveryNote.trim() : null,
    termsOfPayment: termsOfPayment ? termsOfPayment.trim() : null,
    termsOfDelivery: termsOfDelivery ? termsOfDelivery.trim() : null,
    sourceChallans: challans.map((ch) => ch._id),
    sourceConfirmations: confirmationIds,
    items: invoiceItems,
    subTotal,
    totalGst,
    grandTotal,
    amountInWords,
    status: 'ISSUED',
    isActive: true,
    createdBy: user._id
  });

  await invoice.save();

  // 8. Mark referenced Challans as invoiced: true
  for (const ch of challans) {
    await challanService.markInvoiced(ch._id, true);
  }

  // 9. Module 13 Integration: Auto-post DEBIT entry to Customer Ledger
  try {
    const ledgerService = require('./ledger.service');
    await ledgerService.postEntry({
      customerId: invoice.customer,
      entryDate: invoice.invoiceDate,
      particular: `Invoice #${invoice.invoiceNumber}`,
      entryType: 'DEBIT',
      amount: invoice.grandTotal,
      sourceType: 'INVOICE',
      sourceId: invoice._id,
      postedBy: user._id
    });
  } catch (ledgerErr) {
    console.warn('Notice: Ledger posting on invoice creation:', ledgerErr.message);
  }

  return await Invoice.findById(invoice._id)
    .populate('customer', 'customerName mobile city state gstNumber')
    .populate('sourceChallans', 'challanNumber challanDate deliveryDetails')
    .populate('items.product', 'productName companySkuCode')
    .populate('items.unit', 'unitCode unitName')
    .populate('createdBy', 'fullName username');
};

/**
 * List Invoices with filters and pagination
 */
const getInvoices = async (query = {}, scopeFilter = {}) => {
  const filter = { isActive: true, ...scopeFilter };

  if (query.customerId) {
    filter.customer = query.customerId;
  }
  if (query.status) {
    filter.status = query.status.toUpperCase();
  }
  if (query.confirmationId) {
    filter.sourceConfirmations = query.confirmationId;
  }
  if (query.challanId) {
    filter.sourceChallans = query.challanId;
  }

  if (query.from || query.to) {
    filter.invoiceDate = {};
    if (query.from) {
      filter.invoiceDate.$gte = new Date(query.from);
    }
    if (query.to) {
      const toDate = new Date(query.to);
      toDate.setHours(23, 59, 59, 999);
      filter.invoiceDate.$lte = toDate;
    }
  }

  if (query.search) {
    const s = { $regex: query.search.trim(), $options: 'i' };
    filter.$or = [
      { invoiceNumber: s },
      { customerMobile: s },
      { buyerBillTo: s },
      { consigneeShipTo: s },
      { referenceNumber: s },
      { buyersOrderNumber: s },
      { dispatchDocNumber: s }
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    Invoice.find(filter)
      .populate('customer', 'customerName mobile city state gstNumber')
      .populate('sourceChallans', 'challanNumber challanDate')
      .populate('createdBy', 'fullName username')
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Invoice.countDocuments(filter)
  ]);

  return {
    invoices,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get Invoice by ID
 */
const getInvoiceById = async (id, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };

  const invoice = await Invoice.findOne(filter)
    .populate('customer')
    .populate('sourceChallans')
    .populate('sourceConfirmations', 'confirmationNumber confirmationDate')
    .populate('items.product', 'productName companySkuCode mrp')
    .populate('items.unit', 'unitCode unitName')
    .populate('items.sourceChallan', 'challanNumber challanDate')
    .populate('createdBy', 'fullName username')
    .populate('updatedBy', 'fullName username');

  if (!invoice) {
    const err = new Error(`Invoice not found with ID '${id}' or not permitted.`);
    err.statusCode = 404;
    throw err;
  }

  return invoice;
};

/**
 * Update non-monetary header fields of an Invoice
 */
const updateInvoice = async (id, data, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const invoice = await Invoice.findOne(filter);

  if (!invoice) {
    const err = new Error(`Invoice not found with ID '${id}' or not permitted.`);
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === 'CANCELLED') {
    const err = new Error('Cannot update a CANCELLED invoice.');
    err.statusCode = 400;
    throw err;
  }

  const {
    consigneeShipTo,
    buyerBillTo,
    referenceNumber,
    referenceDate,
    buyersOrderNumber,
    dispatchDocNumber,
    deliveryNote,
    termsOfPayment,
    termsOfDelivery
  } = data;

  if (consigneeShipTo !== undefined) invoice.consigneeShipTo = consigneeShipTo ? consigneeShipTo.trim() : null;
  if (buyerBillTo !== undefined) invoice.buyerBillTo = buyerBillTo ? buyerBillTo.trim() : null;
  if (referenceNumber !== undefined) invoice.referenceNumber = referenceNumber ? referenceNumber.trim() : null;
  if (referenceDate !== undefined) invoice.referenceDate = referenceDate ? new Date(referenceDate) : null;
  if (buyersOrderNumber !== undefined) invoice.buyersOrderNumber = buyersOrderNumber ? buyersOrderNumber.trim() : null;
  if (dispatchDocNumber !== undefined) invoice.dispatchDocNumber = dispatchDocNumber ? dispatchDocNumber.trim() : null;
  if (deliveryNote !== undefined) invoice.deliveryNote = deliveryNote ? deliveryNote.trim() : null;
  if (termsOfPayment !== undefined) invoice.termsOfPayment = termsOfPayment ? termsOfPayment.trim() : null;
  if (termsOfDelivery !== undefined) invoice.termsOfDelivery = termsOfDelivery ? termsOfDelivery.trim() : null;

  invoice.updatedBy = user._id;
  await invoice.save();

  return await Invoice.findById(invoice._id)
    .populate('customer', 'customerName mobile city state')
    .populate('createdBy', 'fullName username')
    .populate('updatedBy', 'fullName username');
};

/**
 * Cancel an Invoice (Soft cancel) and reopen source Challans
 */
const cancelInvoice = async (id, user, scopeFilter = {}) => {
  const filter = { _id: id, isActive: true, ...scopeFilter };
  const invoice = await Invoice.findOne(filter);

  if (!invoice) {
    const err = new Error(`Invoice not found with ID '${id}' or not permitted.`);
    err.statusCode = 404;
    throw err;
  }

  if (invoice.status === 'CANCELLED') {
    const err = new Error('Invoice is already CANCELLED.');
    err.statusCode = 400;
    throw err;
  }

  // Check if any payment exists
  const paymentRecorded = await hasPayments(invoice._id);
  if (paymentRecorded) {
    const err = new Error('Cannot cancel invoice: payments have already been recorded against this invoice. Please process a return or credit note.');
    err.statusCode = 400;
    throw err;
  }

  invoice.status = 'CANCELLED';
  invoice.updatedBy = user._id;
  await invoice.save();

  // Reopen source Challans (invoiced: false)
  for (const chId of invoice.sourceChallans) {
    try {
      await challanService.markInvoiced(chId, false);
    } catch (e) {
      console.warn(`Could not reopen challan ${chId}:`, e.message);
    }
  }

  return invoice;
};

/**
 * Generate render-ready Print/Tax Invoice Document structure
 */
const getPrintData = async (id, scopeFilter = {}) => {
  const invoice = await getInvoiceById(id, scopeFilter);
  const ownCompany = await Company.findOne({ companyType: 'OWN', isActive: true });

  const companyState = ownCompany ? resolveState(ownCompany.state, ownCompany.address) : 'Gujarat';
  const customerState = resolveState(invoice.customer?.state, invoice.customerAddress || invoice.customer?.billingAddress) || 'Gujarat';
  const isInterState = companyState.trim().toLowerCase() !== customerState.trim().toLowerCase();

  const printItems = invoice.items.map((item, idx) => {
    const gstPct = item.gstPctSnapshot || 0;
    const halfGstPct = Math.round((gstPct / 2) * 100) / 100;
    const halfGstAmt = Math.round((item.gstAmount / 2) * 100) / 100;

    return {
      srNo: idx + 1,
      sourceChallanId: item.sourceChallan?._id || item.sourceChallan,
      sourceChallanNumber: item.sourceChallan?.challanNumber || 'N/A',
      descriptionOfGoods: item.descriptionSnapshot,
      skuCode: item.skuCodeSnapshot || 'N/A',
      quantity: item.quantity,
      unit: item.unit?.unitCode || item.unit?.unitName || 'PCS',
      rate: item.rateSnapshot,
      discountPct: item.discountPct,
      discountAmount: item.discountAmount,
      amount: item.amount,
      taxableAmount: item.netAmount,
      gstPct: `${gstPct}%`,
      cgstPct: isInterState ? '0%' : `${halfGstPct}%`,
      cgstAmount: isInterState ? 0 : halfGstAmt,
      sgstPct: isInterState ? '0%' : `${halfGstPct}%`,
      sgstAmount: isInterState ? 0 : halfGstAmt,
      igstPct: isInterState ? `${gstPct}%` : '0%',
      igstAmount: isInterState ? item.gstAmount : 0,
      totalGst: item.gstAmount,
      lineTotal: Math.round((item.netAmount + item.gstAmount) * 100) / 100
    };
  });

  return {
    letterhead: {
      companyName: ownCompany?.companyName || 'Maitri Ceramic',
      logo: ownCompany?.logo || null,
      gstNumber: ownCompany?.gstNumber || 'N/A',
      address: ownCompany?.address || 'Morbi, Gujarat',
      state: companyState,
      contactPerson: ownCompany?.contactPerson || '',
      contactMobile: ownCompany?.contactMobile || ''
    },
    header: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      status: invoice.status,
      customerName: invoice.customer?.customerName || invoice.buyerBillTo,
      customerMobile: invoice.customerMobile || invoice.customer?.mobile,
      customerGstNumber: invoice.customerGstNumber || invoice.customer?.gstNumber || 'N/A',
      customerAddress: invoice.customerAddress || invoice.customer?.billingAddress,
      customerState: customerState,
      consigneeShipTo: invoice.consigneeShipTo,
      buyerBillTo: invoice.buyerBillTo,
      referenceNumber: invoice.referenceNumber,
      referenceDate: invoice.referenceDate,
      buyersOrderNumber: invoice.buyersOrderNumber,
      dispatchDocNumber: invoice.dispatchDocNumber,
      deliveryNote: invoice.deliveryNote,
      termsOfPayment: invoice.termsOfPayment,
      termsOfDelivery: invoice.termsOfDelivery,
      isInterState
    },
    items: printItems,
    summary: {
      subTotal: invoice.subTotal,
      totalCgst: isInterState ? 0 : Math.round((invoice.totalGst / 2) * 100) / 100,
      totalSgst: isInterState ? 0 : Math.round((invoice.totalGst / 2) * 100) / 100,
      totalIgst: isInterState ? invoice.totalGst : 0,
      totalGst: invoice.totalGst,
      grandTotal: invoice.grandTotal,
      amountInWords: invoice.amountInWords
    },
    declaration: 'We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
    authorizedSignatory: ownCompany?.companyName || 'Maitri Ceramic'
  };
};

/**
 * Export filtered Invoices to Excel buffer
 */
const exportInvoicesToExcel = async (query = {}, scopeFilter = {}) => {
  const filter = { isActive: true, ...scopeFilter };

  if (query.customerId) filter.customer = query.customerId;
  if (query.status) filter.status = query.status.toUpperCase();

  const invoices = await Invoice.find(filter)
    .populate('customer', 'customerName mobile')
    .populate('createdBy', 'fullName username')
    .sort({ invoiceDate: -1 })
    .lean();

  const exportRows = [];

  invoices.forEach((inv) => {
    (inv.items || []).forEach((it, idx) => {
      exportRows.push({
        'Invoice Number': inv.invoiceNumber,
        'Invoice Date': new Date(inv.invoiceDate).toLocaleDateString('en-IN'),
        'Customer Name': inv.customer?.customerName || inv.buyerBillTo || 'N/A',
        'Customer Mobile': inv.customerMobile || inv.customer?.mobile || 'N/A',
        'Status': inv.status,
        'Item Sr.': idx + 1,
        'Description': it.descriptionSnapshot,
        'SKU': it.skuCodeSnapshot || 'N/A',
        'Quantity': it.quantity,
        'Rate': it.rateSnapshot,
        'Discount %': it.discountPct,
        'Taxable Net Amount': it.netAmount,
        'GST %': it.gstPctSnapshot,
        'GST Amount': it.gstAmount,
        'Grand Total (Invoice)': inv.grandTotal,
        'Amount in Words': inv.amountInWords || '',
        'Created By': inv.createdBy?.fullName || 'N/A'
      });
    });
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

/**
 * =========================================================================
 * FORWARD-REFERENCE SERVICES FOR DOWNSTREAM MODULES (Module 4, 7, 11, 13)
 * =========================================================================
 */

/**
 * Consumed by Module 7: Quotation Confirmation Amount Tracking
 * Returns sum of grandTotal for all active/issued invoices for a confirmation
 */
const getFinalAmount = async (confirmationId) => {
  try {
    const invoices = await Invoice.find({
      sourceConfirmations: confirmationId,
      status: 'ISSUED',
      isActive: true
    });
    return invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
  } catch (err) {
    console.warn('Error in invoiceService.getFinalAmount:', err.message);
    return 0;
  }
};

/**
 * Consumed by Module 4: Customer 360° History
 * Returns array of invoices for the customer
 */
const getByCustomer = async (customerId) => {
  try {
    const invoices = await Invoice.find({
      customer: customerId,
      isActive: true
    }).sort({ invoiceDate: -1, createdAt: -1 }).lean();

    return invoices.map((inv) => ({
      _id: inv._id,
      invoiceNumber: inv.invoiceNumber,
      invoiceDate: inv.invoiceDate,
      grandTotal: inv.grandTotal,
      status: inv.status,
      balanceDue: inv.status === 'ISSUED' ? inv.grandTotal : 0,
      createdAt: inv.createdAt,
      items: (inv.items || []).map((it) => ({
        product: it.product,
        productName: it.descriptionSnapshot,
        quantity: it.quantity,
        totalAmount: it.netAmount + it.gstAmount
      }))
    }));
  } catch (err) {
    console.warn('Error in invoiceService.getByCustomer:', err.message);
    return [];
  }
};

/**
 * Consumed by Module 11 & 13: Payment & Ledger Balance
 */
const getBalanceDue = async (invoiceId) => {
  try {
    const paymentService = require('./payment.service');
    return await paymentService.getBalanceDue(invoiceId);
  } catch (err) {
    const invoice = await Invoice.findOne({ _id: invoiceId, isActive: true });
    if (!invoice) {
      const e = new Error(`Invoice not found with ID '${invoiceId}'.`);
      e.statusCode = 404;
      throw e;
    }
    const paymentReceived = 0;
    const balanceDue = invoice.status === 'ISSUED' ? Math.max(0, invoice.grandTotal - paymentReceived) : 0;
    return {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      grandTotal: invoice.grandTotal,
      paymentReceived,
      balanceDue,
      status: invoice.status
    };
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
  exportInvoicesToExcel,
  getFinalAmount,
  getByCustomer,
  getBalanceDue
};
