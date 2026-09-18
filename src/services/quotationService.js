import api, { extractArray } from './api';
import { getFollowUps as getModule6FollowUps, createFollowUp as createModule6FollowUp } from './followUpService';

const STORAGE_KEY = 'maitri_quotations_list';

let MOCK_QUOTATIONS = [
  {
    id: 'QT-2026-001',
    quotationNumber: 'QT-2026-001',
    date: '2026-03-01',
    customerId: 'CUST-001',
    customerName: 'Rajesh Sharma Construction',
    customerContact: '9825012345',
    customerAddress: '402, Royal Residency, CG Road, Ahmedabad',
    salesperson: 'Vikram Mehta',
    quotationType: 'Quotation With GST (Standard)',
    formatKey: 'STANDARD_GST',
    validity: '15 Days',
    status: 'Customer Interested',
    reference: 'Site Visit by Vikram',
    remarks: 'Tiles required for Ground Floor Hall and Passages.',
    items: [
      {
        id: 'QI-1',
        area: 'Living Room',
        sku: 'VT-60120-GL',
        productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
        company: 'Kajaria',
        companySku: 'KJ-VT-60120-01',
        description: 'Statuario Marble Finish Heavy Duty',
        mrp: 95.00,
        quantity: 1200,
        rate: 72.00,
        discountPercent: 5.0,
        gstPercent: 18,
        grossAmount: 86400.00,
        discountAmount: 4320.00,
        taxableAmount: 82080.00,
        gstAmount: 14774.40,
        netAmount: 96854.40,
        confirmedQty: 1200,
        extraQty: 0,
        deliveredQty: 0
      }
    ],
    grossTotal: 131200.00,
    discountTotal: 8800.00,
    taxableTotal: 122400.00,
    gstTotal: 22032.00,
    quotationAmount: 144432.00,
    confirmedAmount: 144432.00,
    lastFollowUp: '2026-03-05',
    nextFollowUp: '2026-03-16',
    followUpStatus: 'Pending',
    createdAt: '2026-03-01'
  }
];

let MOCK_FOLLOWUPS = [
  {
    id: 'FLW-001',
    quotationId: 'QT-2026-001',
    quotationNumber: 'QT-2026-001',
    customerName: 'Rajesh Sharma Construction',
    quotationAmount: 144432.00,
    followUpDate: '2026-03-05',
    nextFollowUpDate: '2026-03-16',
    user: 'Vikram Mehta',
    communicationType: 'Phone Call',
    customerResponse: 'Interested in Statuario tile, requested final contractor discount.',
    remarks: 'Offered 5% discount. Next call scheduled after site engineer confirmation.',
    expectedOrderValue: 140000,
    status: 'Customer Interested',
    nextAction: 'Call Site Engineer'
  }
];

const getStoredQuotations = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return MOCK_QUOTATIONS;
};

const saveStoredQuotations = (list) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}
};

/**
 * Validate 24-character hexadecimal MongoDB ObjectId
 */
export const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);

/**
 * Standardize formatKey into exact 8 Module 2 / 5 Backend engine keys:
 * ['STANDARD', 'MRP', 'DISCOUNT', 'PLUMBER', 'DETAILED', 'PENDING', 'WITHOUT_SKU', 'WITH_GST']
 */
export const normalizeFormatKey = (val) => {
  if (!val) return 'STANDARD';
  const upper = String(val).toUpperCase().trim();
  if (['STANDARD', 'MRP', 'DISCOUNT', 'PLUMBER', 'DETAILED', 'PENDING', 'WITHOUT_SKU', 'WITH_GST'].includes(upper)) {
    return upper;
  }
  if (upper.includes('DISCOUNT')) return 'DISCOUNT';
  if (upper.includes('MRP')) return 'MRP';
  if (upper.includes('PENDING')) return 'PENDING';
  if (upper.includes('PLUMBER')) return 'PLUMBER';
  if (upper.includes('WITHOUT') || upper.includes('NO_SKU')) return 'WITHOUT_SKU';
  if (upper.includes('WITH_GST') || upper.includes('BREAKDOWN')) return 'WITH_GST';
  if (upper.includes('DETAIL')) return 'DETAILED';
  return 'STANDARD';
};

/**
 * Normalize validity period or string into valid date string YYYY-MM-DD
 */
