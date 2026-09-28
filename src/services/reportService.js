import api, { extractArray } from './api';
import { getCustomers } from './customerService';
import { getQuotations } from './quotationService';
import { getProducts } from './productService';
import { getInvoices } from './invoiceService';
import { getPayments } from './paymentService';
import { getChallans } from './challanService';
import { getReturns } from './returnService';

export const REPORT_CATEGORIES = {
  CUSTOMER: 'Customer Reports',
  QUOTATION: 'Quotation Reports',
  PRODUCT: 'Product Reports',
  STOCK: 'Stock Reports',
  FINANCIAL: 'Sales & Financial Reports'
};

export const REPORT_TYPES = [
  // --- 1. Customer Reports ---
  { 
    id: 'CUSTOMER_LIST', 
    category: REPORT_CATEGORIES.CUSTOMER, 
    title: 'Customer List', 
    description: 'Complete directory of all registered customers with contact details, city, and tax registrations', 
    endpoint: '/reports/customers/list' 
  },
  { 
    id: 'CUSTOMER_HISTORY', 
    category: REPORT_CATEGORIES.CUSTOMER, 
    title: 'Customer 360 History', 
    description: 'Comprehensive 360° transactional history (Quotations, Invoices, Payments, Challans, and Returns)', 
    endpoint: '/reports/customers/:id/history', 
    requiresCustomer: true 
  },
  { 
    id: 'CUSTOMER_PURCHASE_HISTORY', 
    category: REPORT_CATEGORIES.CUSTOMER, 
    title: 'Customer Purchase History', 
    description: 'Itemized product purchases and quotation orders placed by the selected customer', 
    endpoint: '/reports/customers/:id/purchase-history', 
    requiresCustomer: true 
  },
  { 
    id: 'CUSTOMER_OUTSTANDING', 
    category: REPORT_CATEGORIES.CUSTOMER, 
    title: 'Customer Outstanding', 
    description: 'Pending receivable balances and dues summary grouped per customer', 
    endpoint: '/reports/customers/outstanding' 
  },
  { 
    id: 'CUSTOMER_LEDGER', 
    category: REPORT_CATEGORIES.CUSTOMER, 
    title: 'Customer Ledger', 
    description: 'Chronological debit and credit ledger statement with running balance', 
    endpoint: '/reports/customers/:id/ledger', 
    requiresCustomer: true 
  },

  // --- 2. Quotation Reports ---
  { 
    id: 'QUOTATION_ALL', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'All Quotations', 
    description: 'Full registry of all issued quotations with customer details, value, and current status', 
    endpoint: '/reports/quotations/all' 
  },
  { 
    id: 'QUOTATION_PENDING', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Pending Quotations', 
    description: 'Quotations currently in Draft, Sent, or Follow-up pending stage requiring action', 
    endpoint: '/reports/quotations/pending' 
  },
  { 
    id: 'QUOTATION_FOLLOWUP_PENDING', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Follow-Up Pending', 
    description: 'Quotations awaiting scheduled follow-up outreach with client remarks', 
    endpoint: '/reports/quotations/followup-pending' 
  },
  { 
    id: 'QUOTATION_FOLLOWUP_DUE', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Follow-Up Due', 
    description: 'Quotations with upcoming or passed follow-up deadlines needing urgent contact', 
    endpoint: '/reports/quotations/followup-due' 
  },
  { 
    id: 'QUOTATION_CONFIRMED', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Confirmed Quotations', 
    description: 'Quotations successfully confirmed and approved by clients for order execution', 
    endpoint: '/reports/quotations/confirmed' 
  },
  { 
    id: 'QUOTATION_REJECTED', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Rejected Quotations', 
    description: 'Quotations rejected or declined by customers with recorded lost reasons', 
    endpoint: '/reports/quotations/rejected' 
  },
  { 
    id: 'QUOTATION_EXPIRED', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Expired Quotations', 
    description: 'Quotations past validity date that were not confirmed within timeframe', 
    endpoint: '/reports/quotations/expired' 
  },
  { 
    id: 'QUOTATION_CONVERSION', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Quotation Conversion', 
    description: 'Key performance metrics, conversion ratios, and win/loss rates', 
    endpoint: '/reports/quotations/conversion' 
  },
  { 
    id: 'QUOTATION_AMOUNT_VS_ACTUAL', 
    category: REPORT_CATEGORIES.QUOTATION, 
    title: 'Quotation Amount vs Actual Amount', 
    description: 'Variance analysis comparing original quoted amounts against final confirmed amounts', 
    endpoint: '/reports/quotations/amount-vs-actual' 
  },

  // --- 3. Product Reports ---
  { 
    id: 'PRODUCT_MASTER', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Product Master', 
    description: 'Complete inventory product directory with SKU codes, brand, group, and MRP/Sale pricing', 
    endpoint: '/reports/products/master' 
  },
  { 
    id: 'PRODUCT_QUOTATION_COUNT', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Product-wise Quotation Count', 
    description: 'Frequency of individual ceramic products quoted across customer inquiries', 
    endpoint: '/reports/products/quotation-count' 
  },
  { 
    id: 'PRODUCT_CUSTOMER_LIST', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Product-wise Customer List', 
    description: 'List of customers who have inquired or purchased specific ceramic tile items', 
    endpoint: '/reports/products/customer-list' 
  },
  { 
    id: 'PRODUCT_QUOTATION_VALUE', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Product-wise Quotation Value', 
    description: 'Total revenue and value generated by product lines across quotations', 
    endpoint: '/reports/products/quotation-value' 
  },
  { 
    id: 'PRODUCT_STOCK', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Product Stock', 
    description: 'Opening, current actual stock, and reorder warning indicators per product', 
    endpoint: '/reports/products/stock' 
  },
  { 
    id: 'PRODUCT_LOW_STOCK', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Low Stock', 
    description: 'Products that have reached or fallen below minimum safety reorder thresholds', 
    endpoint: '/reports/products/low-stock' 
  },
  { 
    id: 'PRODUCT_REORDER_ITEMS', 
    category: REPORT_CATEGORIES.PRODUCT, 
    title: 'Reorder Items', 
    description: 'Critical procurement recommendations for replenishing warehouse inventory', 
    endpoint: '/reports/products/reorder-items' 
  },

  // --- 4. Stock Reports ---
  { 
    id: 'STOCK_OPENING', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Opening Stock', 
    description: 'Baseline opening stock registered at fiscal year / inventory commencement', 
    endpoint: '/reports/stock/opening' 
  },
  { 
    id: 'STOCK_IN', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Stock In', 
    description: 'Inward purchase receipts, supplier deliveries, and return additions to stock', 
    endpoint: '/reports/stock/in' 
  },
  { 
    id: 'STOCK_OUT', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Stock Out', 
    description: 'Outward deliveries, sales shipments, and sample deductions from inventory', 
    endpoint: '/reports/stock/out' 
  },
  { 
    id: 'STOCK_CHALLAN_DEDUCTION', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Challan-wise Stock Deduction', 
    description: 'Inventory quantities dispatched and deducted through delivery challans', 
    endpoint: '/reports/stock/challan-deduction' 
  },
  { 
    id: 'STOCK_ACTUAL', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Actual Stock', 
    description: 'Physical warehouse godown stock verified against inventory counts', 
    endpoint: '/reports/stock/actual' 
  },
  { 
    id: 'STOCK_MANAGEMENT', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Management Stock', 
    description: 'Comparison of physical warehouse stock vs internal management reserve stock', 
    endpoint: '/reports/stock/management' 
  },
  { 
    id: 'STOCK_MOVEMENT_HISTORY', 
    category: REPORT_CATEGORIES.STOCK, 
    title: 'Stock Movement History', 
    description: 'Granular log of all physical Inward & Outward stock transactions with running balances', 
    endpoint: '/reports/stock/movement-history' 
  },

  // --- 5. Sales & Financial Reports ---
  { 
    id: 'FINANCE_INVOICES', 
    category: REPORT_CATEGORIES.FINANCIAL, 
    title: 'Invoice Report', 
    description: 'Complete tax invoice book with subtotal, GST amounts, paid totals, and balance due', 
    endpoint: '/reports/finance/invoices' 
  },
  { 
    id: 'FINANCE_PAYMENT_COLLECTION', 
    category: REPORT_CATEGORIES.FINANCIAL, 
    title: 'Payment Collection', 
    description: 'Detailed payment collections categorized by payment mode (NEFT, UPI, Cash, Cheque)', 
    endpoint: '/reports/finance/payment-collection' 
  },
  { 
    id: 'FINANCE_PAYMENT_RECEIPTS', 
    category: REPORT_CATEGORIES.FINANCIAL, 
    title: 'Payment Receipts', 
    description: 'Official money receipts issued to customers for ledger reconciliation', 
    endpoint: '/reports/finance/payment-receipts' 
  },
  { 
    id: 'FINANCE_OUTSTANDING', 
    category: REPORT_CATEGORIES.FINANCIAL, 
    title: 'Outstanding Report', 
    description: 'Pending client balances with invoice linkages and payment timelines', 
    endpoint: '/reports/finance/outstanding' 
  },
  { 
    id: 'FINANCE_CUSTOMER_LEDGER', 
    category: REPORT_CATEGORIES.FINANCIAL, 
    title: 'Customer Ledger', 
    description: 'Multi-customer financial ledger statement with all debit and credit entries', 
    endpoint: '/reports/finance/customer-ledger' 
  },
  { 
    id: 'FINANCE_CREDIT_DEBIT', 
    category: REPORT_CATEGORIES.FINANCIAL, 
    title: 'Credit/Debit Report', 
    description: 'Detailed debits (invoices) vs credits (payments) audit sheet with balance verification', 
    endpoint: '/reports/finance/credit-debit' 
  }
];

