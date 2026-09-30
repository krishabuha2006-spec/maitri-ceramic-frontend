import { formatCurrency, formatDate } from './formatters';

/**
 * High-quality printable A4 PDF generator matching Maitri Ceramic's official format designs:
 * - Format 1: Area Summary Table + Image + MRP + Qty + Total + Net Amt (Photo 4)
 * - Format 2 / WITH_GST: Detailed with full GST breakdown (Taxable, GST%, GST Amt, Net) + GST Summary (Photo 1/user prompt)
 * - Format 3 / DISCOUNT: Area Summary + Image + MRP + Qty + Total + Disc(%) + Net Amt (Photo 3)
 * - Format 4 / REMARKS: Area Summary + Image + MRP + Qty + Total + Remark (Photo 5)
 * - Format 5 / PLUMBER / DISPATCH: Plumber checklist without any prices (Sr, SKU, Image, Name, Qty, Remark) (Photo 1)
 * - Format 6 / COMPACT / DETAILED: Compact continuous table without images (Photo 2)
 * - Format 7 / PENDING: Pending supply items checklist
 * - Format 8 / WITHOUT_SKU: Quotation without SKU codes
 * - STANDARD / ALL_DETAILS: Full comprehensive invoice-style quotation
 */
export const printQuotationPdf = (quotation, activeFormat = null) => {
  if (!quotation) return;

  const rawKey = (activeFormat || quotation.formatKey || quotation.quotationType || 'STANDARD').toUpperCase();
  
  const isFormat1 = rawKey === 'FORMAT_1' || rawKey === '1' || rawKey === 'STANDARD';
  const isFormat2 = rawKey === 'FORMAT_2' || rawKey === '2' || rawKey === 'WITH_GST' || rawKey.includes('GST');
  const isFormat3 = rawKey === 'FORMAT_3' || rawKey === '3' || rawKey === 'DISCOUNT';
  const isFormat4 = rawKey === 'FORMAT_4' || rawKey === '4' || rawKey === 'REMARKS' || rawKey === 'MRP';
  const isFormat5 = rawKey === 'FORMAT_5' || rawKey === '5' || rawKey === 'PLUMBER' || rawKey === 'DISPATCH';
  const isFormat6 = rawKey === 'FORMAT_6' || rawKey === '6' || rawKey === 'COMPACT' || rawKey === 'DETAILED';
  const isFormat7 = rawKey === 'FORMAT_7' || rawKey === '7' || rawKey === 'PENDING';
  const isFormat8 = rawKey === 'FORMAT_8' || rawKey === '8' || rawKey === 'WITHOUT_SKU';

  const payWithGst = isFormat2 || Boolean(quotation.payWithGst);

  const qNum = quotation.quotationNumber || quotation.id || 'B-878';
  const qDate = formatDate(quotation.date || quotation.quotationDate || new Date());
  const custName = quotation.customerName || quotation.customer?.customerName || quotation.partyName || 'Valued Customer';
  const custMobile = quotation.customerContact || quotation.customer?.mobile || quotation.mobile || '';
  const custAddress = quotation.customerAddress || quotation.customer?.billingAddress || quotation.address || '';
  const refName = quotation.reference || quotation.salesperson?.name || quotation.salesperson || '';
  const refMobile = quotation.referenceMobile || quotation.salespersonMobile || '';
  const remarkText = quotation.remarks || quotation.termsAndConditions || 'PAYMENT 100% ADVANCED. TRANSPORTATION WILL BE EXTRA.';

  const rawItems = Array.isArray(quotation.items) ? quotation.items : [];

  // Group items by Area (e.g., 'A. AT TOILET GENTS', 'B. AT TOILET', etc.)
  const areaMap = {};
  rawItems.forEach((item, originalIdx) => {
    const areaName = (item.area || 'General Area').trim();
    if (!areaMap[areaName]) {
      areaMap[areaName] = [];
    }
    areaMap[areaName].push({ ...item, originalIdx });
  });

  // Calculate Area Totals
  const areaSummaries = [];
  let grandNetTotal = 0;
  let grandGrossTotal = 0;
  let grandDiscountTotal = 0;
  let grandTaxableTotal = 0;
  let grandGstTotal = 0;

  let areaIdxCounter = 1;
  for (const [areaName, areaItems] of Object.entries(areaMap)) {
    let areaNet = 0;
    areaItems.forEach(item => {
      const qty = Number(item.quantity ?? item.confirmedQty ?? 1);
      const mrp = Number(item.mrp ?? item.rate ?? item.quotedRate ?? item.mrpSnapshot ?? 0);
      const discPct = Number(item.discountPercent ?? item.discountPct ?? 0);
      const gstPct = payWithGst ? Number(item.gstPercent ?? item.gstPctSnapshot ?? 18) : 0;

      const lineGross = qty * mrp;
      const lineDisc = (lineGross * discPct) / 100;
      const lineTaxable = lineGross - lineDisc;
      const lineGst = payWithGst ? (lineTaxable * gstPct) / 100 : 0;
      const lineNet = lineTaxable + lineGst;

      grandGrossTotal += lineGross;
      grandDiscountTotal += lineDisc;
      grandTaxableTotal += lineTaxable;
      grandGstTotal += lineGst;
      grandNetTotal += lineNet;
      areaNet += lineNet;
    });

    areaSummaries.push({
      sr: areaIdxCounter++,
      area: areaName,
      netAmount: areaNet
    });
  }

  // Format Helper
  const fmtNum = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = (val) => Number(val || 0).toFixed(2);

  // 1. Render Area Summary Table (Used in Formats 1, 2, 3, 4)
  const renderAreaSummaryTable = () => {
    if (isFormat5 || isFormat6) return '';

    return `
      <table class="summary-table">
        <thead>
          <tr>
            <th style="width: 45px; text-align: center;">Sr.</th>
            <th style="text-align: left;">Area</th>
            <th style="width: 140px; text-align: right;">Net Amt.</th>
          </tr>
        </thead>
        <tbody>
          ${areaSummaries.map(s => `
            <tr>
              <td style="text-align: center;">${s.sr}</td>
              <td style="font-weight: 700;">${s.area}</td>
              <td style="text-align: right; font-weight: 700;">${fmtNum(s.netAmount)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="2" style="text-align: right; font-weight: 800; padding-right: 15px;">TOTAL :</td>
            <td style="text-align: right; font-weight: 800;">${fmtNum(grandNetTotal)}</td>
          </tr>
        </tbody>
      </table>
    `;
  };

  // Render Line Items per Area
  const renderItemTables = () => {
    // Format 6: Single compact continuous table for all items (No Images - Photo 2)
    if (isFormat6) {
      let overallSr = 1;
      return `
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 140px; text-align: left;">SKU Code</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 75px; text-align: right;">MRP</th>
              <th style="width: 55px; text-align: right;">Qty</th>
              <th style="width: 80px; text-align: right;">Total</th>
              <th style="width: 65px; text-align: right;">Disc(%)</th>
              <th style="width: 85px; text-align: right;">Net Amt.</th>
            </tr>
          </thead>
          <tbody>
            ${rawItems.map(item => {
              const qty = Number(item.quantity ?? item.confirmedQty ?? 1);
              const mrp = Number(item.mrp ?? item.rate ?? item.mrpSnapshot ?? 0);
              const discPct = Number(item.discountPercent ?? item.discountPct ?? 0);
              const total = qty * mrp;
              const net = total * (1 - discPct / 100) * (payWithGst ? (1 + (Number(item.gstPercent || 18) / 100)) : 1);
              const sku = item.sku || item.companySku || item.skuCodeSnapshot || item.productCode || '-';
              const name = item.productName || item.productNameSnapshot || item.name || 'Ceramic Item';

              return `
                <tr>
                  <td style="text-align: center;">${overallSr++}</td>
                  <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                  <td>${name}</td>
                  <td style="text-align: right;">${fmtNum(mrp)}</td>
                  <td style="text-align: right;">${fmtQty(qty)}</td>
                  <td style="text-align: right;">${fmtNum(total)}</td>
                  <td style="text-align: right;">${discPct.toFixed(2)}</td>
                  <td style="text-align: right; font-weight: 700;">${fmtNum(net)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }

    const resolveImageUrl = (img) => {
      if (!img || typeof img !== 'string') return '';
      const trimmed = img.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
        return trimmed;
      }
      if (trimmed.startsWith('/')) {
        return `${window.location.origin}${trimmed}`;
      }
      return `${window.location.origin}/${trimmed}`;
    };

    // Formats 1, 2, 3, 4, 5, 7, 8: Grouped by Area Header
    return Object.entries(areaMap).map(([areaName, items]) => {
      let areaItemSr = 1;

      // Table Header by Format
      const getTableHeader = () => {
        if (isFormat5) {
          // Format 5 (Plumber / Dispatch): Sr | SKU Code | Name | Image | Qty | Remark
          return `
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 130px; text-align: left;">SKU Code</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 80px; text-align: center;">Image</th>
              <th style="width: 55px; text-align: right;">Qty</th>
              <th style="width: 120px; text-align: left;">Remark</th>
            </tr>
          `;
        }

        if (isFormat8) {
          // Format 8 (Without SKU): Sr | Image | Name | MRP | Qty | Total | Net Amt.
          return `
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 75px; text-align: center;">Image</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 75px; text-align: right;">MRP</th>
              <th style="width: 55px; text-align: right;">Qty</th>
              <th style="width: 75px; text-align: right;">Total</th>
              <th style="width: 80px; text-align: right;">Net Amt.</th>
            </tr>
          `;
        }

        if (isFormat2) {
          // Format 2 (With GST): Sr | SKU Code | Image | Name | MRP | Qty | Total | GST% | GST Amt | Net Amt.
          return `
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 120px; text-align: left;">SKU Code</th>
              <th style="width: 75px; text-align: center;">Image</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 70px; text-align: right;">MRP</th>
              <th style="width: 50px; text-align: right;">Qty</th>
              <th style="width: 70px; text-align: right;">Total</th>
              <th style="width: 55px; text-align: center;">GST%</th>
              <th style="width: 65px; text-align: right;">GST Amt</th>
              <th style="width: 80px; text-align: right;">Net Amt.</th>
            </tr>
          `;
        }

        if (isFormat3) {
          // Format 3 (Discount): Sr | SKU Code | Image | Name | MRP | Qty | Total | Disc(%) | Net Amt.
          return `
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 120px; text-align: left;">SKU Code</th>
              <th style="width: 75px; text-align: center;">Image</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 75px; text-align: right;">MRP</th>
              <th style="width: 55px; text-align: right;">Qty</th>
              <th style="width: 75px; text-align: right;">Total</th>
              <th style="width: 65px; text-align: right;">Disc(%)</th>
              <th style="width: 80px; text-align: right;">Net Amt.</th>
            </tr>
          `;
        }

        if (isFormat4) {
          // Format 4 (MRP / Remark): Sr | SKU Code | Image | Name | MRP | Qty | Total | Remark
          return `
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 120px; text-align: left;">SKU Code</th>
              <th style="width: 75px; text-align: center;">Image</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 75px; text-align: right;">MRP</th>
              <th style="width: 55px; text-align: right;">Qty</th>
              <th style="width: 75px; text-align: right;">Total</th>
              <th style="width: 100px; text-align: left;">Remark</th>
            </tr>
          `;
        }

        if (isFormat7) {
          // Format 7 (Pending): Sr | SKU Code | Image | Name | MRP | Qty | Total | Confirmed | Pending | Net Amt.
          return `
            <tr>
              <th style="width: 35px; text-align: center;">Sr.</th>
              <th style="width: 120px; text-align: left;">SKU Code</th>
              <th style="width: 75px; text-align: center;">Image</th>
              <th style="text-align: left;">Name</th>
              <th style="width: 70px; text-align: right;">MRP</th>
              <th style="width: 50px; text-align: right;">Qty</th>
              <th style="width: 70px; text-align: right;">Total</th>
              <th style="width: 60px; text-align: center;">Confirmed</th>
              <th style="width: 60px; text-align: center;">Pending</th>
              <th style="width: 75px; text-align: right;">Net Amt.</th>
            </tr>
          `;
        }

        // Format 1 / Standard Default: Sr | SKU Code | Image | Name | MRP | Qty | Total | Net Amt.
        return `
          <tr>
            <th style="width: 35px; text-align: center;">Sr.</th>
            <th style="width: 125px; text-align: left;">SKU Code</th>
            <th style="width: 75px; text-align: center;">Image</th>
            <th style="text-align: left;">Name</th>
            <th style="width: 75px; text-align: right;">MRP</th>
            <th style="width: 55px; text-align: right;">Qty</th>
            <th style="width: 75px; text-align: right;">Total</th>
            <th style="width: 80px; text-align: right;">Net Amt.</th>
          </tr>
        `;
      };

      return `
        <div class="area-section">
          <div class="area-header-bar">${areaName}</div>
          <table class="items-table">
            <thead>
              ${getTableHeader()}
            </thead>
            <tbody>
              ${items.map(item => {
                const qty = Number(item.quantity ?? item.confirmedQty ?? 1);
                const confirmedQty = Number(item.confirmedQty ?? qty);
                const pendingQty = Math.max(0, qty - confirmedQty);
                const mrp = Number(item.mrp ?? item.rate ?? item.mrpSnapshot ?? 0);
                const discPct = Number(item.discountPercent ?? item.discountPct ?? 0);
                const gstPct = payWithGst ? Number(item.gstPercent ?? item.gstPctSnapshot ?? 18) : 0;

                const lineGross = qty * mrp;
                const lineDisc = (lineGross * discPct) / 100;
                const lineTaxable = lineGross - lineDisc;
                const lineGst = payWithGst ? (lineTaxable * gstPct) / 100 : 0;
                const lineNet = lineTaxable + lineGst;

                const sku = item.sku || item.companySku || item.skuCodeSnapshot || item.productCode || '-';
                const name = item.productName || item.productNameSnapshot || item.name || 'Ceramic Item';
                const rawImg = item.imageSnapshot || item.productImage || item.image || item.product?.imageUrl || item.imageUrl || item.product?.image || item.product?.drawingImage || item.drawingImage || item.photo || '';
                const imageSrc = resolveImageUrl(rawImg);
                const remark = item.remarks || item.remark || '';

                const imageCell = `
                  <td style="text-align: center; padding: 3px;">
                    ${imageSrc 
                      ? `<img src="${imageSrc}" class="item-thumbnail" alt="${sku}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><div class="no-img-box" style="display:none;">No Img</div>` 
                      : '<div class="no-img-box">No Img</div>'}
                  </td>
                `;

                // Format 5: Dispatch/Plumber (Photo 2)
                if (isFormat5) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                      <td style="font-weight: 600;">${name}</td>
                      ${imageCell}
                      <td style="text-align: right; font-weight: 700;">${fmtQty(qty)}</td>
                      <td>${remark}</td>
                    </tr>
                  `;
                }

                // Format 8: Without SKU
                if (isFormat8) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      ${imageCell}
                      <td style="font-weight: 600;">${name}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: right;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(lineGross)}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 4: With Remarks
                if (isFormat4) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                      ${imageCell}
                      <td>${name}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: right;">${fmtQty(qty)}</td>
                      <td style="text-align: right; font-weight: 600;">${fmtNum(lineGross)}</td>
                      <td>${remark}</td>
                    </tr>
                  `;
                }

                // Format 3: With Discount %
                if (isFormat3) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                      ${imageCell}
                      <td>${name}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: right;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(lineGross)}</td>
                      <td style="text-align: right;">${discPct.toFixed(2)}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 2: With GST Breakdown (With GST)
                if (isFormat2) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                      ${imageCell}
                      <td>${name}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: right;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(lineGross)}</td>
                      <td style="text-align: center;">${gstPct}%</td>
                      <td style="text-align: right;">${fmtNum(lineGst)}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 7: Pending items
                if (isFormat7) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                      ${imageCell}
                      <td>${name}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: right;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(lineGross)}</td>
                      <td style="text-align: center; color: #16a34a; font-weight: 700;">${confirmedQty}</td>
                      <td style="text-align: center; color: #dc2626; font-weight: 700;">${pendingQty}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 1 / Standard Default
                return `
                  <tr>
                    <td style="text-align: center;">${areaItemSr++}</td>
                    <td style="font-weight: 600; font-family: monospace;">${sku}</td>
                    ${imageCell}
                    <td>${name}</td>
                    <td style="text-align: right;">${fmtNum(mrp)}</td>
                    <td style="text-align: right;">${fmtQty(qty)}</td>
                    <td style="text-align: right;">${fmtNum(lineGross)}</td>
                    <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }).join('');
  };

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Quotation #${qNum} - Maitri Ceramic</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm 12mm 10mm;
        }
        * {
          box-sizing: border-box;
          font-family: Arial, Helvetica, sans-serif;
        }
        body {
          margin: 0;
          padding: 0;
          color: #000000;
          font-size: 11px;
          line-height: 1.35;
          background: #ffffff;
        }
        .text-center { text-align: center; }
        .jogi-header {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          margin-bottom: 2px;
        }
        .main-brand-title {
          text-align: center;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 1px;
          margin: 0;
          color: #111827;
        }
        .quotation-bar {
          background-color: #f3f4f6;
          border-top: 1px solid #9ca3af;
          border-bottom: 1px solid #9ca3af;
          text-align: center;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 1px;
          padding: 3px 0;
          margin: 4px 0;
        }
        .contact-info-line {
          text-align: center;
          font-size: 10px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 2px;
        }
        .meta-container {
          border: 1px solid #4b5563;
          display: flex;
          margin-top: 6px;
          margin-bottom: 8px;
          font-size: 10.5px;
        }
        .meta-left {
          flex: 3;
          padding: 6px 8px;
          border-right: 1px solid #4b5563;
        }
        .meta-right {
          flex: 1.4;
          padding: 6px 8px;
        }
        .meta-row {
          display: flex;
          margin-bottom: 3px;
        }
        .meta-label {
          width: 80px;
          font-weight: 700;
        }
        .meta-val {
          flex: 1;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          border: 1px solid #4b5563;
          font-size: 10.5px;
        }
        .summary-table th {
          background-color: #e5e7eb;
          border: 1px solid #4b5563;
          padding: 4px 6px;
          font-weight: 700;
          color: #111827;
        }
        .summary-table td {
          border: 1px solid #4b5563;
          padding: 3px 6px;
        }
        .summary-table tr.total-row td {
          background-color: #f3f4f6;
          border-top: 2px solid #374151;
        }
        .area-section {
          margin-bottom: 12px;
          page-break-inside: auto;
        }
        .area-header-bar {
          background-color: #f9fafb;
          border-top: 1px dashed #6b7280;
          border-bottom: 1px dashed #6b7280;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 6px;
          margin-bottom: 4px;
          text-transform: uppercase;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          border: 1px solid #4b5563;
          font-size: 10px;
          margin-bottom: 8px;
        }
        .items-table th {
          background-color: #e5e7eb;
          border: 1px solid #4b5563;
          padding: 4px 5px;
          font-weight: 700;
          color: #111827;
        }
        .items-table td {
          border: 1px solid #9ca3af;
          padding: 3px 5px;
          vertical-align: middle;
        }
        .item-thumbnail {
          max-width: 60px;
          max-height: 48px;
          width: auto;
          height: auto;
          object-fit: contain;
          display: block;
          margin: 0 auto;
        }
        .no-img-box {
          font-size: 8.5px;
          color: #9ca3af;
          text-align: center;
        }
        .page-footer {
          text-align: right;
          font-size: 9.5px;
          font-weight: 600;
          color: #4b5563;
          margin-top: 10px;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div class="jogi-header">|| JOGI DARSHAN ||</div>
      <div class="main-brand-title">MAITRI CERAMIC</div>
      <div class="quotation-bar">QUOTATION</div>
      <div class="contact-info-line">NAVJIVAN CIRCLE, BH GAYATRI FARSAN ,UDHANA MAGDALLA ROAD ,SURAT,Gujarat</div>
      <div class="contact-info-line">Phone No : +919825137670, +916351285288</div>
      <div class="contact-info-line">Email : maitriceramic@yahoo.com</div>

      <div class="meta-container">
        <div class="meta-left">
          <div class="meta-row"><span class="meta-label">Party</span><span class="meta-val">: <strong>${custName}</strong></span></div>
          <div class="meta-row"><span class="meta-label">Address</span><span class="meta-val">: ${custAddress || ''}</span></div>
          <div class="meta-row"><span class="meta-label">Mobile</span><span class="meta-val">: ${custMobile || ''}</span></div>
          <div class="meta-row">
            <span class="meta-label">Refrence</span>
            <span class="meta-val">: ${refName} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Mobile : ${refMobile}</span>
          </div>
          <div class="meta-row"><span class="meta-label">Remark</span><span class="meta-val">: ${remarkText}</span></div>
        </div>
        <div class="meta-right">
          <div class="meta-row"><span style="width: 50px; font-weight: 700;">No.</span><span class="meta-val">: <strong>${qNum}</strong></span></div>
          <div class="meta-row"><span style="width: 50px; font-weight: 700;">Date</span><span class="meta-val">: ${qDate}</span></div>
        </div>
      </div>

      ${renderAreaSummaryTable()}

      ${renderItemTables()}

      <div class="page-footer">
        Page 1 of 1
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
