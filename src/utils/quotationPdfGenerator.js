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

  const rawKey = String(activeFormat || quotation.formatKey || quotation.quotationType || 'STANDARD').toUpperCase().trim();
  
  const isFormat8 = rawKey.includes('WITHOUT_SKU') || rawKey.includes('WITHOUT SKU') || rawKey.includes('NO_SKU') || rawKey === '8' || rawKey === 'FORMAT_8' || rawKey === 'FMT-06';
  const isFormat7 = rawKey.includes('PENDING') || rawKey === '7' || rawKey === 'FORMAT_7' || rawKey === 'FMT-03';
  const isFormat6 = rawKey.includes('DETAILED') || rawKey.includes('COMPACT') || rawKey === '6' || rawKey === 'FORMAT_6' || rawKey === 'FMT-08';
  const isFormat5 = rawKey.includes('PLUMBER') || rawKey.includes('DISPATCH') || rawKey === '5' || rawKey === 'FORMAT_5' || rawKey === 'FMT-04';
  const isFormat4 = (rawKey.includes('MRP') || rawKey.includes('REMARK')) && !isFormat7 && !isFormat8;
  const isFormat3 = rawKey.includes('DISCOUNT') && !isFormat7 && !isFormat8;
  const isFormat2 = (rawKey.includes('GST') || rawKey.includes('WITH_GST')) && !isFormat7 && !isFormat8;
  const isFormat1 = (!isFormat2 && !isFormat3 && !isFormat4 && !isFormat5 && !isFormat6 && !isFormat7 && !isFormat8) || rawKey.includes('STANDARD') || rawKey === '1' || rawKey === 'FORMAT_1' || rawKey === 'FMT-07';

  const payWithGst = isFormat2 || Boolean(quotation.payWithGst);

  const qNum = quotation.quotationNumber || quotation.id || 'B-878';
  const qDate = formatDate(quotation.date || quotation.quotationDate || new Date());
  const custName = quotation.customerName || quotation.customer?.customerName || quotation.partyName || 'Valued Customer';
  const custMobile = quotation.customerContact || quotation.customer?.mobile || quotation.mobile || '';
  const custAddress = quotation.customerAddress || quotation.customer?.billingAddress || quotation.address || '';
  const refName = quotation.reference || quotation.salesperson?.name || quotation.salesperson || '';
  const refMobile = quotation.referenceMobile || quotation.salespersonMobile || '';
  const remarkText = quotation.remarks || quotation.termsAndConditions || 'PAYMENT 100% ADVANCED. GOODS ONCE SOLD WILL NOT BE RETURNED.';

  const rawItems = Array.isArray(quotation.items) ? quotation.items : [];

  // Group items by Area (if any)
  const areaMap = {};
  rawItems.forEach((item, originalIdx) => {
    const areaName = (item.area || 'General Area').trim();
    if (!areaMap[areaName]) {
      areaMap[areaName] = [];
    }
    areaMap[areaName].push({ ...item, originalIdx });
  });

  const distinctAreas = Object.keys(areaMap);
  const hasMultipleAreas = distinctAreas.length > 1 && !(distinctAreas.length === 1 && (distinctAreas[0] === 'General Area' || distinctAreas[0] === 'General'));

  // Calculate Area and Overall Totals
  const areaSummaries = [];
  let grandNetTotal = 0;
  let grandGrossTotal = 0;
  let grandDiscountTotal = 0;
  let grandTaxableTotal = 0;
  let grandGstTotal = 0;
  let grandQuotedQty = 0;
  let grandConfirmedQty = 0;
  let grandPendingQty = 0;
  let grandQuotedTotalAmt = 0;
  let grandConfirmedTotalAmt = 0;
  let grandPendingTotalAmt = 0;

  let areaIdxCounter = 1;
  for (const [areaName, areaItems] of Object.entries(areaMap)) {
    let areaNet = 0;
    areaItems.forEach(item => {
      const qty = Number(item.quantity ?? item.confirmedQty ?? 1);
      const confQty = Number(item.confirmedQty ?? qty);
      const pendQty = Math.max(0, qty - confQty);
      const mrp = Number(item.mrp ?? item.rate ?? item.quotedRate ?? item.mrpSnapshot ?? 0);
      const rate = Number(item.rate ?? item.quotedRate ?? mrp);
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

      grandQuotedQty += qty;
      grandConfirmedQty += confQty;
      grandPendingQty += pendQty;
      grandQuotedTotalAmt += (qty * rate);
      grandConfirmedTotalAmt += (confQty * rate);
      grandPendingTotalAmt += (pendQty * rate);
    });

    areaSummaries.push({
      sr: areaIdxCounter++,
      area: areaName,
      netAmount: areaNet
    });
  }

  // Format Helpers
  const fmtNum = (val) => Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtQty = (val) => Number(val || 0).toFixed(0);

  // 1. Render Area Summary Table (Used in Formats 1, 2, 3, 4, only if distinct areas exist)
  const renderAreaSummaryTable = () => {
    if (isFormat5 || isFormat6 || isFormat7 || isFormat8) return '';
    if (!hasMultipleAreas) return '';

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

  // 2. Render Pending Items Executive Summary Box
  const renderPendingSummaryBox = () => {
    if (!isFormat7) return '';

    const supplyPercent = grandQuotedQty > 0 ? Math.round((grandConfirmedQty / grandQuotedQty) * 100) : 100;

    return `
      <div style="border: 1.5px solid #2563eb; background-color: #f8fafc; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
        <div style="flex: 1;">
          <div style="font-size: 11px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; margin-bottom: 3px;">
            PENDING SUPPLY STATUS & ORDER REALIZATION BREAKDOWN
          </div>
          <div style="display: flex; gap: 15px; color: #334155;">
            <div>Quoted Items: <strong>${rawItems.length}</strong></div>
            <div>Total Quoted Qty: <strong>${grandQuotedQty}</strong></div>
            <div>Supplied Qty: <strong style="color: #16a34a;">${grandConfirmedQty}</strong></div>
            <div>Pending Balance Qty: <strong style="color: ${grandPendingQty > 0 ? '#dc2626' : '#16a34a'};">${grandPendingQty}</strong></div>
          </div>
        </div>
        <div style="display: flex; gap: 12px; text-align: right;">
          <div style="border-right: 1px solid #cbd5e1; padding-right: 10px;">
            <div style="font-size: 8.5px; color: #64748b; font-weight: 700;">QUOTED TOTAL</div>
            <div style="font-size: 12px; font-weight: 800; color: #1e293b;">₹${fmtNum(grandQuotedTotalAmt)}</div>
          </div>
          <div style="border-right: 1px solid #cbd5e1; padding-right: 10px;">
            <div style="font-size: 8.5px; color: #16a34a; font-weight: 700;">SUPPLIED TOTAL</div>
            <div style="font-size: 12px; font-weight: 800; color: #16a34a;">₹${fmtNum(grandConfirmedTotalAmt)}</div>
          </div>
          <div>
            <div style="font-size: 8.5px; color: #dc2626; font-weight: 700;">PENDING BALANCE</div>
            <div style="font-size: 12px; font-weight: 800; color: #dc2626;">₹${fmtNum(grandPendingTotalAmt)}</div>
          </div>
        </div>
      </div>
    `;
  };

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

  // Render Line Items per Area / Continuous Table
  const renderItemTables = () => {
    // Format 6: Single compact continuous table without images
    if (isFormat6) {
      let overallSr = 1;
      return `
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">Sr.</th>
              <th style="width: 120px; text-align: left;">SKU Code</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 80px; text-align: left;">Brand</th>
              <th style="width: 65px; text-align: right;">MRP (₹)</th>
              <th style="width: 45px; text-align: center;">Qty</th>
              <th style="width: 65px; text-align: right;">Rate (₹)</th>
              <th style="width: 55px; text-align: right;">Disc%</th>
              <th style="width: 75px; text-align: right;">Net Amt.</th>
            </tr>
          </thead>
          <tbody>
            ${rawItems.map(item => {
              const qty = Number(item.quantity ?? item.confirmedQty ?? 1);
              const mrp = Number(item.mrp ?? item.rate ?? item.mrpSnapshot ?? 0);
              const rate = Number(item.rate ?? item.quotedRate ?? mrp);
              const discPct = Number(item.discountPercent ?? item.discountPct ?? 0);
              const total = qty * rate;
              const net = total * (1 - discPct / 100) * (payWithGst ? (1 + (Number(item.gstPercent || 18) / 100)) : 1);
              const sku = item.sku || item.companySku || item.skuCodeSnapshot || item.productCode || '-';
              const name = item.productName || item.productNameSnapshot || item.name || 'Ceramic Item';
              const brand = item.company || item.brand || item.companySnapshot || '-';

              return `
                <tr>
                  <td style="text-align: center;">${overallSr++}</td>
                  <td style="font-weight: 600; font-family: monospace; font-size: 9.5px;">${sku}</td>
                  <td>
                    <div style="font-weight: 600;">${name}</div>
                    ${item.remarks ? `<div style="font-size: 8.5px; color: #64748b;">${item.remarks}</div>` : ''}
                  </td>
                  <td style="color: #374151;">${brand}</td>
                  <td style="text-align: right;">${fmtNum(mrp)}</td>
                  <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                  <td style="text-align: right;">${fmtNum(rate)}</td>
                  <td style="text-align: right;">${discPct > 0 ? discPct.toFixed(1) + '%' : '-'}</td>
                  <td style="text-align: right; font-weight: 700;">${fmtNum(net)}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row" style="background-color: #f3f4f6; font-weight: 800;">
              <td colspan="8" style="text-align: right; padding-right: 10px;">GRAND TOTAL :</td>
              <td style="text-align: right; font-size: 11px;">₹${fmtNum(grandNetTotal)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Formats 1, 2, 3, 4, 5, 7, 8
    return Object.entries(areaMap).map(([areaName, items]) => {
      let areaItemSr = 1;

      // Table Header by Format
      const getTableHeader = () => {
        if (isFormat5) {
          // Format 5 (Plumber / Dispatch): Sr | SKU Code | Image | Product Name | Brand | Qty | Remarks
          return `
            <tr>
              <th style="width: 30px; text-align: center;">Sr.</th>
              <th style="width: 110px; text-align: left;">SKU Code</th>
              <th style="width: 60px; text-align: center;">Image</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 75px; text-align: left;">Brand</th>
              <th style="width: 45px; text-align: center;">Qty</th>
              <th style="width: 110px; text-align: left;">Remarks / Instructions</th>
            </tr>
          `;
        }

        if (isFormat8) {
          // Format 8 (Without SKU Code): Clean customer quote without internal SKU codes
          return `
            <tr>
              <th style="width: 30px; text-align: center;">Sr.</th>
              <th style="width: 65px; text-align: center;">Image</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 80px; text-align: left;">Brand</th>
              <th style="width: 65px; text-align: right;">MRP (₹)</th>
              <th style="width: 45px; text-align: center;">Qty</th>
              <th style="width: 65px; text-align: right;">Rate (₹)</th>
              <th style="width: 55px; text-align: right;">Disc%</th>
              <th style="width: 75px; text-align: right;">Net Amt (₹)</th>
            </tr>
          `;
        }

        if (isFormat7) {
          // Format 7 (Pending Items Detailed Breakdown):
          return `
            <tr>
              <th style="width: 26px; text-align: center;">Sr.</th>
              <th style="width: 85px; text-align: left;">SKU Code</th>
              <th style="width: 55px; text-align: center;">Image</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 60px; text-align: left;">Brand</th>
              <th style="width: 42px; text-align: center;">Quoted</th>
              <th style="width: 45px; text-align: center;">Supplied</th>
              <th style="width: 45px; text-align: center;">Pending</th>
              <th style="width: 55px; text-align: right;">Rate (₹)</th>
              <th style="width: 65px; text-align: right;">Quoted Total</th>
              <th style="width: 65px; text-align: right;">Supplied Total</th>
              <th style="width: 68px; text-align: right;">Pending Total</th>
              <th style="width: 55px; text-align: center;">Status</th>
            </tr>
          `;
        }

        if (isFormat2) {
          // Format 2 (With GST): Sr | SKU Code | Image | Name | Brand | MRP | Qty | Rate | GST% | GST Amt | Net Amt.
          return `
            <tr>
              <th style="width: 28px; text-align: center;">Sr.</th>
              <th style="width: 95px; text-align: left;">SKU Code</th>
              <th style="width: 55px; text-align: center;">Image</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 65px; text-align: left;">Brand</th>
              <th style="width: 55px; text-align: right;">MRP (₹)</th>
              <th style="width: 40px; text-align: center;">Qty</th>
              <th style="width: 55px; text-align: right;">Rate (₹)</th>
              <th style="width: 45px; text-align: center;">GST%</th>
              <th style="width: 55px; text-align: right;">GST (₹)</th>
              <th style="width: 70px; text-align: right;">Net Amt (₹)</th>
            </tr>
          `;
        }

        if (isFormat3) {
          // Format 3 (Discount): Sr | SKU Code | Image | Name | Brand | MRP | Qty | Rate | Disc% | Net Amt.
          return `
            <tr>
              <th style="width: 28px; text-align: center;">Sr.</th>
              <th style="width: 100px; text-align: left;">SKU Code</th>
              <th style="width: 55px; text-align: center;">Image</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 75px; text-align: left;">Brand</th>
              <th style="width: 65px; text-align: right;">MRP (₹)</th>
              <th style="width: 45px; text-align: center;">Qty</th>
              <th style="width: 65px; text-align: right;">Rate (₹)</th>
              <th style="width: 55px; text-align: right;">Disc%</th>
              <th style="width: 75px; text-align: right;">Net Amt (₹)</th>
            </tr>
          `;
        }

        if (isFormat4) {
          // Format 4 (MRP / Remarks): Sr | SKU Code | Image | Name | Brand | MRP | Qty | Total | Remarks
          return `
            <tr>
              <th style="width: 28px; text-align: center;">Sr.</th>
              <th style="width: 100px; text-align: left;">SKU Code</th>
              <th style="width: 55px; text-align: center;">Image</th>
              <th style="text-align: left;">Product / Item Description</th>
              <th style="width: 75px; text-align: left;">Brand</th>
              <th style="width: 65px; text-align: right;">MRP (₹)</th>
              <th style="width: 45px; text-align: center;">Qty</th>
              <th style="width: 70px; text-align: right;">Total MRP</th>
              <th style="width: 90px; text-align: left;">Remarks</th>
            </tr>
          `;
        }

        // Format 1 / Standard Default: Sr | SKU Code | Image | Name | Brand | MRP | Qty | Rate | Net Amt.
        return `
          <tr>
            <th style="width: 28px; text-align: center;">Sr.</th>
            <th style="width: 100px; text-align: left;">SKU Code</th>
            <th style="width: 55px; text-align: center;">Image</th>
            <th style="text-align: left;">Product / Item Description</th>
            <th style="width: 75px; text-align: left;">Brand</th>
            <th style="width: 65px; text-align: right;">MRP (₹)</th>
            <th style="width: 45px; text-align: center;">Qty</th>
            <th style="width: 65px; text-align: right;">Rate (₹)</th>
            <th style="width: 75px; text-align: right;">Net Amt (₹)</th>
          </tr>
        `;
      };

      return `
        <div class="area-section">
          ${hasMultipleAreas ? `<div class="area-header-bar">${areaName}</div>` : ''}
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
                const rate = Number(item.rate ?? item.quotedRate ?? mrp);
                const discPct = Number(item.discountPercent ?? item.discountPct ?? 0);
                const gstPct = payWithGst ? Number(item.gstPercent ?? item.gstPctSnapshot ?? 18) : 0;

                const lineGross = qty * mrp;
                const lineDisc = (lineGross * discPct) / 100;
                const lineTaxable = lineGross - lineDisc;
                const lineGst = payWithGst ? (lineTaxable * gstPct) / 100 : 0;
                const lineNet = lineTaxable + lineGst;

                const quotedAmt = qty * rate;
                const suppliedAmt = confirmedQty * rate;
                const pendingAmt = pendingQty * rate;

                const sku = item.sku || item.companySku || item.skuCodeSnapshot || item.productCode || '-';
                const name = item.productName || item.productNameSnapshot || item.name || 'Ceramic Item';
                const brand = item.company || item.brand || item.companySnapshot || item.product?.company || '-';
                const rawImg = item.imageSnapshot || item.productImage || item.image || item.product?.imageUrl || item.imageUrl || item.product?.image || item.product?.drawingImage || item.drawingImage || item.photo || '';
                const imageSrc = resolveImageUrl(rawImg);
                const remark = item.remarks || item.remark || '';

                const imageCell = `
                  <td style="text-align: center; padding: 2px;">
                    ${imageSrc 
                      ? `<img src="${imageSrc}" class="item-thumbnail" alt="${sku}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';" /><div class="no-img-box" style="display:none;">No Img</div>` 
                      : '<div class="no-img-box">-</div>'}
                  </td>
                `;

                // Format 5: Dispatch / Plumber
                if (isFormat5) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace; font-size: 9.5px;">${sku}</td>
                      ${imageCell}
                      <td style="font-weight: 600;">
                        <div>${name}</div>
                        ${remark ? `<div style="font-size: 8.5px; color: #64748b;">${remark}</div>` : ''}
                      </td>
                      <td style="color: #374151;">${brand}</td>
                      <td style="text-align: center; font-weight: 700; font-size: 11px;">${fmtQty(qty)}</td>
                      <td style="font-size: 9px; color: #4b5563;">${remark || '-'}</td>
                    </tr>
                  `;
                }

                // Format 8: Without SKU Code
                if (isFormat8) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      ${imageCell}
                      <td style="font-weight: 600;">
                        <div>${name}</div>
                        ${remark ? `<div style="font-size: 8.5px; color: #64748b;">${remark}</div>` : ''}
                      </td>
                      <td style="color: #374151;">${brand}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(rate)}</td>
                      <td style="text-align: right;">${discPct > 0 ? discPct.toFixed(1) + '%' : '-'}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 7: Pending Items Detailed Breakdown
                if (isFormat7) {
                  const statusLabel = pendingQty === 0 
                    ? `<span style="color: #16a34a; font-weight: 800; font-size: 8.5px;">COMPLETE</span>`
                    : (confirmedQty > 0 
                        ? `<span style="color: #d97706; font-weight: 800; font-size: 8.5px;">PARTIAL</span>` 
                        : `<span style="color: #dc2626; font-weight: 800; font-size: 8.5px;">PENDING</span>`);

                  return `
                    <tr style="${pendingQty > 0 ? 'background-color: #fffcf0;' : ''}">
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace; font-size: 9px;">${sku}</td>
                      ${imageCell}
                      <td>
                        <div style="font-weight: 600;">${name}</div>
                        ${remark ? `<div style="font-size: 8px; color: #64748b;">${remark}</div>` : ''}
                      </td>
                      <td style="color: #374151; font-size: 9px;">${brand}</td>
                      <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                      <td style="text-align: center; color: #16a34a; font-weight: 700;">${fmtQty(confirmedQty)}</td>
                      <td style="text-align: center; color: ${pendingQty > 0 ? '#dc2626' : '#16a34a'}; font-weight: 800;">${fmtQty(pendingQty)}</td>
                      <td style="text-align: right;">${fmtNum(rate)}</td>
                      <td style="text-align: right;">${fmtNum(quotedAmt)}</td>
                      <td style="text-align: right; color: #16a34a; font-weight: 600;">${fmtNum(suppliedAmt)}</td>
                      <td style="text-align: right; color: ${pendingQty > 0 ? '#dc2626' : '#16a34a'}; font-weight: 800;">${fmtNum(pendingAmt)}</td>
                      <td style="text-align: center;">${statusLabel}</td>
                    </tr>
                  `;
                }

                // Format 4: MRP / Remarks
                if (isFormat4) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace; font-size: 9.5px;">${sku}</td>
                      ${imageCell}
                      <td style="font-weight: 600;">${name}</td>
                      <td style="color: #374151;">${brand}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineGross)}</td>
                      <td style="font-size: 9px; color: #4b5563;">${remark || '-'}</td>
                    </tr>
                  `;
                }

                // Format 3: With Discount %
                if (isFormat3) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace; font-size: 9.5px;">${sku}</td>
                      ${imageCell}
                      <td style="font-weight: 600;">
                        <div>${name}</div>
                        ${remark ? `<div style="font-size: 8.5px; color: #64748b;">${remark}</div>` : ''}
                      </td>
                      <td style="color: #374151;">${brand}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(rate)}</td>
                      <td style="text-align: right;">${discPct > 0 ? discPct.toFixed(1) + '%' : '-'}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 2: With GST Breakdown
                if (isFormat2) {
                  return `
                    <tr>
                      <td style="text-align: center;">${areaItemSr++}</td>
                      <td style="font-weight: 600; font-family: monospace; font-size: 9.5px;">${sku}</td>
                      ${imageCell}
                      <td style="font-weight: 600;">
                        <div>${name}</div>
                        ${remark ? `<div style="font-size: 8.5px; color: #64748b;">${remark}</div>` : ''}
                      </td>
                      <td style="color: #374151;">${brand}</td>
                      <td style="text-align: right;">${fmtNum(mrp)}</td>
                      <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                      <td style="text-align: right;">${fmtNum(rate)}</td>
                      <td style="text-align: center;">${gstPct}%</td>
                      <td style="text-align: right;">${fmtNum(lineGst)}</td>
                      <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                    </tr>
                  `;
                }

                // Format 1 / Standard Default
                return `
                  <tr>
                    <td style="text-align: center;">${areaItemSr++}</td>
                    <td style="font-weight: 600; font-family: monospace; font-size: 9.5px;">${sku}</td>
                    ${imageCell}
                    <td style="font-weight: 600;">
                      <div>${name}</div>
                      ${remark ? `<div style="font-size: 8.5px; color: #64748b;">${remark}</div>` : ''}
                    </td>
                    <td style="color: #374151;">${brand}</td>
                    <td style="text-align: right;">${fmtNum(mrp)}</td>
                    <td style="text-align: center; font-weight: 600;">${fmtQty(qty)}</td>
                    <td style="text-align: right;">${fmtNum(rate)}</td>
                    <td style="text-align: right; font-weight: 700;">${fmtNum(lineNet)}</td>
                  </tr>
                `;
              }).join('')}
              ${!isFormat5 ? `
                <tr class="total-row" style="background-color: #f8fafc; font-weight: 800;">
                  <td colspan="${isFormat7 ? 9 : (isFormat8 ? 7 : (isFormat2 ? 9 : 7))}" style="text-align: right; padding-right: 10px;">
                    ${isFormat7 ? 'TOTALS :' : 'TOTAL AMOUNT :'}
                  </td>
                  ${isFormat7 ? `
                    <td style="text-align: right;">₹${fmtNum(grandQuotedTotalAmt)}</td>
                    <td style="text-align: right; color: #16a34a;">₹${fmtNum(grandConfirmedTotalAmt)}</td>
                    <td style="text-align: right; color: #dc2626;">₹${fmtNum(grandPendingTotalAmt)}</td>
                    <td></td>
                  ` : `
                    <td colspan="${isFormat2 ? 2 : 1}" style="text-align: right; font-size: 11px;">₹${fmtNum(grandNetTotal)}</td>
                  `}
                </tr>
              ` : ''}
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

      ${renderPendingSummaryBox()}

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