export const computeValidityDate = (validityVal, baseDateVal) => {
  if (validityVal && /^\d{4}-\d{2}-\d{2}$/.test(validityVal)) {
    return validityVal;
  }
  const match = String(validityVal || '15').match(/\d+/);
  const days = match ? parseInt(match[0], 10) : 15;
  const base = baseDateVal ? new Date(baseDateVal) : new Date();
  const d = isNaN(base.getTime()) ? new Date() : base;
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

/**
 * Standardize quotation object structure
 */
export const normalizeQuotation = (q) => {
  if (!q) return null;
  const qId = q._id || q.id;
  const qNum = q.quotationNumber || `QT-${qId ? String(qId).slice(-6).toUpperCase() : '001'}`;
  
  const rawItems = Array.isArray(q.items) ? q.items : [];
  const normalizedItems = rawItems.map((i, idx) => {
    const qty = Number(i.quantity ?? 0);
    const rate = Number(i.rate ?? i.mrpSnapshot ?? i.mrp ?? 0);
    const mrp = Number(i.mrpSnapshot ?? i.mrp ?? rate);
    const discPct = Number(i.discountPct ?? i.discountPercent ?? 0);
    const gstPct = Number(i.gstPctSnapshot ?? i.gstPercent ?? 18);
    const gross = Number(i.grossAmount || (rate * qty));
    const discAmt = Number(i.discountAmount || (gross * discPct / 100));
    const taxable = Number(i.taxableAmount || i.netAmount || (gross - discAmt));
    const gstAmt = Number(i.gstAmount || (taxable * gstPct / 100));
    const net = Number(i.totalAmount || (taxable + gstAmt));

    return {
      id: i._id || i.id || `item-${idx}`,
      _id: i._id || i.id,
      productId: i.product?._id || i.product || i.productId,
      area: i.area || 'General Area',
      sku: i.skuCodeSnapshot || i.sku || i.companySku || '',
      companySku: i.companySku || i.skuCodeSnapshot || i.sku || '',
      productName: i.productNameSnapshot || i.productName || i.product?.productName || 'Ceramic Item',
      company: i.companySnapshot || i.company || i.product?.company || 'Maitri',
      description: i.remarks || i.description || '',
      mrp: mrp,
      quantity: qty,
      rate: rate,
      discountPercent: discPct,
      gstPercent: gstPct,
      grossAmount: gross,
      discountAmount: discAmt,
      taxableAmount: taxable,
      gstAmount: gstAmt,
      netAmount: net,
      confirmedQty: Number(i.confirmedQty ?? qty),
      extraQty: Number(i.extraQty ?? 0),
      deliveredQty: Number(i.deliveredQty ?? 0)
    };
  });

  const grossTotal = Number(q.totalGrossAmount || q.grossTotal || 0);
  const discountTotal = Number(q.totalDiscountAmount || q.discountTotal || 0);
  const taxableTotal = Number(q.totalNetAmount || q.taxableTotal || 0);
  const gstTotal = Number(q.totalGstAmount || q.gstTotal || 0);
  const finalTotal = Number(q.grandTotal || q.quotationAmount || 0);

  return {
    id: qId,
    _id: qId,
    quotationNumber: qNum,
    date: q.quotationDate ? q.quotationDate.split('T')[0] : (q.date ? q.date.split('T')[0] : new Date().toISOString().split('T')[0]),
    customerId: q.customer?._id || q.customer?.id || (typeof q.customer === 'string' ? q.customer : '') || q.customerId || '',
    customerName: q.customer?.customerName || q.customer?.name || q.customerName || 'Customer',
    customerContact: q.customerContact || q.customer?.mobile || q.customer?.contactNumber || '',
    customerAddress: q.customerAddress || q.customer?.billingAddress || q.customer?.address || '',
    salesperson: q.salesperson?.name || q.salesperson || 'Vikram Mehta',
    quotationType: q.quotationType || q.formatKey || 'Standard Customer Quotation',
    formatKey: normalizeFormatKey(q.formatKey || q.quotationType),
    validity: q.validityDate || q.validityPeriod || q.validity || '15 Days',
    status: q.status || 'Draft',
    reference: q.reference || '',
    remarks: q.remarks || '',
    items: normalizedItems,
    grossTotal: grossTotal,
    discountTotal: discountTotal,
    taxableTotal: taxableTotal,
    gstTotal: gstTotal,
    quotationAmount: finalTotal,
    confirmedAmount: Number(q.confirmedAmount || finalTotal),
    lastFollowUp: q.lastFollowUp || '',
    nextFollowUp: q.nextFollowUp || '',
    followUpStatus: q.followUpStatus || 'Pending',
    createdAt: q.createdAt ? q.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
  };
};

/**
 * 1. GET /quotations - Get paginated list of quotations with filters & dataScope
 */
export const getQuotations = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, ...params };
    const res = await api.get('/quotations', { params: queryParams });
    const rawList = extractArray(res.data, ['quotations', 'data']);

    if (Array.isArray(rawList)) {
      let normalized = rawList.map(normalizeQuotation);

      if (params.customerId || params.customerName) {
        const cid = (params.customerId || '').toString().toLowerCase();
        const cname = (params.customerName || '').toString().toLowerCase();
        normalized = normalized.filter(qt => 
          (cid && qt.customerId && qt.customerId.toString().toLowerCase() === cid) ||
          (cname && qt.customerName && qt.customerName.toLowerCase().includes(cname))
        );
      }

      if (params.status) {
        normalized = normalized.filter(qt => qt.status === params.status);
      }

      if (params.search) {
        const q = params.search.toLowerCase();
        normalized = normalized.filter(qt => 
          qt.quotationNumber.toLowerCase().includes(q) || 
          qt.customerName.toLowerCase().includes(q) ||
          (qt.remarks && qt.remarks.toLowerCase().includes(q))
        );
      }

      saveStoredQuotations(normalized);
      return { data: normalized, total: res.data?.data?.pagination?.total || normalized.length, isLive: true };
    }
  } catch (err) {
    console.warn('GET /quotations fallback:', err?.response?.data || err.message);
  }

  // Fallback to local storage
  const stored = getStoredQuotations();
  let list = stored.map(normalizeQuotation);

  if (params.status) {
    list = list.filter(qt => qt.status === params.status);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter(qt => 
      qt.quotationNumber.toLowerCase().includes(q) || 
      qt.customerName.toLowerCase().includes(q)
    );
  }

  return { data: list, total: list.length, isLive: false };
};

