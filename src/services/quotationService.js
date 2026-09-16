import api, { extractArray } from './api';

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
    quotationType: 'Quotation With GST',
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
        netAmount: 96854.40
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

const normalizeQuotation = (q) => {
  return {
    id: q._id || q.id,
    quotationNumber: q.quotationNumber || `QT-${q._id ? q._id.slice(-6).toUpperCase() : '001'}`,
    date: q.quotationDate ? q.quotationDate.split('T')[0] : (q.date || new Date().toISOString().split('T')[0]),
    customerId: q.customer?._id || q.customerId || '',
    customerName: q.customer?.customerName || q.customerName || 'Customer',
    customerContact: q.customerContact || q.customer?.mobile || '',
    customerAddress: q.customerAddress || q.customer?.billingAddress || '',
    salesperson: q.salesperson?.name || q.salesperson || 'Vikram Mehta',
    quotationType: q.formatKey || q.quotationType || 'Quotation With GST',
    validity: q.validityPeriod || q.validity || '15 Days',
    status: q.status || 'Draft',
    reference: q.reference || '',
    remarks: q.remarks || '',
    items: q.items ? q.items.map((i, idx) => ({
      id: i._id || i.id || idx,
      area: i.area || 'General',
      sku: i.skuCodeSnapshot || i.sku || '',
      productName: i.productNameSnapshot || i.productName || 'Product Item',
      company: i.company || 'Maitri',
      companySku: i.companySku || i.skuCodeSnapshot || '',
      description: i.remarks || i.description || '',
      mrp: i.mrpSnapshot || i.mrp || 0,
      quantity: i.quantity || 0,
      rate: i.rate || i.mrpSnapshot || 0,
      discountPercent: i.discountPct || i.discountPercent || 0,
      gstPercent: i.gstPctSnapshot || i.gstPercent || 18,
      grossAmount: i.grossAmount || 0,
      discountAmount: i.discountAmount || 0,
      taxableAmount: i.netAmount || 0,
      gstAmount: i.gstAmount || 0,
      netAmount: (i.netAmount || 0) + (i.gstAmount || 0)
    })) : [],
    grossTotal: q.totalGrossAmount || q.grossTotal || 0,
    discountTotal: q.totalDiscountAmount || q.discountTotal || 0,
    taxableTotal: q.totalNetAmount || q.taxableTotal || 0,
    gstTotal: q.totalGstAmount || q.gstTotal || 0,
    quotationAmount: q.grandTotal || q.quotationAmount || 0,
    confirmedAmount: q.confirmedAmount || q.grandTotal || q.quotationAmount || 0,
    lastFollowUp: q.lastFollowUp || '',
    nextFollowUp: q.nextFollowUp || '',
    followUpStatus: q.followUpStatus || 'Pending',
    createdAt: q.createdAt ? q.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]
  };
};

export const getQuotations = async (params = {}) => {
  try {
    const queryParams = { limit: 1000, page: 1, all: true, ...params };
    const res = await api.get('/quotations', { params: queryParams });
    const rawList = extractArray(res.data, ['quotations']);
    let normalized = rawList.map(normalizeQuotation);

    if (params.customerId || params.customerName) {
      const cid = (params.customerId || '').toString().toLowerCase();
      const cname = (params.customerName || '').toString().toLowerCase();
      normalized = normalized.filter(qt => 
        (cid && qt.customerId && qt.customerId.toString().toLowerCase() === cid) ||
        (cname && qt.customerName && qt.customerName.toLowerCase().includes(cname))
      );
    }

    if (params.search) {
      const q = params.search.toLowerCase();
      normalized = normalized.filter(qt => qt.quotationNumber.toLowerCase().includes(q) || qt.customerName.toLowerCase().includes(q));
    }

    return { data: normalized, total: normalized.length };
  } catch (err) {}

  return { data: [], total: 0 };
};

export const getQuotationById = async (id) => {
  if (!id) throw new Error('Quotation ID required');
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(id);
  if (!isMongoId) {
    const qt = MOCK_QUOTATIONS.find(q => q.id === id || q.quotationNumber === id);
    if (qt) return qt;
  }
  try {
    const res = await api.get(`/quotations/${id}`);
    const raw = res.data?.data?.quotation || res.data?.data || res.data;
    return normalizeQuotation(raw);
  } catch (err) {}
  const qt = MOCK_QUOTATIONS.find(q => q.id === id || q.quotationNumber === id);
  if (!qt) throw new Error('Quotation not found');
  return qt;
};

export const createQuotation = async (quotationData) => {
  try {
    const payload = {
      customer: quotationData.customerId,
      customerContact: quotationData.customerContact,
      customerAddress: quotationData.customerAddress,
      reference: quotationData.reference,
      remarks: quotationData.remarks,
      items: quotationData.items?.map(i => ({
        productNameSnapshot: i.productName,
        skuCodeSnapshot: i.sku,
        area: i.area,
        mrpSnapshot: i.mrp,
        quantity: i.quantity,
        discountPct: i.discountPercent,
        gstPctSnapshot: i.gstPercent
      }))
    };
    const res = await api.post('/quotations', payload);
    return normalizeQuotation(res.data?.data || res.data);
  } catch (err) {
    const newQt = {
      id: `QT-2026-00${MOCK_QUOTATIONS.length + 1}`,
      quotationNumber: `QT-2026-00${MOCK_QUOTATIONS.length + 1}`,
      date: new Date().toISOString().split('T')[0],
      status: quotationData.status || 'Draft',
      ...quotationData,
      createdAt: new Date().toISOString().split('T')[0]
    };
    MOCK_QUOTATIONS.unshift(newQt);
    return newQt;
  }
};

