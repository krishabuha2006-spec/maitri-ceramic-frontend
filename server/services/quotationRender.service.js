const XLSX = require('xlsx');

/**
 * Multi-Format Quotation Presentation Transformer (8 Formats)
 *
 * Formats:
 * 1. STANDARD    — Customer-facing standard layout
 * 2. MRP         — MRP-based pricing display
 * 3. DISCOUNT    — Discount-focused presentation highlighting savings
 * 4. PLUMBER     — Trade & plumber specification layout
 * 5. DETAILED    — Complete line-item breakdown with all financial columns
 * 6. PENDING     — Pending review & validity tracking layout
 * 7. WITHOUT_SKU — Hides / suppresses SKU codes for simplified quoting
 * 8. WITH_GST    — Explicit line-by-line GST tax breakdown
 *
 * @param {Object} quotationDoc - Populated Quotation Mongoose document
 * @param {string} [formatKey='STANDARD'] - One of the 8 formats
 * @returns {Object} Render-ready presentation payload
 */
const renderQuotationData = (quotationDoc, formatKey = 'STANDARD') => {
  const format = String(formatKey || quotationDoc.formatKey || 'STANDARD').toUpperCase();

  const header = {
    quotationNumber: quotationDoc.quotationNumber,
    quotationDate: quotationDoc.quotationDate,
    validityDate: quotationDoc.validityDate,
    status: quotationDoc.status,
    formatApplied: format,
    customer: quotationDoc.customer
      ? {
          name: quotationDoc.customer.customerName,
          mobile: quotationDoc.customer.mobile,
          email: quotationDoc.customer.email,
          city: quotationDoc.customer.city,
          address: quotationDoc.customerAddress || quotationDoc.customer.billingAddress,
          gstNumber: quotationDoc.customer.gstNumber
        }
      : null,
    company: quotationDoc.company
      ? {
          companyName: quotationDoc.company.companyName,
          companyCode: quotationDoc.company.companyCode,
          gstin: quotationDoc.company.gstin,
          logo: quotationDoc.company.logo,
          address: quotationDoc.company.address
        }
      : null,
    salesperson: quotationDoc.salesperson
      ? {
          name: quotationDoc.salesperson.name,
          mobile: quotationDoc.salesperson.mobile,
          email: quotationDoc.salesperson.email
        }
      : null,
    reference: quotationDoc.reference,
    remarks: quotationDoc.remarks
  };

  // Transform line items according to format rules
  const renderedItems = (quotationDoc.items || []).map((item, index) => {
    const baseItem = {
      srNo: index + 1,
      area: item.area || '',
      productName: item.productNameSnapshot,
      image: item.imageSnapshot,
      quantity: item.quantity,
      mrp: item.mrpSnapshot,
      remarks: item.remarks || ''
    };

    switch (format) {
      case 'MRP':
        return {
          ...baseItem,
          skuCode: item.skuCodeSnapshot || 'N/A',
          mrp: item.mrpSnapshot,
          grossAmount: item.grossAmount,
          finalAmount: item.grossAmount
        };

      case 'DISCOUNT':
        return {
          ...baseItem,
          skuCode: item.skuCodeSnapshot || 'N/A',
          mrpRate: item.mrpSnapshot,
          grossAmount: item.grossAmount,
          discountPct: `${item.discountPct}%`,
          discountAmountSaved: item.discountAmount,
          netPrice: item.netAmount
        };

      case 'PLUMBER':
        return {
          ...baseItem,
          area: item.area || 'General',
          productName: item.productNameSnapshot,
          quantity: item.quantity,
          unitRate: item.netAmount / (item.quantity || 1),
          totalAmount: item.netAmount
        };

      case 'WITHOUT_SKU':
        return {
          ...baseItem,
          productName: item.productNameSnapshot,
          mrp: item.mrpSnapshot,
          discountPct: `${item.discountPct}%`,
          netAmount: item.netAmount
          // Note: skuCode is explicitly omitted
        };

      case 'WITH_GST': {
        const gstPct = item.gstPctSnapshot || 0;
        const halfGst = Math.round((gstPct / 2) * 100) / 100;
        const halfGstAmt = Math.round((item.gstAmount / 2) * 100) / 100;
        return {
          ...baseItem,
          skuCode: item.skuCodeSnapshot || 'N/A',
          taxableValue: item.netAmount,
          gstPct: `${gstPct}%`,
          cgstPct: `${halfGst}%`,
          cgstAmount: halfGstAmt,
          sgstPct: `${halfGst}%`,
          sgstAmount: halfGstAmt,
          totalGst: item.gstAmount,
          totalWithGst: Math.round((item.netAmount + item.gstAmount) * 100) / 100
        };
      }

      case 'PENDING':
        return {
          ...baseItem,
          skuCode: item.skuCodeSnapshot || 'N/A',
          netAmount: item.netAmount,
          gstAmount: item.gstAmount,
          lineTotal: Math.round((item.netAmount + item.gstAmount) * 100) / 100,
          itemStatus: quotationDoc.status
        };

      case 'DETAILED':
        return {
          ...baseItem,
          skuCode: item.skuCodeSnapshot || (item.isSkuLessItem ? 'SKU-Less' : 'N/A'),
          grossAmount: item.grossAmount,
          discountPct: `${item.discountPct}%`,
          discountAmount: item.discountAmount,
          netAmount: item.netAmount,
          gstPct: `${item.gstPctSnapshot}%`,
          gstAmount: item.gstAmount,
          lineTotal: Math.round((item.netAmount + item.gstAmount) * 100) / 100
        };

      case 'STANDARD':
      default:
        return {
          ...baseItem,
          skuCode: item.skuCodeSnapshot || (item.isSkuLessItem ? '-' : 'N/A'),
          discountPct: `${item.discountPct}%`,
          netAmount: item.netAmount,
          gstAmount: item.gstAmount,
          lineTotal: Math.round((item.netAmount + item.gstAmount) * 100) / 100
        };
    }
  });

  return {
    header,
    format: format,
    items: renderedItems,
    summary: {
      totalItems: renderedItems.length,
      totalGrossAmount: quotationDoc.totalGrossAmount,
      totalDiscountAmount: quotationDoc.totalDiscountAmount,
      totalNetAmount: quotationDoc.totalNetAmount,
      totalGstAmount: quotationDoc.totalGstAmount,
      grandTotal: quotationDoc.grandTotal
    }
  };
};