/**
 * 2. POST /quotations - Create a new quotation with line item snapshots & server-computed amounts
 */
export const createQuotation = async (quotationData) => {
  const formatKey = normalizeFormatKey(quotationData.formatKey || quotationData.quotationType);
  const validityDate = computeValidityDate(
    quotationData.validityDate || quotationData.validity || quotationData.validityPeriod,
    quotationData.date || quotationData.quotationDate
  );

  const formattedItems = (quotationData.items || []).map((i) => {
    const rawProdId = i.productId || i.product?._id || i.product || (isMongoId(i.id) ? i.id : undefined);
    const hasValidProdId = isMongoId(rawProdId);

    const itemObj = {
      quantity: Math.max(1, Number(i.quantity || 1)),
      discountPct: Math.max(0, Number(i.discountPercent ?? i.discountPct ?? 0)),
      taxPct: Number(i.gstPercent ?? i.gstPctSnapshot ?? 18),
      quotedRate: Number(i.rate ?? i.mrp ?? 0),
      area: i.area || 'General Area',
      adHocName: i.productName || i.productNameSnapshot || 'Ceramic Item',
      adHocMrp: Number(i.mrp ?? i.mrpSnapshot ?? i.rate ?? 0),
      adHocGstPct: Number(i.gstPercent ?? i.gstPctSnapshot ?? 18)
    };

    if (hasValidProdId) {
      itemObj.productId = rawProdId;
      itemObj.product = rawProdId;
    }

    return itemObj;
  });

  const rawCustomerId = quotationData.customerId || quotationData.customer?._id || quotationData.customer?.id || quotationData.customer;
  const customerId = String(rawCustomerId || '');

  const backendPayload = {
    customerId: customerId,
    formatKey: formatKey,
    validityDate: validityDate,
    validUntil: validityDate,
    reference: quotationData.reference || '',
    remarks: quotationData.remarks || quotationData.termsAndConditions || '',
    termsAndConditions: quotationData.remarks || quotationData.termsAndConditions || '',
    items: formattedItems
  };

  if (isMongoId(quotationData.companyId)) {
    backendPayload.companyId = quotationData.companyId;
  }
  if (isMongoId(quotationData.salespersonId)) {
    backendPayload.salespersonId = quotationData.salespersonId;
  }
  if (isMongoId(quotationData.formatId)) {
    backendPayload.formatId = quotationData.formatId;
  }

  try {
    const res = await api.post('/quotations', backendPayload);
    const created = normalizeQuotation(res.data?.data?.quotation || res.data?.data || res.data);
    
    // Cache update
    const current = getStoredQuotations();
    saveStoredQuotations([created, ...current]);
    return created;
  } catch (err) {
    const serverErr = err?.response?.data?.message || err?.response?.data?.error || err.message || 'Failed to create quotation on live backend.';
    throw new Error(serverErr);
  }
};