export const updateQuotation = async (id, quotationData) => {
  try {
    const res = await api.put(`/quotations/${id}`, quotationData);
    return normalizeQuotation(res.data?.data || res.data);
  } catch (err) {
    const idx = MOCK_QUOTATIONS.findIndex(q => q.id === id);
    if (idx !== -1) {
      MOCK_QUOTATIONS[idx] = { ...MOCK_QUOTATIONS[idx], ...quotationData };
      return MOCK_QUOTATIONS[idx];
    }
    throw new Error('Quotation not found');
  }
};

export const getFollowUps = async () => {
  try {
    const res = await api.get('/follow-ups');
    const rawList = res.data?.data?.followUps || res.data?.followUps || res.data?.data || res.data || [];
    const normalized = Array.isArray(rawList) ? rawList : [];
    return { data: normalized, total: normalized.length };
  } catch (err) {}
  return { data: MOCK_FOLLOWUPS, total: MOCK_FOLLOWUPS.length };
};

export const addFollowUp = async (followUpData) => {
  try {
    const res = await api.post('/follow-ups', followUpData);
    return res.data;
  } catch (err) {
    const newFlw = {
      id: `FLW-00${MOCK_FOLLOWUPS.length + 1}`,
      ...followUpData,
      followUpDate: followUpData.followUpDate || new Date().toISOString().split('T')[0]
    };
    MOCK_FOLLOWUPS.unshift(newFlw);
    return newFlw;
  }
};

export const confirmQuotation = async (id, confirmationDetails) => {
  try {
    const payload = {
      quotationId: id,
      confirmedItems: confirmationDetails.items?.map(i => ({
        originalQuotationItemId: i.id || i._id,
        confirmedQuantity: Number(i.confirmedQty ?? i.quantity ?? 0),
        extraQuantity: Number(i.extraQty ?? 0),
        remarks: i.remarks || ''
      })),
      extraItems: confirmationDetails.extraItems?.map(i => ({
        productId: i.productId,
        adHocName: i.adHocName,
        adHocMrp: i.adHocMrp,
        quantity: Number(i.quantity || 1),
        remarks: i.remarks || ''
      })),
      remarks: confirmationDetails.remarks || 'Confirmed by customer'
    };
    const res = await api.post('/confirmations', payload);
    return normalizeQuotation(res.data?.data || res.data);
  } catch (err) {
    try {
      const res = await api.post(`/quotations/${id}/confirm`, confirmationDetails);
      return normalizeQuotation(res.data?.data || res.data);
    } catch (fallbackErr) {
      const idx = MOCK_QUOTATIONS.findIndex(q => q.id === id || q.quotationNumber === id);
      if (idx !== -1) {
        MOCK_QUOTATIONS[idx].status = 'Confirmed';
        MOCK_QUOTATIONS[idx].confirmedAmount = confirmationDetails.finalConfirmedAmount || MOCK_QUOTATIONS[idx].quotationAmount;
        return MOCK_QUOTATIONS[idx];
      }
      throw new Error('Quotation not found');
    }
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

// GET /quotations/pending
export const getPendingQuotations = async () => {
  try {
    const { data: allQuotations } = await getQuotations();
    if (Array.isArray(allQuotations) && allQuotations.length > 0) {
      return allQuotations.filter(q => q.status === 'Draft' || q.status === 'Sent' || q.status === 'Follow-up Pending' || q.status === 'Customer Interested');
    }
  } catch (err) {}
  return MOCK_QUOTATIONS.filter(q => q.status === 'Draft' || q.status === 'Customer Interested').map(normalizeQuotation);
};

// GET /quotations/company-products/{companyId}
export const getProductsByCompanyId = async (companyId) => {
  try {
    const res = await api.get(`/quotations/company-products/${companyId}`);
    const list = extractArray(res.data, ['products']);
    return list;
  } catch (err) {}
  return [];
};

// PUT /quotations/{id}/send
export const sendQuotation = async (id) => {
  try {
    const res = await api.put(`/quotations/${id}/send`);
    return normalizeQuotation(res.data?.data || res.data);
  } catch (err) {
    const q = MOCK_QUOTATIONS.find(x => x.id === id);
    if (q) q.status = 'Sent';
    return q;
  }
};

// PUT /quotations/{id}/cancel
export const cancelQuotation = async (id) => {
  try {
    const res = await api.put(`/quotations/${id}/cancel`);
    return res.data;
  } catch (err) {
    const q = MOCK_QUOTATIONS.find(x => x.id === id);
    if (q) q.status = 'Cancelled';
    return { success: true };
  }
};

// GET /quotations/{id}/render
export const renderQuotationFormat = async (id, formatKey = 'WITH_GST') => {
  try {
    const res = await api.get(`/quotations/${id}/render`, { params: { format: formatKey } });
    return res.data?.data || res.data;
  } catch (err) {}
  return null;
};

// GET /quotations/{id}/export
export const exportQuotationDocument = async (id, format = 'pdf') => {
  try {
    const res = await api.get(`/quotations/${id}/export`, { params: { format }, responseType: 'blob' });
    return res.data;
  } catch (err) {}
};

