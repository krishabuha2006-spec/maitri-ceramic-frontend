import { formatDate } from './formatters';

/**
 * Generates and triggers high-definition printable PDF document for all ERP Reports
 */
export const printReportPdf = ({
  reportTitle = 'Business Report',
  reportDescription = '',
  category = '',
  dateRange = '',
  customerName = '',
  summary = null,
  columns = [],
  rows = [],
  customer360Data = null
}) => {
  const printDate = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  // 1. If Customer 360 History Dossier
  if (customer360Data && customer360Data.profile) {
    const p = customer360Data.profile || {};
    const f = customer360Data.financialHistory || {};
    const s = customer360Data.salesHistory || {};
    const quotes = s.quotations || [];
    const invs = s.invoices || [];
    const pays = s.payments || [];

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${reportTitle} - ${p.customerName || 'Customer'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
          body { margin: 0; padding: 0; color: #0f172a; font-size: 11px; line-height: 1.4; background: #fff; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 12px; }
          .logo { font-size: 20px; font-weight: 800; color: #1e3a8a; letter-spacing: -0.5px; }
          .sublogo { font-size: 10px; color: #64748b; margin-top: 2px; }
          .meta { text-align: right; font-size: 10px; color: #475569; }
          .title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 4px 0 2px 0; }
          .profile-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; font-size: 11px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 14px; }
          .kpi-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; }
          .kpi-val { font-size: 13px; font-weight: 800; color: #1e293b; margin-top: 2px; }
          .kpi-lbl { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 600; }
          .sec-title { font-size: 12px; font-weight: 700; color: #1e3a8a; margin: 12px 0 4px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
          th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 5px 6px; border: 1px solid #cbd5e1; }
          td { padding: 4px 6px; border: 1px solid #e2e8f0; }
          .badge { display: inline-block; padding: 2px 5px; border-radius: 3px; font-size: 9px; font-weight: 700; background: #e2e8f0; }
          .footer { margin-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">MAITRI CERAMIC</div>
            <div class="sublogo">Tiles, Sanitaryware & Bath Fittings • Official Statement</div>
            <div class="title">${reportTitle}</div>
          </div>
          <div class="meta">
            <div><strong>Generated:</strong> ${printDate}</div>
            <div><strong>Report Type:</strong> Customer 360° Dossier</div>
          </div>
        </div>

        <div class="profile-box">
          <div><strong style="color:#64748b;">Customer Name:</strong><br><span style="font-weight:700; font-size:12px;">${p.customerName || '-'}</span></div>
          <div><strong style="color:#64748b;">Mobile:</strong><br>${p.mobile || '-'}</div>
          <div><strong style="color:#64748b;">City / State:</strong><br>${p.city || '-'}, ${p.state || 'Gujarat'}</div>
          <div><strong style="color:#64748b;">GSTIN:</strong><br>${p.gstNumber || 'Unregistered'}</div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card"><div class="kpi-lbl">Total Quoted</div><div class="kpi-val">₹${Number(f.totalQuotationValue || 0).toLocaleString('en-IN')}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Converted Orders</div><div class="kpi-val" style="color:#15803d;">₹${Number(f.actualConvertedValue || 0).toLocaleString('en-IN')}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Total Invoiced</div><div class="kpi-val" style="color:#1d4ed8;">₹${Number(f.totalInvoiceValue || 0).toLocaleString('en-IN')}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Payments Received</div><div class="kpi-val" style="color:#047857;">₹${Number(f.totalPaymentReceived || 0).toLocaleString('en-IN')}</div></div>
          <div class="kpi-card" style="border-color:#fca5a5; background:#fef2f2;"><div class="kpi-lbl" style="color:#b91c1c;">Outstanding Due</div><div class="kpi-val" style="color:#b91c1c;">₹${Number(f.outstanding || 0).toLocaleString('en-IN')}</div></div>
        </div>

        <div class="sec-title">1. Quotation History (${quotes.length} Records)</div>
        <table>
          <thead>
            <tr><th>Quotation No</th><th>Date</th><th>Gross Total</th><th>Tax</th><th>Grand Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${quotes.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No quotations recorded</td></tr>' : quotes.map(q => `
              <tr>
                <td style="font-weight:600;">${q.quotationNumber || '-'}</td>
                <td>${(q.quotationDate || q.createdAt || '').split('T')[0]}</td>
                <td>₹${Number(q.grossTotal || 0).toLocaleString('en-IN')}</td>
                <td>₹${Number(q.totalTax || 0).toLocaleString('en-IN')}</td>
                <td style="font-weight:700;">₹${Number(q.grandTotal || 0).toLocaleString('en-IN')}</td>
                <td><span class="badge">${q.status || 'SENT'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="sec-title">2. Invoices & Billing (${invs.length} Records)</div>
        <table>
          <thead>
            <tr><th>Invoice No</th><th>Date</th><th>Total Amount</th><th>Paid Amount</th><th>Balance Due</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${invs.length === 0 ? '<tr><td colspan="6" style="text-align:center;color:#94a3b8;">No invoices issued</td></tr>' : invs.map(i => `
              <tr>
                <td style="font-weight:600;">${i.invoiceNumber || '-'}</td>
                <td>${(i.invoiceDate || i.createdAt || '').split('T')[0]}</td>
                <td style="font-weight:700;">₹${Number(i.grandTotal || 0).toLocaleString('en-IN')}</td>
                <td style="color:#15803d;">₹${Number(i.paidAmount || 0).toLocaleString('en-IN')}</td>
                <td style="color:#b91c1c;font-weight:700;">₹${Number(i.balanceDue || 0).toLocaleString('en-IN')}</td>
                <td><span class="badge">${i.paymentStatus || 'PENDING'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="sec-title">3. Payment Receipts (${pays.length} Records)</div>
        <table>
          <thead>
            <tr><th>Receipt / Ref</th><th>Payment Date</th><th>Payment Mode</th><th>Transaction Ref</th><th>Amount Received</th></tr>
          </thead>
          <tbody>
            ${pays.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No payments recorded</td></tr>' : pays.map(p => `
              <tr>
                <td style="font-weight:600;">${p.receiptNumber || p.paymentNumber || '-'}</td>
                <td>${(p.paymentDate || p.createdAt || '').split('T')[0]}</td>
                <td>${p.paymentMode?.modeName || p.paymentMode || 'NEFT/UPI'}</td>
                <td>${p.referenceNumber || '-'}</td>
                <td style="font-weight:700; color:#15803d;">₹${Number(p.totalAmount || p.amount || 0).toLocaleString('en-IN')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Generated automatically by Maitri Ceramic ERP System • Confidential & Proprietary Document
        </div>
      </body>
      </html>
    `;

    triggerPrintIframe(html);
    return;
  }

  // 2. Standard Tabular Reports (Full Data - All Rows without cutoffs)
  const summaryKpis = [];
  if (summary) {
    if (summary.totalRecords !== undefined) summaryKpis.push({ label: 'Total Records', val: summary.totalRecords });
    if (summary.totalInvoiceValue !== undefined || summary.grandTotal !== undefined || summary.pageTotalValue !== undefined || summary.totalQuotedValue !== undefined) {
      summaryKpis.push({ label: 'Total Value', val: `₹${Number(summary.totalInvoiceValue ?? summary.grandTotal ?? summary.pageTotalValue ?? summary.totalQuotedValue ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` });
    }
    if (summary.totalPaidAmount !== undefined || summary.totalCollectedAmount !== undefined || summary.totalCredit !== undefined) {
      summaryKpis.push({ label: 'Total Paid / Received', val: `₹${Number(summary.totalPaidAmount ?? summary.totalCollectedAmount ?? summary.totalCredit ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` });
    }
    if (summary.totalOutstanding !== undefined || summary.netDifference !== undefined || summary.totalDebit !== undefined) {
      summaryKpis.push({ label: 'Outstanding / Balance', val: `₹${Number(summary.totalOutstanding ?? summary.netDifference ?? summary.totalDebit ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` });
    }
    if (summary.conversionRateValuePct !== undefined) {
      summaryKpis.push({ label: 'Conversion Rate', val: `${summary.conversionRateValuePct}%` });
    }
  }

  const tableHeaders = columns.map(c => `<th>${c}</th>`).join('');
  const tableRows = rows.map((r) => {
    const cells = columns.map((_, cIdx) => {
      const v = r[`c${cIdx + 1}`] ?? '-';
      const isNum = String(v).startsWith('₹') || (typeof v === 'number');
      return `<td style="${isNum ? 'text-align:right; font-weight:600;' : ''}">${v}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const isWide = columns.length > 6;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${reportTitle} - Maitri Ceramic</title>
      <style>
        @page {
          size: A4 ${isWide ? 'landscape' : 'portrait'};
          margin: 10mm 12mm;
        }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
        body { margin: 0; padding: 0; color: #0f172a; font-size: ${isWide ? '10px' : '11px'}; line-height: 1.35; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 10px; }
        .logo { font-size: 18px; font-weight: 800; color: #1e3a8a; }
        .sublogo { font-size: 10px; color: #64748b; }
        .meta { text-align: right; font-size: 10px; color: #475569; }
        .title { font-size: 15px; font-weight: 700; color: #0f172a; margin: 3px 0 1px 0; }
        .desc { font-size: 10px; color: #64748b; }
        .filter-bar { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; font-size: 10px; display: flex; justify-content: space-between; }
        .kpi-container { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
        .kpi-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px 10px; min-width: 110px; }
        .kpi-box .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; }
        .kpi-box .val { font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: ${isWide ? '9px' : '10px'}; }
        th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 6px 7px; border: 1px solid #cbd5e1; white-space: nowrap; }
        td { padding: 5px 7px; border: 1px solid #e2e8f0; white-space: nowrap; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .footer { margin-top: 15px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 6px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">MAITRI CERAMIC</div>
          <div class="sublogo">Tiles & Ceramics ERP Report</div>
          <div class="title">${reportTitle}</div>
          ${reportDescription ? `<div class="desc">${reportDescription}</div>` : ''}
        </div>
        <div class="meta">
          <div><strong>Printed:</strong> ${printDate}</div>
          <div><strong>Category:</strong> ${category || 'General'}</div>
        </div>
      </div>

      <div class="filter-bar">
        <div><strong>Date Range:</strong> ${dateRange || 'All Time'}</div>
        ${customerName ? `<div><strong>Customer:</strong> ${customerName}</div>` : ''}
        <div><strong>Total Records:</strong> ${rows.length}</div>
      </div>

      ${summaryKpis.length > 0 ? `
        <div class="kpi-container">
          ${summaryKpis.map(k => `
            <div class="kpi-box">
              <div class="lbl">${k.label}</div>
              <div class="val">${k.val}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <table>
        <thead>
          <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
          ${rows.length === 0 ? `<tr><td colspan="${columns.length}" style="text-align:center; padding:15px; color:#94a3b8;">No records found matching criteria</td></tr>` : tableRows}
        </tbody>
      </table>

      <div class="footer">
        Generated by Maitri Ceramic ERP • System Verified Report
      </div>
    </body>
    </html>
  `;

  triggerPrintIframe(html);
};

const triggerPrintIframe = (htmlContent) => {
  try {
    const existing = document.getElementById('report-pdf-print-frame');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'report-pdf-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1000px';
    iframe.style.height = '1000px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const docObj = iframe.contentWindow ? iframe.contentWindow.document : (iframe.contentDocument || null);
    if (!docObj) {
      throw new Error('Unable to access iframe document');
    }

    docObj.open();
    docObj.write(htmlContent);
    docObj.close();

    const executePrint = () => {
      try {
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } else {
          throw new Error('iframe window unavailable');
        }
      } catch (err) {
        console.warn('Iframe print failed, fallback to popup window:', err);
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(htmlContent);
          win.document.close();
          win.focus();
          win.print();
        }
      } finally {
        setTimeout(() => {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 3000);
      }
    };

    setTimeout(executePrint, 300);
  } catch (outerErr) {
    console.warn('Print trigger error, opening direct popup window:', outerErr);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
      win.focus();
      win.print();
    }
  }
};