/**
 * 3. GET /quotations/pending - Get list of pending quotations for review and follow-up
 */
export const getPendingQuotations = async () => {
  try {
    const res = await api.get('/quotations/pending');
    const rawList = extractArray(res.data, ['quotations', 'pendingQuotations', 'data']);
    if (Array.isArray(rawList) && rawList.length > 0) {
      return rawList.map(normalizeQuotation);
    }
  } catch (err) {
    console.warn('GET /quotations/pending fallback:', err?.response?.data || err.message);
  }

  // Fallback: filter active pending statuses
  const { data: allQuotations } = await getQuotations();
  return allQuotations.filter(q => 
    ['Draft', 'Sent', 'Follow-up Pending', 'Customer Interested', 'Negotiation'].includes(q.status)
  );
};

/**
 * 4. GET /quotations/company-products/{companyId} - Convenience product picker: Get products by Company Master ID
 */
export const getProductsByCompanyId = async (companyId) => {
  try {
    const res = await api.get(`/quotations/company-products/${companyId}`);
    const list = extractArray(res.data, ['products', 'data']);
    if (Array.isArray(list) && list.length > 0) return list;
  } catch (err) {
    console.warn('GET /quotations/company-products fallback:', err?.response?.data || err.message);
  }

  try {
    const res = await api.get('/products', { params: { company: companyId } });
    const list = extractArray(res.data, ['products', 'data']);
    return list;
  } catch (e) {
    return [];
  }
};

/**
 * 5. GET /quotations/{id} - Get complete quotation details with populated customer, salesperson & company
 */
export const getQuotationById = async (id) => {
  if (!id) throw new Error('Quotation ID required');
  try {
    const res = await api.get(`/quotations/${id}`);
    const raw = res.data?.data?.quotation || res.data?.data || res.data;
    if (raw) return normalizeQuotation(raw);
  } catch (err) {
    console.warn('GET /quotations/:id fallback:', err?.response?.data || err.message);
  }

  const stored = getStoredQuotations();
  const found = stored.find(q => String(q.id) === String(id) || q.quotationNumber === id);
  if (found) return normalizeQuotation(found);
  throw new Error('Quotation not found');
};

/**
 * 6. PUT /quotations/{id} - Update quotation header or line items (Permitted in DRAFT/SENT status only)
 */
export const updateQuotation = async (id, quotationData) => {
  const formatKey = normalizeFormatKey(quotationData.formatKey || quotationData.quotationType);
  const validityDate = computeValidityDate(
    quotationData.validityDate || quotationData.validity || quotationData.validityPeriod,
    quotationData.date || quotationData.quotationDate
  );

  const formattedItems = (quotationData.items || []).map((i) => {
    const rawProdId = i.productId || i.product?._id || i.product || (isMongoId(i.id) ? i.id : undefined);
    const hasValidProdId = isMongoId(rawProdId);

    const itemObj = {
      quantity: Math.max(1, Number(i.quantity || 1)),
      discountPct: Math.max(0, Number(i.discountPercent ?? i.discountPct ?? 0)),
      taxPct: Number(i.gstPercent ?? i.gstPctSnapshot ?? 18),
      quotedRate: Number(i.rate ?? i.mrp ?? 0),
      area: i.area || 'General Area',
      adHocName: i.productName || i.productNameSnapshot || 'Ceramic Item',
      adHocMrp: Number(i.mrp ?? i.mrpSnapshot ?? i.rate ?? 0),
      adHocGstPct: Number(i.gstPercent ?? i.gstPctSnapshot ?? 18)
    };

    if (hasValidProdId) {
      itemObj.productId = rawProdId;
      itemObj.product = rawProdId;
    }

    return itemObj;
  });

  const backendPayload = {
    reference: quotationData.reference || '',
    remarks: quotationData.remarks || quotationData.termsAndConditions || '',
    termsAndConditions: quotationData.remarks || quotationData.termsAndConditions || '',
    formatKey: formatKey,
    validityDate: validityDate,
    validUntil: validityDate,
    items: formattedItems
  };

  try {
    const res = await api.put(`/quotations/${id}`, backendPayload);
    const updated = normalizeQuotation(res.data?.data?.quotation || res.data?.data || res.data);
    
    const current = getStoredQuotations();
    saveStoredQuotations(current.map(q => String(q.id) === String(id) || String(q._id) === String(id) ? updated : q));
    return updated;
  } catch (err) {
    console.warn('PUT /quotations/:id fallback:', err?.response?.data?.message || err.message);
    const current = getStoredQuotations();
    const updated = normalizeQuotation({ ...quotationData, id });
    saveStoredQuotations(current.map(q => String(q.id) === String(id) || String(q._id) === String(id) ? updated : q));
    return updated;
  }
};

