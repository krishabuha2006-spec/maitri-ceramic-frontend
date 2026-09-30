const pdfParse = require('pdf-parse');
const { generateHeaderSignature, proposeDefaultMapping } = require('./excelParser.service');

/**
 * Parse PDF buffer and attempt tabular text extraction
 * @param {Buffer} buffer
 * @returns {Promise<{ isStructured: boolean, headers?: string[], rows?: Array<Object>, headerSignature?: string, suggestedMapping?: Object, message?: string }>}
 */
const parsePdfBuffer = async (buffer) => {
  try {
    const data = await pdfParse(buffer);
    const text = data.text || '';

    if (!text || text.trim().length === 0) {
      return {
        isStructured: false,
        message: 'PDF contains no extractable text. Scanned or image-only PDFs are not supported for automated extraction.'
      };
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      return {
        isStructured: false,
        message: 'PDF content is insufficient to form a tabular dataset.'
      };
    }

    // Attempt to identify a header line containing common table tokens
    let headerIndex = -1;
    let delimiter = null;

    for (let i = 0; i < Math.min(lines.length, 10); i++) {
      const line = lines[i];
      if (/sku|product|item|mrp|rate|price|gst|hsn/i.test(line)) {
        headerIndex = i;
        // Detect delimiter (tab, pipe, comma, or 2+ spaces)
        if (line.includes('\t')) delimiter = '\t';
        else if (line.includes('|')) delimiter = '|';
        else if (line.includes(',')) delimiter = ',';
        else if (/\s{2,}/.test(line)) delimiter = /\s{2,}/;
        break;
      }
    }

    if (headerIndex === -1 || !delimiter) {
      return {
        isStructured: false,
        message: 'Could not detect a clean tabular header row in the PDF. Please convert or re-save as Excel.'
      };
    }

    const rawHeaders = lines[headerIndex]
      .split(delimiter)
      .map((h) => h.trim())
      .filter(Boolean);

    if (rawHeaders.length < 2) {
      return {
        isStructured: false,
        message: 'Detected PDF table has fewer than 2 columns.'
      };
    }

    const headerSignature = generateHeaderSignature(rawHeaders);
    const suggestedMapping = proposeDefaultMapping(rawHeaders);

    const rows = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
      const rowLine = lines[i];
      // Skip page numbers or footers
      if (/^page \d+/i.test(rowLine)) continue;

      const cells = rowLine.split(delimiter).map((c) => c.trim());
      if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) continue;

      const rowObj = {};
      rawHeaders.forEach((hdr, idx) => {
        rowObj[hdr] = cells[idx] !== undefined ? cells[idx] : '';
      });
      rows.push(rowObj);
    }

    if (rows.length === 0) {
      return {
        isStructured: false,
        message: 'No data rows could be extracted under the detected header row.'
      };
    }

    return {
      isStructured: true,
      headers: rawHeaders,
      rows,
      headerSignature,
      suggestedMapping
    };
  } catch (err) {
    return {
      isStructured: false,
      message: `PDF extraction failed: ${err.message}`
    };
  }
};

module.exports = {
  parsePdfBuffer
};
