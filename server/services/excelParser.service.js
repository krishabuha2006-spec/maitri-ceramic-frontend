const XLSX = require('xlsx');
const crypto = require('crypto');

/**
 * Generate a deterministic hash signature from an array of header strings
 * @param {Array<string>} headers
 * @returns {string} SHA-256 hex signature
 */
const generateHeaderSignature = (headers) => {
  const normalized = headers
    .map((h) => String(h || '').trim().toUpperCase())
    .filter(Boolean)
    .sort()
    .join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
};

/**
 * Propose best-guess system field mapping based on raw column header text
 * @param {Array<string>} headers
 * @returns {Object} { [rawHeader]: systemField }
 */
const proposeDefaultMapping = (headers) => {
  const mapping = {};

  for (const rawHeader of headers) {
    const clean = String(rawHeader || '').trim().toLowerCase().replace(/[\s_\-\/]+/g, ' ');

    if (/^(company sku|company sku code|sku code|skucode|sku|item code|product code|code)$/.test(clean)) {
      mapping[rawHeader] = 'companySkuCode';
    } else if (/^(vendor sku|vendor sku code|vendor code|supplier sku|mfg code)$/.test(clean)) {
      mapping[rawHeader] = 'vendorSkuCode';
    } else if (/^(full description|product description|product name|product|item name|item description|description|name)$/.test(clean)) {
      mapping[rawHeader] = 'productName';
    } else if (/^(hsn|hsn code|hsn sac|sac)$/.test(clean)) {
      mapping[rawHeader] = 'hsnCode';
    } else if (/^(company|brand|manufacturer)$/.test(clean)) {
      mapping[rawHeader] = 'company';
    } else if (/^(product category|category|product group|group)$/.test(clean)) {
      mapping[rawHeader] = 'productGroup';
    } else if (/^(product type|type)$/.test(clean)) {
      mapping[rawHeader] = 'productType';
    } else if (/^(product sub type|sub type|subtype)$/.test(clean)) {
      mapping[rawHeader] = 'productSubType';
    } else if (/^(range size|range|size|tile size|dimensions)$/.test(clean)) {
      mapping[rawHeader] = 'rangeOrSize';
    } else if (/^(colour name|colour|color name|color|finish|finish color)$/.test(clean)) {
      mapping[rawHeader] = 'colourName';
    } else if (/^(product image|image url|image|photo|picture|url)$/.test(clean)) {
      mapping[rawHeader] = 'productImage';
    } else if (/^(vendor|supplier|party)$/.test(clean)) {
      mapping[rawHeader] = 'vendor';
    } else if (/^(unit|uom|unit of measurement)$/.test(clean)) {
      mapping[rawHeader] = 'unit';
    } else if (/^(mrp|m r p|mrp rate)$/.test(clean)) {
      mapping[rawHeader] = 'mrp';
    } else if (/^(purchase|purchase rate|purchase price|cost rate|cost)$/.test(clean)) {
      mapping[rawHeader] = 'purchaseRate';
    } else if (/^(sale|sale price|selling price|sale rate|rate)$/.test(clean)) {
      mapping[rawHeader] = 'salePrice';
    } else if (/^(gst|gst %|gst pct|tax|tax %|tax pct)$/.test(clean)) {
      mapping[rawHeader] = 'gstPct';
    } else if (/^(qty|quantity|opening stock|stock|opening qty|stock qty|stock quantity|current stock|available stock|total stock|opening stock boxes)$/.test(clean)) {
      mapping[rawHeader] = 'openingStock';
    } else if (/^(pcs per box|pieces per box|pieces|pcs)$/.test(clean)) {
      mapping[rawHeader] = 'piecesPerBox';
    } else if (/^(sqft per box|coverage area|sqft|area)$/.test(clean)) {
      mapping[rawHeader] = 'sqftPerBox';
    } else if (/^(weight per box|weight kg|weight)$/.test(clean)) {
      mapping[rawHeader] = 'weightPerBox';
    } else if (/^(alert stock|alert stock qty|alert qty|alert|reorder level|reorder alert|reorder alert qty|min stock|reorder)$/.test(clean)) {
      mapping[rawHeader] = 'reorderAlertQty';
    } else if (/^(status|active|is active|isactive)$/.test(clean)) {
      mapping[rawHeader] = 'status';
    }
  }

  return mapping;
};

const JSZip = require('jszip');