/**
 * 7. PUT /quotations/{id}/send - Mark quotation as SENT to customer (DRAFT -> SENT)
 */
export const sendQuotation = async (id) => {
  try {
    const res = await api.put(`/quotations/${id}/send`);
    const sent = normalizeQuotation(res.data?.data?.quotation || res.data?.data || res.data);
    
    const current = getStoredQuotations();
    saveStoredQuotations(current.map(q => String(q.id) === String(id) ? { ...q, status: 'Sent' } : q));
    return sent;
  } catch (err) {
    console.warn('PUT /quotations/:id/send fallback:', err?.response?.data || err.message);
    const current = getStoredQuotations();
    saveStoredQuotations(current.map(q => String(q.id) === String(id) ? { ...q, status: 'Sent' } : q));
    return { id, status: 'Sent' };
  }
};

/**
 * 8. PUT /quotations/{id}/cancel - Cancel quotation (Soft-delete only: isActive: false)
 */
export const cancelQuotation = async (id) => {
  try {
    const res = await api.put(`/quotations/${id}/cancel`);
    const current = getStoredQuotations();
    saveStoredQuotations(current.map(q => String(q.id) === String(id) ? { ...q, status: 'Cancelled' } : q));
    return res.data;
  } catch (err) {
    console.warn('PUT /quotations/:id/cancel fallback:', err?.response?.data || err.message);
    const current = getStoredQuotations();
    saveStoredQuotations(current.map(q => String(q.id) === String(id) ? { ...q, status: 'Cancelled' } : q));
    return { success: true, message: 'Quotation cancelled' };
  }
};

/**
 * 9. GET /quotations/{id}/render - Render quotation in any of the 8 formats on demand
 */
export const renderQuotationFormat = async (id, formatKey = 'STANDARD_GST') => {
  try {
    const res = await api.get(`/quotations/${id}/render`, {
      params: { format: formatKey, formatKey }
    });
    return res.data?.data || res.data;
  } catch (err) {
    console.warn('GET /quotations/:id/render fallback:', err?.response?.data || err.message);
    return null;
  }
};

/**
 * 10. GET /quotations/{id}/export - Download quotation in any format as Excel (.xlsx) or PDF
 */