/**
 * Fetch report catalog from backend or fallback to definition
 */
export const getReportCatalog = async () => {
  try {
    const res = await api.get('/reports/catalog');
    const data = res.data?.data || res.data;
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch (err) {
    // Graceful fallback
  }
  return REPORT_TYPES;
};

// Default fallback columns for empty datasets per category/report
const getDefaultColumnsForReport = (reportId) => {
  const r = (reportId || '').toUpperCase();
  if (r.startsWith('CUSTOMER')) {
    return {
      columns: ['Customer Name', 'Mobile', 'Email', 'City', 'State', 'Customer Type', 'GSTIN', 'Outstanding (₹)'],
      keys: ['customerName', 'mobile', 'email', 'city', 'state', 'customerType', 'gstNumber', 'outstandingAmount']
    };
  }
  if (r.startsWith('QUOTATION')) {
    return {
      columns: ['Quotation No.', 'Customer Name', 'Mobile', 'Salesperson', 'Date', 'Status', 'Items', 'Grand Total (₹)'],
      keys: ['quotationNumber', 'customerName', 'customerMobile', 'salespersonName', 'quotationDate', 'status', 'totalItems', 'grandTotal']
    };
  }
  if (r.startsWith('PRODUCT')) {
    return {
      columns: ['Product Name', 'SKU', 'Category', 'Unit', 'Sale Price (₹)', 'Actual Stock', 'Reorder Level', 'Status'],
      keys: ['productName', 'sku', 'category', 'unit', 'salePrice', 'actualStock', 'reorderLevel', 'status']
    };
  }
  if (r.startsWith('STOCK')) {
    return {
      columns: ['Date', 'Product Name', 'SKU', 'Movement Type', 'Voucher Ref', 'Quantity', 'Unit', 'Balance'],
      keys: ['date', 'productName', 'sku', 'movementType', 'referenceNo', 'quantity', 'unit', 'balance']
    };
  }
  if (r.startsWith('FINANCE')) {
    return {
      columns: ['Date', 'Voucher No.', 'Customer Name', 'Transaction Type', 'Payment Mode', 'Debit (₹)', 'Credit (₹)', 'Status'],
      keys: ['date', 'voucherNumber', 'customerName', 'type', 'paymentMode', 'debit', 'credit', 'status']
    };
  }
  return {
    columns: ['Reference', 'Name / Particulars', 'Date', 'Details', 'Amount (₹)', 'Status'],
    keys: ['ref', 'name', 'date', 'details', 'amount', 'status']
  };
};

/**
 * Download backend-generated Excel report stream
 */
export const exportBackendExcel = async (reportEndpoint, params = {}) => {
  let targetUrl = reportEndpoint || '';
  if (targetUrl.startsWith('/api/')) {
    targetUrl = targetUrl.replace(/^\/api/, '');
  }
  if (targetUrl.includes(':id') || targetUrl.includes('{id}')) {
    const custId = params.id || params.customerId;
    if (custId) {
      targetUrl = targetUrl.replace(':id', custId).replace('{id}', custId);
    } else {
      throw new Error('Please select a customer for this report before exporting.');
    }
  }

  const res = await api.get(targetUrl, {
    params: { ...params, format: 'excel', limit: 500 },
    responseType: 'blob'
  });

  return res.data;
};

/**
 * Fetch dynamic report data from live backend with robust local fallbacks
 */
export const getReportData = async (reportId, params = {}) => {
  const meta = REPORT_TYPES.find(r => r.id === reportId || r.id === (reportId || '').toUpperCase() || r.key === reportId);
  const endpoint = meta?.endpoint || '';

  let targetUrl = endpoint;
  const custId = params.id || params.customerId;

  if (targetUrl.startsWith('/api/')) {
    targetUrl = targetUrl.replace(/^\/api/, '');
  }

  if (targetUrl && (targetUrl.includes(':id') || targetUrl.includes('{id}'))) {
    if (custId) {
      targetUrl = targetUrl.replace(':id', custId).replace('{id}', custId);
    } else {
      targetUrl = null;
    }
  }

  const queryParams = { 
    limit: 500, 
    page: 1,
    ...params 
  };

  // 1. Live Backend Request
  if (targetUrl) {
    try {
      const res = await api.get(targetUrl, { params: queryParams });
      const payload = res.data?.data || res.data;

      if (payload) {
        // A. Customer 360 History Dossier Response
        if (payload.profile && (payload.salesHistory || payload.financialHistory)) {
          const p = payload.profile;
          const f = payload.financialHistory || {};
          const s = payload.salesHistory || {};

          // Flatten into structured timeline rows
          const rows = [];
          (s.quotations || []).forEach(q => {
            rows.push({
              c1: (q.quotationDate || q.createdAt || '').split('T')[0],
              c2: 'Quotation',
              c3: q.quotationNumber || '-',
              c4: `Items: ${(q.items || []).length}`,
              c5: `₹${Number(q.grandTotal || 0).toLocaleString('en-IN')}`,
              c6: q.status || 'SENT'
            });
          });
          (s.invoices || []).forEach(i => {
            rows.push({
              c1: (i.invoiceDate || i.createdAt || '').split('T')[0],
              c2: 'Invoice',
              c3: i.invoiceNumber || '-',
              c4: `Due: ₹${Number(i.balanceDue || 0).toLocaleString('en-IN')}`,
              c5: `₹${Number(i.grandTotal || 0).toLocaleString('en-IN')}`,
              c6: i.paymentStatus || 'PENDING'
            });
          });
          (s.payments || []).forEach(pay => {
            rows.push({
              c1: (pay.paymentDate || pay.createdAt || '').split('T')[0],
              c2: 'Payment',
              c3: pay.receiptNumber || pay.paymentNumber || '-',
              c4: `Mode: ${pay.paymentMode?.modeName || pay.paymentMode || 'NEFT'}`,
              c5: `₹${Number(pay.totalAmount || pay.amount || 0).toLocaleString('en-IN')}`,
              c6: 'RECEIVED'
            });
          });

          rows.sort((a, b) => new Date(b.c1) - new Date(a.c1));

          return {
            reportId,
            generatedAt: new Date().toISOString(),
            summary: {
              totalRecords: rows.length,
              totalQuotedValue: f.totalQuotationValue,
              actualConvertedValue: f.actualConvertedValue,
              totalInvoiceValue: f.totalInvoiceValue,
              totalPaidAmount: f.totalPaymentReceived,
              totalOutstanding: f.outstanding
            },
            columns: ['Date', 'Transaction Type', 'Voucher / Doc No', 'Particulars / Details', 'Amount (₹)', 'Status'],
            keys: ['date', 'type', 'ref', 'details', 'amount', 'status'],
            customer360Data: payload,
            rawRecords: rows,
            rows
          };
        }

        // B. Customer Purchase History / Product List
        if (payload.productHistory && Array.isArray(payload.productHistory)) {
          const pList = payload.productHistory;
          const rows = pList.map(item => ({
            c1: item.productName || item.name || 'Ceramic Item',
            c2: String(item.totalQuantity || item.quantity || 0),
            c3: item.unit || 'Sq.Ft',
            c4: `₹${Number(item.totalAmount || item.amount || 0).toLocaleString('en-IN')}`,
            c5: '-',
            c6: 'PURCHASED'
          }));

          return {
            reportId,
            generatedAt: new Date().toISOString(),
            summary: {
              totalRecords: rows.length,
              grandTotal: pList.reduce((sum, i) => sum + (Number(i.totalAmount || i.amount) || 0), 0)
            },
            columns: ['Product Name', 'Total Quantity Purchased', 'Unit', 'Total Purchase Value (₹)', 'Remarks', 'Status'],
            keys: ['productName', 'quantity', 'unit', 'totalAmount', 'remarks', 'status'],
            rawRecords: pList,
            rows
          };
        }

        // C. Quotation Conversion Report format
        if (payload.summary && (payload.summary.totalQuotations !== undefined || payload.summary.conversionRateValuePct !== undefined)) {
          const s = payload.summary;
          const rows = [
            { metric: 'Total Quotations Issued', count: s.totalQuotations || 0, value: `₹${(s.totalQuotedValue || 0).toLocaleString('en-IN')}` },
            { metric: 'Confirmed Orders', count: s.confirmedCount || 0, value: `₹${(s.confirmedValue || 0).toLocaleString('en-IN')}` },
            { metric: 'Pending Inquiries', count: s.pendingCount || 0, value: '-' },
            { metric: 'Rejected Quotations', count: s.rejectedCount || 0, value: '-' },
            { metric: 'Expired Quotations', count: s.expiredCount || 0, value: '-' },
            { metric: 'Conversion Rate (Value)', count: `${s.conversionRateValuePct || 0}%`, value: `${s.conversionRateCountPct || 0}% (Count Rate)` }
          ];

          return {
            reportId,
            generatedAt: new Date().toISOString(),
            summary: s,
            columns: ['KPI Metric', 'Count / Frequency', 'Total Value'],
            keys: ['metric', 'count', 'value'],
            rawRecords: rows,
            rows: rows.map(r => ({
              c1: r.metric,
              c2: r.count,
              c3: r.value,
              c4: '-',
              c5: '-',
              c6: '-'
            }))
          };
        }

        // D. Standard Table / List Array Response
        const rawList = Array.isArray(payload.data) ? payload.data : (Array.isArray(payload) ? payload : (payload.items || payload.rows || payload.records || null));
        const summary = payload.summary || (payload.pagination ? { totalRecords: payload.pagination.totalRecords } : null);

        if (Array.isArray(rawList)) {
          if (rawList.length === 0) {
            const defaults = getDefaultColumnsForReport(reportId);
            return {
              reportId,
              generatedAt: new Date().toISOString(),
              summary: summary || { totalRecords: 0 },
              columns: defaults.columns,
              keys: defaults.keys,
              rawRecords: [],
              rows: []
            };
          }

          const firstRow = rawList[0];
          const ignoredKeys = new Set([
            '_id', 'id', '__v', 
            'customerId', 'productId', 'quotationId', 'invoiceId', 
            'paymentId', 'challanId', 'confirmationId', 'entryId', 'jobId'
          ]);
          let keys = Object.keys(firstRow).filter(k => !ignoredKeys.has(k));
          if (keys.length === 0) {
            keys = Object.keys(firstRow);
          }

          const formatColName = (k) => {
            const special = {
              customerName: 'Customer Name',
              customerMobile: 'Mobile',
              mobile: 'Mobile',
              email: 'Email',
              city: 'City',
              state: 'State',
              customerType: 'Customer Type',
              gstNumber: 'GSTIN',
              quotationNumber: 'Quotation No.',
              salespersonName: 'Salesperson',
              quotationDate: 'Date',
              totalItems: 'Total Items',
              subTotal: 'Subtotal (₹)',
              totalTax: 'Tax (₹)',
              grandTotal: 'Grand Total (₹)',
              outstandingAmount: 'Outstanding (₹)',
              productName: 'Product Name',
              sku: 'SKU',
              currentStock: 'Current Stock',
              actualStock: 'Actual Stock',
              availableStock: 'Available Stock',
              managementStock: 'Management Stock',
              reorderLevel: 'Reorder Level',
              reorderPoint: 'Reorder Point',
              reorderAlertQty: 'Reorder Alert Qty',
              invoiceNumber: 'Invoice No.',
              invoiceDate: 'Invoice Date',
              balanceDue: 'Balance Due (₹)',
              paymentDate: 'Payment Date',
              paymentMode: 'Payment Mode',
              receiptNumber: 'Receipt No.',
              createdAt: 'Created Date',
              updatedAt: 'Updated Date'
            };
            if (special[k]) return special[k];
            return k
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase())
              .replace(/Pct/g, '%')
              .replace(/Qty/g, 'Quantity')
              .replace(/Amount/g, 'Amount (₹)')
              .replace(/Total/g, 'Total (₹)');
          };

          return {
            reportId,
            generatedAt: new Date().toISOString(),
            summary: summary || { totalRecords: rawList.length },
            columns: keys.map(formatColName),
            keys,
            rawRecords: rawList,
            rows: rawList.map(item => {
              const mapped = {};
              keys.forEach((k, idx) => {
                let val = item[k];
                if (val === null || val === undefined) val = '-';
                else if (typeof val === 'boolean') val = val ? 'Yes' : 'No';
                else if (typeof val === 'number') {
                  const kLower = k.toLowerCase();
                  if (kLower.includes('total') || kLower.includes('amount') || kLower.includes('price') || kLower.includes('balance') || kLower.includes('mrp') || kLower.includes('debit') || kLower.includes('credit') || kLower.includes('value') || kLower.includes('outstanding') || kLower.includes('subtotal') || kLower.includes('tax')) {
                    val = `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
                  } else {
                    val = String(val);
                  }
                } else if (typeof val === 'string' && (k.toLowerCase().includes('date') || k.toLowerCase().includes('at')) && val.includes('T')) {
                  val = val.split('T')[0];
                }
                mapped[`c${idx + 1}`] = val;
              });
              return mapped;
            })
          };
        }
      }
    } catch (err) {
      console.warn(`Live endpoint ${targetUrl} fallback to local aggregation:`, err?.message);
    }
  }

  // 2. Client-Side Aggregation Fallback (Offline Data Resiliency)
  try {
    // CUSTOMER 360 HISTORY DOSSIER
    if (reportId === 'CUSTOMER_HISTORY') {
      const [
        { data: customers },
        { data: quotations },
        { data: invoices },
        { data: payments }
      ] = await Promise.all([
        getCustomers().catch(() => ({ data: [] })),
        getQuotations().catch(() => ({ data: [] })),
        getInvoices().catch(() => ({ data: [] })),
        getPayments().catch(() => ({ data: [] }))
      ]);

      const custList = Array.isArray(customers) ? customers : [];
      const cust = custList.find(c => (c._id || c.id) === custId) || custList[0] || {};
      const actualCustId = cust._id || cust.id || custId;

      const qList = (Array.isArray(quotations) ? quotations : []).filter(q => q.customerId === actualCustId || (q.customer && (q.customer._id === actualCustId || q.customer.id === actualCustId)));
      const iList = (Array.isArray(invoices) ? invoices : []).filter(i => i.customerId === actualCustId || (i.customer && (i.customer._id === actualCustId || i.customer.id === actualCustId)));
      const pList = (Array.isArray(payments) ? payments : []).filter(p => p.customerId === actualCustId || (p.customer && (p.customer._id === actualCustId || p.customer.id === actualCustId)));

      const totalQuoted = qList.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);
      const convertedOrders = qList.filter(q => q.status === 'CONFIRMED' || q.status === 'Closed');
      const totalConverted = convertedOrders.reduce((sum, q) => sum + (Number(q.grandTotal) || 0), 0);
      const totalInvoiced = iList.reduce((sum, i) => sum + (Number(i.grandTotal) || 0), 0);
      const totalPaid = pList.reduce((sum, p) => sum + (Number(p.amountPaid || p.totalAmount || p.amount) || 0), 0);
      const outstanding = Math.max(0, totalInvoiced - totalPaid);

      const timeline = [];
      qList.forEach(q => {
        timeline.push({
          c1: (q.quotationDate || q.createdAt || '').split('T')[0] || '-',
          c2: 'Quotation',
          c3: q.quotationNumber || '-',
          c4: `Items: ${(q.items || []).length || 1}`,
          c5: `₹${Number(q.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: q.status || 'SENT'
        });
      });
      iList.forEach(i => {
        timeline.push({
          c1: (i.invoiceDate || i.createdAt || '').split('T')[0] || '-',
          c2: 'Invoice',
          c3: i.invoiceNumber || '-',
          c4: `Due: ₹${Number(i.balanceDue || 0).toLocaleString('en-IN')}`,
          c5: `₹${Number(i.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: i.paymentStatus || 'PENDING'
        });
      });
      pList.forEach(p => {
        timeline.push({
          c1: (p.paymentDate || p.createdAt || '').split('T')[0] || '-',
          c2: 'Payment',
          c3: p.receiptNumber || p.paymentNumber || '-',
          c4: `Mode: ${p.paymentMode?.modeName || p.paymentMode || 'NEFT'}`,
          c5: `₹${Number(p.amountPaid || p.totalAmount || p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: 'RECEIVED'
        });
      });
      timeline.sort((a, b) => new Date(b.c1) - new Date(a.c1));

      const customer360Payload = {
        profile: cust,
        salesHistory: {
          quotations: qList,
          confirmedOrders: convertedOrders,
          invoices: iList,
          payments: pList
        },
        financialHistory: {
          totalQuotationValue: totalQuoted,
          actualConvertedValue: totalConverted,
          totalInvoiceValue: totalInvoiced,
          totalPaymentReceived: totalPaid,
          outstanding
        }
      };

      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: timeline.length,
          totalQuotedValue: totalQuoted,
          actualConvertedValue: totalConverted,
          totalInvoiceValue: totalInvoiced,
          totalPaidAmount: totalPaid,
          totalOutstanding: outstanding
        },
        columns: ['Date', 'Transaction Type', 'Voucher / Doc No', 'Particulars / Details', 'Amount (₹)', 'Status'],
        keys: ['date', 'type', 'ref', 'details', 'amount', 'status'],
        customer360Data: customer360Payload,
        rawRecords: timeline,
        rows: timeline
      };
    }

    // CUSTOMER PURCHASE HISTORY
    if (reportId === 'CUSTOMER_PURCHASE_HISTORY') {
      const [
        { data: quotations },
        { data: invoices }
      ] = await Promise.all([
        getQuotations().catch(() => ({ data: [] })),
        getInvoices().catch(() => ({ data: [] }))
      ]);

      const qList = (Array.isArray(quotations) ? quotations : []).filter(q => !custId || q.customerId === custId || (q.customer && (q.customer._id === custId || q.customer.id === custId)));
      const iList = (Array.isArray(invoices) ? invoices : []).filter(i => !custId || i.customerId === custId || (i.customer && (i.customer._id === custId || i.customer.id === custId)));

      const prodMap = new Map();
      qList.forEach(q => {
        (q.items || []).forEach(it => {
          const name = it.productName || it.name || 'Ceramic Product';
          const current = prodMap.get(name) || {
            productName: name,
            quantity: 0,
            unit: it.unit || 'Sq.Ft',
            totalAmount: 0,
            status: q.status || 'CONFIRMED'
          };
          current.quantity += Number(it.quantity || 1);
          current.totalAmount += Number(it.totalAmount || (it.quantity * (it.price || it.salePrice || 0)) || 0);
          prodMap.set(name, current);
        });
      });
      iList.forEach(i => {
        (i.items || []).forEach(it => {
          const name = it.productName || it.name || 'Ceramic Product';
          const current = prodMap.get(name) || {
            productName: name,
            quantity: 0,
            unit: it.unit || 'Sq.Ft',
            totalAmount: 0,
            status: 'PURCHASED'
          };
          current.quantity += Number(it.quantity || 1);
          current.totalAmount += Number(it.totalAmount || (it.quantity * (it.price || it.salePrice || 0)) || 0);
          prodMap.set(name, current);
        });
      });

      const pList = Array.from(prodMap.values());
      const grandTotal = pList.reduce((sum, p) => sum + p.totalAmount, 0);

      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: pList.length,
          grandTotal
        },
        columns: ['Product Name', 'Total Quantity Purchased', 'Unit', 'Total Purchase Value (₹)', 'Remarks', 'Status'],
        keys: ['productName', 'quantity', 'unit', 'totalAmount', 'remarks', 'status'],
        rawRecords: pList,
        rows: pList.map(p => ({
          c1: p.productName,
          c2: String(p.quantity),
          c3: p.unit || 'Sq.Ft',
          c4: `₹${Number(p.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c5: 'Customer Order Verified',
          c6: p.status || 'PURCHASED'
        }))
      };
    }

    // CUSTOMER LEDGER
    if (reportId === 'CUSTOMER_LEDGER' || reportId === 'FINANCE_CUSTOMER_LEDGER') {
      const [{ data: invoices }, { data: payments }] = await Promise.all([
        getInvoices().catch(() => ({ data: [] })),
        getPayments().catch(() => ({ data: [] }))
      ]);
      let combined = [
        ...(Array.isArray(invoices) ? invoices : []).map(i => ({
          date: i.invoiceDate ? i.invoiceDate.split('T')[0] : (i.date || '-'),
          customerName: i.customerName,
          customerId: i.customerId,
          ref: i.invoiceNumber,
          desc: 'Sales Invoice',
          debit: Number(i.grandTotal || 0),
          credit: 0,
          status: i.paymentStatus || 'PENDING'
        })),
        ...(Array.isArray(payments) ? payments : []).map(p => ({
          date: p.paymentDate ? p.paymentDate.split('T')[0] : (p.date || '-'),
          customerName: p.customerName,
          customerId: p.customerId,
          ref: p.paymentNumber || p.receiptNumber || 'RCT',
          desc: `Payment Received (${p.paymentMode || 'NEFT'})`,
          debit: 0,
          credit: Number(p.amount || 0),
          status: 'PAID'
        }))
      ];
      if (custId) {
        combined = combined.filter(c => c.customerId === custId);
      }
      combined.sort((a, b) => new Date(b.date) - new Date(a.date));

      const totalDebit = combined.reduce((s, r) => s + r.debit, 0);
      const totalCredit = combined.reduce((s, r) => s + r.credit, 0);

      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: combined.length,
          totalDebit,
          totalCredit,
          netBalanceDifference: totalDebit - totalCredit
        },
        columns: ['Date', 'Customer Name', 'Voucher / Ref', 'Transaction Particulars', 'Amount (₹)', 'Type / Status'],
        keys: ['date', 'customerName', 'ref', 'desc', 'amount', 'status'],
        rawRecords: combined,
        rows: combined.map(r => ({
          c1: r.date,
          c2: r.customerName || 'Customer',
          c3: r.ref,
          c4: r.desc,
          c5: `₹${Number(r.debit > 0 ? r.debit : r.credit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: r.debit > 0 ? 'Debit (+ Due)' : 'Credit (- Paid)'
        }))
      };
    }

    // CUSTOMER DIRECTORY / OUTSTANDING
    if (reportId.startsWith('CUSTOMER_') || reportId.startsWith('rpt_cust')) {
      const { data: customers } = await getCustomers().catch(() => ({ data: [] }));
      const list = Array.isArray(customers) ? customers : [];
      const filtered = reportId === 'CUSTOMER_OUTSTANDING' ? list.filter(c => (Number(c.totalOutstanding) || 0) > 0) : list;
      
      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: filtered.length,
          totalOutstanding: filtered.reduce((s, c) => s + (Number(c.totalOutstanding) || 0), 0)
        },
        columns: ['Customer Name', 'Mobile', 'City', 'Customer Type', 'Outstanding Balance', 'Status'],
        keys: ['customerName', 'mobile', 'city', 'customerType', 'totalOutstanding', 'status'],
        rawRecords: filtered,
        rows: filtered.map(c => ({
          c1: c.customerName || '-',
          c2: c.mobile || '-',
          c3: c.city || '-',
          c4: c.customerType || 'Retail',
          c5: `₹${Number(c.totalOutstanding || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: c.status || 'Active'
        }))
      };
    }

    // QUOTATION REPORTS
    if (reportId.startsWith('QUOTATION_') || reportId.startsWith('rpt_qt')) {
      const { data: quotations } = await getQuotations().catch(() => ({ data: [] }));
      let list = Array.isArray(quotations) ? quotations : [];
      if (reportId === 'QUOTATION_PENDING') {
        list = list.filter(q => ['DRAFT', 'SENT', 'PENDING', 'FOLLOW_UP_PENDING'].includes((q.status || '').toUpperCase()));
      } else if (reportId === 'QUOTATION_CONFIRMED') {
        list = list.filter(q => ['CONFIRMED', 'CLOSED'].includes((q.status || '').toUpperCase()));
      } else if (reportId === 'QUOTATION_REJECTED') {
        list = list.filter(q => (q.status || '').toUpperCase() === 'REJECTED');
      } else if (reportId === 'QUOTATION_EXPIRED') {
        list = list.filter(q => (q.status || '').toUpperCase() === 'EXPIRED');
      }

      const totalVal = list.reduce((s, q) => s + (Number(q.grandTotal) || 0), 0);
      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: { totalRecords: list.length, pageTotalValue: totalVal },
        columns: ['Quotation No', 'Customer Name', 'Date', 'Gross Total', 'Grand Total', 'Status'],
        keys: ['quotationNumber', 'customerName', 'quotationDate', 'grossTotal', 'grandTotal', 'status'],
        rawRecords: list,
        rows: list.map(q => ({
          c1: q.quotationNumber,
          c2: q.customerName || '-',
          c3: q.quotationDate ? q.quotationDate.split('T')[0] : (q.date || '-'),
          c4: `₹${Number(q.grossTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c5: `₹${Number(q.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: q.status || 'SENT'
        }))
      };
    }

    // PRODUCT REPORTS
    if (reportId.startsWith('PRODUCT_') || reportId.startsWith('rpt_prd')) {
      const { data: products } = await getProducts().catch(() => ({ data: [] }));
      let list = Array.isArray(products) ? products : [];
      if (reportId === 'PRODUCT_LOW_STOCK' || reportId === 'PRODUCT_REORDER_ITEMS') {
        list = list.filter(p => (Number(p.actualStock || p.currentStock) || 0) <= (Number(p.reorderLevel || p.alertStockQty) || 10));
      }

      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: { totalRecords: list.length },
        columns: ['Product SKU', 'Product Name', 'Company / Brand', 'Unit', 'Current Stock', 'Stock Status'],
        keys: ['sku', 'productName', 'company', 'unit', 'currentStock', 'status'],
        rawRecords: list,
        rows: list.map(p => ({
          c1: p.sku || p.companySku || '-',
          c2: p.productName || '-',
          c3: p.company || p.companyName || 'Brand',
          c4: p.unit || 'Sq.Ft',
          c5: String(p.currentStock ?? p.actualStock ?? 0),
          c6: (Number(p.currentStock || p.actualStock || 0) <= (Number(p.reorderLevel || 10))) ? 'LOW_STOCK' : 'ADEQUATE'
        }))
      };
    }

    // STOCK REPORTS
    if (reportId.startsWith('STOCK_') || reportId.startsWith('rpt_stk')) {
      const { data: products } = await getProducts().catch(() => ({ data: [] }));
      const list = Array.isArray(products) ? products : [];
      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: { totalRecords: list.length },
        columns: ['SKU Code', 'Product Name', 'Physical Actual', 'Management Reserve', 'Available Stock', 'Unit'],
        keys: ['sku', 'productName', 'actualStock', 'managementStock', 'availableStock', 'unit'],
        rawRecords: list,
        rows: list.map(p => ({
          c1: p.sku || '-',
          c2: p.productName || '-',
          c3: String(p.actualStock || p.currentStock || 0),
          c4: String(p.managementStock || 0),
          c5: String(Math.max(0, (Number(p.actualStock || p.currentStock || 0) - Number(p.managementStock || 0)))),
          c6: p.unit || 'Sq.Ft'
        }))
      };
    }

    // FINANCE INVOICES / PAYMENTS
    if (reportId.startsWith('FINANCE_') || reportId.startsWith('rpt_fin')) {
      if (reportId === 'FINANCE_PAYMENT_COLLECTION' || reportId === 'FINANCE_PAYMENT_RECEIPTS') {
        const { data: payments } = await getPayments().catch(() => ({ data: [] }));
        const list = Array.isArray(payments) ? payments : [];
        const totalCollected = list.reduce((s, p) => s + (Number(p.amount) || 0), 0);

        return {
          reportId,
          generatedAt: new Date().toISOString(),
          summary: { totalRecords: list.length, totalCollectedAmount: totalCollected },
          columns: ['Receipt No', 'Customer Name', 'Payment Date', 'Payment Mode', 'Amount Collected', 'Status'],
          keys: ['receiptNumber', 'customerName', 'paymentDate', 'paymentMode', 'amount', 'status'],
          rawRecords: list,
          rows: list.map(p => ({
            c1: p.paymentNumber || p.receiptNumber || '-',
            c2: p.customerName || 'Customer',
            c3: p.paymentDate ? p.paymentDate.split('T')[0] : (p.date || '-'),
            c4: p.paymentMode || 'NEFT',
            c5: `₹${Number(p.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            c6: 'PAID'
          }))
        };
      }

      const { data: invoices } = await getInvoices().catch(() => ({ data: [] }));
      const list = Array.isArray(invoices) ? invoices : [];
      const totalInv = list.reduce((s, i) => s + (Number(i.grandTotal) || 0), 0);
      const totalPaid = list.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
      const totalDue = list.reduce((s, i) => s + (Number(i.balanceDue) || 0), 0);

      return {
        reportId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalRecords: list.length,
          totalInvoiceValue: totalInv,
          totalPaidAmount: totalPaid,
          totalOutstanding: totalDue
        },
        columns: ['Invoice No', 'Customer Name', 'Date', 'Grand Total', 'Paid Amount', 'Balance Due', 'Status'],
        keys: ['invoiceNumber', 'customerName', 'invoiceDate', 'grandTotal', 'paidAmount', 'balanceDue', 'paymentStatus'],
        rawRecords: list,
        rows: list.map(i => ({
          c1: i.invoiceNumber,
          c2: i.customerName || '-',
          c3: i.invoiceDate ? i.invoiceDate.split('T')[0] : (i.date || '-'),
          c4: `₹${Number(i.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c5: `₹${Number(i.paidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c6: `₹${Number(i.balanceDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          c7: i.paymentStatus || 'PENDING'
        }))
      };
    }
  } catch (aggErr) {
    console.error('Aggregation failed:', aggErr);
  }

  return {
    reportId,
    generatedAt: new Date().toISOString(),
    summary: { totalRecords: 0 },
    columns: ['Column 1', 'Column 2', 'Column 3', 'Column 4', 'Column 5', 'Status'],
    rows: []
  };
};