/**
 * Parse Excel / CSV buffer into structured rows, headers, and signature
 * @param {Buffer} buffer
 * @returns {Promise<{ sheetName: string, headers: string[], rows: Array<Object>, headerSignature: string, suggestedMapping: Object }>}
 */
const parseExcelBuffer = async (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel workbook contains no sheets.');
  }

  // Auto-detect the sheet with the largest data table (e.g. Roca Portfolio V instead of pivot summary)
  let bestSheetName = workbook.SheetNames[0];
  let maxRowCount = 0;

  for (const sheetName of workbook.SheetNames) {
    const s = workbook.Sheets[sheetName];
    if (s && s['!ref']) {
      const range = XLSX.utils.decode_range(s['!ref']);
      const rowCount = range.e.r - range.s.r + 1;
      if (rowCount > maxRowCount) {
        maxRowCount = rowCount;
        bestSheetName = sheetName;
      }
    }
  }

  // Extract embedded drawing images from xlsx zip archive
  const rowImageMap = {};
  try {
    const zip = await JSZip.loadAsync(buffer);
    const drawingRelsFiles = Object.keys(zip.files).filter((f) => f.startsWith('xl/drawings/_rels/'));

    for (const relsFile of drawingRelsFiles) {
      const relsXml = await zip.file(relsFile)?.async('text');
      const drawingXmlFile = relsFile.replace('_rels/', '').replace('.rels', '');
      const drawingXml = await zip.file(drawingXmlFile)?.async('text');

      if (relsXml && drawingXml) {
        const relMap = {};
        const relRegex = /Id="([^"]+)"[^>]*Target="([^"]+)"/g;
        let rm;
        while ((rm = relRegex.exec(relsXml)) !== null) {
          let target = rm[2];
          if (target.startsWith('../media/')) {
            target = 'xl/media/' + target.replace('../media/', '');
          } else if (!target.startsWith('xl/')) {
            target = 'xl/' + target;
          }
          relMap[rm[1]] = target;
        }

        const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
        let am;
        while ((am = anchorRegex.exec(drawingXml)) !== null) {
          const anchorContent = am[1];
          const rowMatch = anchorContent.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
          const blipMatch = anchorContent.match(/<a:blip[^>]*r:embed="([^"]+)"/);

          if (rowMatch && blipMatch) {
            const rowIdx = parseInt(rowMatch[1], 10);
            const rId = blipMatch[1];
            const imagePath = relMap[rId];
            if (imagePath && zip.file(imagePath)) {
              const imgFile = zip.file(imagePath);
              const b64 = await imgFile.async('base64');
              const ext = imagePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
              rowImageMap[rowIdx] = `data:image/${ext};base64,${b64}`;
            }
          }
        }
      }
    }
  } catch (zipErr) {
    console.warn('[ExcelParser] Embedded image extraction warning:', zipErr.message);
  }

  const sheet = workbook.Sheets[bestSheetName];
  const rawJson = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  if (!rawJson || rawJson.length === 0) {
    throw new Error('Uploaded Excel file is empty.');
  }

  // Row 0 is headers (trimmed and sanitized)
  const headerRow = rawJson[0];
  const headers = headerRow.map((h, i) => String(h || `Column_${i + 1}`).trim()).filter(Boolean);

  const headerSignature = generateHeaderSignature(headers);
  const suggestedMapping = proposeDefaultMapping(headers);

  // Parse data rows
  const rows = [];
  for (let i = 1; i < rawJson.length; i++) {
    const rowValues = rawJson[i];
    const hasData = rowValues.some((cell) => cell !== '' && cell !== null && cell !== undefined);
    if (!hasData) continue;

    const rowObj = {};
    headers.forEach((hdr, idx) => {
      rowObj[hdr] = rowValues[idx] !== undefined ? rowValues[idx] : '';
    });

    // Attach embedded image if available
    const embeddedImg = rowImageMap[i] || rowImageMap[i - 1];
    if (embeddedImg) {
      rowObj.productImage = embeddedImg;
      rowObj['PRODUCT IMAGE'] = embeddedImg;
    }

    rows.push(rowObj);
  }

  return {
    sheetName: bestSheetName,
    headers,
    rows,
    headerSignature,
    suggestedMapping
  };
};

module.exports = {
  parseExcelBuffer,
  generateHeaderSignature,
  proposeDefaultMapping
};