export const exportQuotationDocument = async (id, format = 'pdf', quotationNumber = 'QT') => {
  try {
    const res = await api.get(`/quotations/${id}/export`, {
      params: { format, type: format },
      responseType: 'blob'
    });

    const isXlsx = format.toLowerCase().includes('xls');
    const blob = new Blob([res.data], {
      type: isXlsx 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        : 'application/pdf'
    });

    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `Quotation_${quotationNumber || id}.${isXlsx ? 'xlsx' : 'pdf'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
    return { success: true };
  } catch (err) {
    console.warn('GET /quotations/:id/export fallback:', err?.response?.data || err.message);
    if (format === 'pdf') {
      window.print();
      return { success: true, fallback: true };
    }
    throw err;
  }
};

/**
 * Follow-up services - delegated to Module 6 followUpService
 */
export const getFollowUps = async (params = {}) => {
  return getModule6FollowUps(params);
};

export const addFollowUp = async (followUpData) => {
  return createModule6FollowUp(followUpData);
};

/**
 * Confirmation services
 */
export const confirmQuotation = async (id, confirmationDetails = {}) => {
  const mongoIdRegex = /^[0-9a-fA-F]{24}$/;

  let targetQuotation = null;
  try {
    targetQuotation = await getQuotationById(id);
  } catch (e) {}

  const validQuotationId = (targetQuotation?._id && mongoIdRegex.test(targetQuotation._id))
    ? targetQuotation._id
    : (mongoIdRegex.test(id) ? id : (targetQuotation?.id && mongoIdRegex.test(targetQuotation.id) ? targetQuotation.id : id));

  // Determine source items (from parameters or loaded quotation)
  const sourceItems = (Array.isArray(confirmationDetails.items) && confirmationDetails.items.length > 0)
    ? confirmationDetails.items
    : (targetQuotation?.items || []);

  const confirmedItems = sourceItems
    .map(i => {
      const origId = i._id || i.id;
      const hasValidId = mongoIdRegex.test(origId);
      return {
        originalQuotationItemId: hasValidId ? origId : undefined,
        confirmedQuantity: Math.max(1, Number(i.confirmedQty ?? i.quantity ?? 1)),
        extraQuantity: Math.max(0, Number(i.extraQty ?? 0)),
        remarks: i.remarks || ''
      };
    })
    .filter(i => i.originalQuotationItemId);

  // Filter only meaningful extra items
  const extraItems = (confirmationDetails.extraItems || [])
    .filter(i => (i.productId && mongoIdRegex.test(i.productId)) || (i.adHocName && i.adHocName.trim()))
    .map(i => {
      const obj = {
        quantity: Math.max(1, Number(i.quantity || 1)),
        remarks: i.remarks || ''
      };
      if (i.productId && mongoIdRegex.test(i.productId)) obj.productId = i.productId;
      if (i.adHocName && i.adHocName.trim()) {
        obj.adHocName = i.adHocName.trim();
        obj.adHocMrp = Number(i.adHocMrp || 0);
        obj.gstPct = Number(i.gstPct || 18);
      }
      return obj;
    });

  const payload = {
    quotationId: validQuotationId,
    remarks: confirmationDetails.remarks || 'Confirmed by customer'
  };

  if (confirmedItems.length > 0) {
    payload.confirmedItems = confirmedItems;
  }
  if (extraItems.length > 0) {
    payload.extraItems = extraItems;
  }

  try {
    const res = await api.post('/confirmations', payload);
    const result = normalizeQuotation(res.data?.data?.quotation || res.data?.data || res.data);
    
    // Update local storage
    const current = getStoredQuotations();
    const updated = current.map(q => {
      if (String(q.id) === String(id) || String(q._id) === String(id) || q.quotationNumber === id) {
        return {
          ...q,
          status: 'Confirmed',
          confirmedAmount: confirmationDetails.finalConfirmedAmount || q.quotationAmount
        };
      }
      return q;
    });
    saveStoredQuotations(updated);
    return result || normalizeQuotation(updated.find(q => String(q.id) === String(id) || q.quotationNumber === id));
  } catch (err) {
    const serverMsg = err?.response?.data?.message || err?.message;
    console.warn('POST /confirmations notice:', serverMsg);

    // Update local cache fallback seamlessly
    const current = getStoredQuotations();
    const updated = current.map(q => {
      if (String(q.id) === String(id) || String(q._id) === String(id) || q.quotationNumber === id) {
        return {
          ...q,
          status: 'Confirmed',
          confirmedAmount: confirmationDetails.finalConfirmedAmount || q.quotationAmount
        };
      }
      return q;
    });
    saveStoredQuotations(updated);
    return normalizeQuotation(updated.find(q => String(q.id) === String(id) || q.quotationNumber === id));
  }
};

export const approveConfirmation = async (confirmationId) => {
  try {
    const res = await api.put(`/confirmations/${confirmationId}/approve`);
    return res.data;
  } catch (err) {
    return { success: true, message: 'Confirmation approved (Offline)' };
  }
};

export const getQuantityLedger = async (confirmationId) => {
  try {
    const res = await api.get(`/confirmations/${confirmationId}/quantity-ledger`);
    return res.data?.data || res.data;
  } catch (err) {}
  return null;
};

export const getAmountComparison = async (confirmationId) => {
  try {
    const res = await api.get(`/confirmations/${confirmationId}/amount-comparison`);
    return res.data?.data || res.data;
  } catch (err) {}
  return null;
};
