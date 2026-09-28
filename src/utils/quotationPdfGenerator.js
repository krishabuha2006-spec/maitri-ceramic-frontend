import { formatCurrency, formatDate } from './formatters';

/**
 * Generates and triggers high-quality printable PDF document for Quotations
 */
export const printQuotationPdf = (quotation) => {
  if (!quotation) return;

  const qNum = quotation.quotationNumber || quotation.id || 'QT-DRAFT';
  const qDate = formatDate(quotation.date || quotation.quotationDate || new Date());
  const validDate = formatDate(quotation.validityDate || quotation.validUntil || new Date(Date.now() + 15 * 86400000));
  const custName = quotation.customerName || quotation.customer?.customerName || 'Valued Customer';
  const custMobile = quotation.customerContact || quotation.customer?.mobile || '';
  const custGst = quotation.customer?.gstNumber || quotation.gstNumber || 'Unregistered';
  const custAddress = quotation.customerAddress || quotation.customer?.billingAddress || quotation.customer?.city || '';
  const salesperson = quotation.salesperson?.name || quotation.salesperson || 'Vikram Mehta';
  const companyName = quotation.company?.companyName || quotation.company || 'Maitri Ceramic';
  const companyGst = quotation.company?.gstin || '24ABCDE1234F1Z5';
  const terms = quotation.termsAndConditions || quotation.remarks || '1. Delivery within 7-10 working days upon confirmation.\n2. 50% advance along with confirmed order.\n3. Goods once sold will not be taken back without valid approval.';

  const items = Array.isArray(quotation.items) ? quotation.items : [];

  let grossTotal = 0;
  let discountTotal = 0;
  let taxableTotal = 0;
  let gstTotal = 0;
  let netTotal = 0;

  const renderedRows = items.map((item, index) => {
    const qty = Number(item.quantity || item.confirmedQty || 1);
    const rate = Number(item.rate || item.quotedRate || item.mrp || 0);
    const discPct = Number(item.discountPercent || item.discountPct || 0);
    const gstPct = Number(item.gstPercent || item.taxPct || item.gstPctSnapshot || 18);

    const gross = qty * rate;
    const discAmt = (gross * discPct) / 100;
    const taxable = gross - discAmt;
    const gstAmt = (taxable * gstPct) / 100;
    const itemNet = taxable + gstAmt;

    grossTotal += gross;
    discountTotal += discAmt;
    taxableTotal += taxable;
    gstTotal += gstAmt;
    netTotal += itemNet;

    const prodName = item.productName || item.product?.productName || item.adHocName || 'Ceramic Item';
    const prodCode = item.companySku || item.sku || item.product?.companySkuCode || '-';
    const hsn = item.hsnCode || '69072100';
    const unit = item.unit || 'BOX';

    return `
      <tr>
        <td style="text-align: center;">${index + 1}</td>
        <td>
          <div style="font-weight: 700; color: #0f172a;">${prodName}</div>
          <div style="font-size: 11px; color: #64748b;">SKU: ${prodCode} ${item.area ? `| Area: ${item.area}` : ''}</div>
        </td>
        <td style="text-align: center;">${hsn}</td>
        <td style="text-align: right; font-weight: 600;">${qty} ${unit}</td>
        <td style="text-align: right;">₹${rate.toFixed(2)}</td>
        <td style="text-align: right;">${discPct > 0 ? `${discPct}%` : '-'}</td>
        <td style="text-align: right; font-weight: 600;">₹${taxable.toFixed(2)}</td>
        <td style="text-align: center;">${gstPct}%</td>
        <td style="text-align: right; font-weight: 700; color: #0f172a;">₹${itemNet.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  if (quotation.quotationAmount && netTotal === 0) {
    netTotal = quotation.quotationAmount;
  }

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quotation #${qNum} - ${companyName}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm 15mm;
        }
        * {
          box-sizing: border-box;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        body {
          margin: 0;
          padding: 0;
          color: #1e293b;
          font-size: 13px;
          line-height: 1.4;
          background: #ffffff;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 12px;
        }
        .meta-grid {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        .meta-grid td {
          padding: 10px 14px;
          vertical-align: top;
          width: 50%;
        }
        .meta-title {
          font-size: 10px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .items-table th {
          background-color: #f1f5f9;
          color: #334155;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
        }
        .items-table td {
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          font-size: 12px;
        }
        .summary-container {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin-top: 10px;
        }
        .terms-box {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px 14px;
          background-color: #fafafa;
        }
        .totals-table {
          width: 280px;
          border-collapse: collapse;
          margin-left: auto;
        }
        .totals-table td {
          padding: 6px 10px;
          font-size: 12px;
        }
        .totals-table tr.grand-total {
          background-color: #eff6ff;
          font-weight: 800;
          font-size: 14px;
          color: #1d4ed8;
          border-top: 2px solid #2563eb;
          border-bottom: 2px solid #2563eb;
        }
        .footer-signatures {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
          padding-top: 15px;
        }
        .sig-block {
          text-align: center;
          width: 200px;
          border-top: 1px dashed #94a3b8;
          padding-top: 6px;
          font-size: 11px;
          color: #64748b;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.02em;">${companyName}</h1>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Premium Ceramic Tiles, Sanitaryware & Bath Fittings</div>
          <div style="font-size: 11px; color: #475569; margin-top: 1px;">GSTIN: <strong>${companyGst}</strong> | State: Gujarat (24)</div>
        </div>
        <div style="text-align: right;">
          <div style="display: inline-block; background: #eff6ff; color: #1d4ed8; border: 1.5px solid #bfdbfe; padding: 4px 12px; border-radius: 6px; font-weight: 800; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">
            Sales Quotation
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 5px;"># ${qNum}</div>
          <div style="font-size: 11px; color: #64748b;">Date: ${qDate}</div>
        </div>
      </div>

      <table class="meta-grid">
        <tr>
          <td>
            <div class="meta-title">Quotation To (Customer)</div>
            <div style="font-size: 14px; font-weight: 700; color: #0f172a;">${custName}</div>
            ${custMobile ? `<div style="color: #475569; font-size: 12px;">Mobile: +91 ${custMobile}</div>` : ''}
            ${custAddress ? `<div style="color: #475569; font-size: 12px;">Address: ${custAddress}</div>` : ''}
            <div style="color: #475569; font-size: 12px;">GSTIN: <strong>${custGst}</strong></div>
          </td>
          <td style="border-left: 1px solid #e2e8f0;">
            <div class="meta-title">Quotation Meta</div>
            <div style="color: #475569; font-size: 12px;">Quotation Date: <strong>${qDate}</strong></div>
            <div style="color: #475569; font-size: 12px;">Valid Until: <strong>${validDate}</strong></div>
            <div style="color: #475569; font-size: 12px;">Sales Representative: <strong>${salesperson}</strong></div>
            <div style="color: #475569; font-size: 12px;">Quotation Status: <strong>${quotation.status || 'Active'}</strong></div>
          </td>
        </tr>
      </table>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th>Item Description</th>
            <th style="width: 75px; text-align: center;">HSN</th>
            <th style="width: 85px; text-align: right;">Qty</th>
            <th style="width: 80px; text-align: right;">Rate</th>
            <th style="width: 60px; text-align: right;">Disc</th>
            <th style="width: 90px; text-align: right;">Taxable</th>
            <th style="width: 55px; text-align: center;">GST</th>
            <th style="width: 95px; text-align: right;">Total (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${renderedRows || '<tr><td colspan="9" style="text-align: center; color: #94a3b8; padding: 20px;">No items in quotation</td></tr>'}
        </tbody>
      </table>

      <div class="summary-container">
        <div class="terms-box">
          <div class="meta-title">Terms & Conditions</div>
          <div style="font-size: 11px; color: #475569; white-space: pre-line; line-height: 1.5;">
            ${terms}
          </div>
        </div>

        <table class="totals-table">
          <tr>
            <td style="color: #64748b;">Gross Total:</td>
            <td style="text-align: right; font-weight: 600;">₹${grossTotal.toFixed(2)}</td>
          </tr>
          ${discountTotal > 0 ? `
            <tr>
              <td style="color: #dc2626;">Total Discount:</td>
              <td style="text-align: right; font-weight: 600; color: #dc2626;">- ₹${discountTotal.toFixed(2)}</td>
            </tr>
          ` : ''}
          <tr>
            <td style="color: #64748b;">Taxable Value:</td>
            <td style="text-align: right; font-weight: 600;">₹${taxableTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color: #64748b;">Total GST (CGST+SGST):</td>
            <td style="text-align: right; font-weight: 600;">₹${gstTotal.toFixed(2)}</td>
          </tr>
          <tr class="grand-total">
            <td>Grand Total:</td>
            <td style="text-align: right;">₹${netTotal.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <div class="footer-signatures">
        <div class="sig-block">
          Customer Acceptance (Sign & Date)
        </div>
        <div class="sig-block">
          For ${companyName}<br>Authorized Signatory
        </div>
      </div>
    </body>
    </html>
  `;

  // Create clean printable iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(printHtml);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1500);
  }, 350);
};