/**
 * Generate Excel workbook buffer from rendered quotation data
 *
 * @param {Object} renderedData - Output of renderQuotationData
 * @returns {Buffer} Excel workbook buffer
 */
const exportQuotationToExcel = (renderedData) => {
  const headerInfo = [
    { Field: 'Quotation Number', Value: renderedData.header.quotationNumber },
    { Field: 'Date', Value: new Date(renderedData.header.quotationDate).toLocaleDateString() },
    { Field: 'Format Applied', Value: renderedData.format },
    { Field: 'Customer Name', Value: renderedData.header.customer?.name || '' },
    { Field: 'Customer Contact', Value: renderedData.header.customer?.mobile || '' },
    { Field: 'Status', Value: renderedData.header.status }
  ];

  const itemsSheet = XLSX.utils.json_to_sheet(renderedData.items);
  const headerSheet = XLSX.utils.json_to_sheet(headerInfo);

  const summaryInfo = [
    { Metric: 'Total Gross Amount', Amount: renderedData.summary.totalGrossAmount },
    { Metric: 'Total Discount Amount', Amount: renderedData.summary.totalDiscountAmount },
    { Metric: 'Total Net Amount', Amount: renderedData.summary.totalNetAmount },
    { Metric: 'Total GST Amount', Amount: renderedData.summary.totalGstAmount },
    { Metric: 'Grand Total', Amount: renderedData.summary.grandTotal }
  ];
  const summarySheet = XLSX.utils.json_to_sheet(summaryInfo);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Line Items');
  XLSX.utils.book_append_sheet(workbook, headerSheet, 'Quotation Info');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Financial Summary');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  renderQuotationData,
  exportQuotationToExcel
};
