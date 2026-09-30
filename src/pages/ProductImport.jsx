import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { previewImportFile, commitImportBatch, getImportBatches } from '../services/importService';
import { createProduct, getCompanies, getProductGroups } from '../services/productService';
import { generateTileTitle } from './ProductForm';
import StatusBadge from '../components/StatusBadge';
import {
  UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, Download,
  ExternalLink, ArrowLeft, RefreshCw, Check, XCircle, Info, Sparkles
} from 'lucide-react';

export const ProductImport = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [companiesList, setCompaniesList] = useState([]);
  const [groupsList, setGroupsList] = useState([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    loadHistory();
    getCompanies().then(c => Array.isArray(c) && setCompaniesList(c)).catch(() => { });
    getProductGroups().then(g => Array.isArray(g) && setGroupsList(g)).catch(() => { });
  }, []);

  const loadHistory = async () => {
    try {
      const res = await getImportBatches();
      setHistory(res.data?.batches || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Download Sample Excel Sheet with Roca & Tiles format
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      {
        'SKUCODE': 'SOM-STAT-60120',
        'Product Category': 'Tiles',
        'RANGE/ SIZE': '600x1200mm (2x4 Ft)',
        'FULL DESCRIPTION': '', // Blank for tiles, system automatically builds name from Size & Finish
        'Product Type': 'Glazed Vitrified Tiles',
        'Product Sub Type': 'High Gloss GVT',
        'COLOUR NAME': 'Statuario White',
        'COMPANY': 'Somany',
        'HSN Code': '69072100',
        'Purchase Price (₹)': 480,
        'MRP (₹)': 790,
        'Stock Qty': 150,
        'Pcs Per Box': 2,
        'Coverage Area (Sq.Ft)': 15.5,
        'Weight Per Box (kg)': 29.0,
        'PRODUCT IMAGE': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&auto=format&fit=crop&q=80'
      },
      {
        'SKUCODE': 'SOM-ONYX-120240',
        'Product Category': 'Tiles',
        'RANGE/ SIZE': '1200x2400mm (4x8 Ft)',
        'FULL DESCRIPTION': '', // Blank for tiles
        'Product Type': 'Porcelain Slabs',
        'Product Sub Type': 'Bookmatch Slabs',
        'COLOUR NAME': 'Royal Onyx Jade Gold',
        'COMPANY': 'Somany',
        'HSN Code': '69072100',
        'Purchase Price (₹)': 2400,
        'MRP (₹)': 3850,
        'Stock Qty': 40,
        'Pcs Per Box': 1,
        'Coverage Area (Sq.Ft)': 31.0,
        'Weight Per Box (kg)': 62.0,
        'PRODUCT IMAGE': 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=600&auto=format&fit=crop&q=80'
      },
      {
        'SKUCODE': 'ROCA-INSP-WC-01',
        'Product Category': 'Sanitaryware',
        'RANGE/ SIZE': 'Inspira',
        'FULL DESCRIPTION': 'Roca Inspira Round Rimless Wall Hung Water Closet with UF Soft Close Seat Cover White',
        'Product Type': 'Water Closet',
        'Product Sub Type': 'Wall Hung WC',
        'COLOUR NAME': 'Glossy White',
        'COMPANY': 'ROCA',
        'HSN Code': '69109000',
        'Purchase Price (₹)': 14500,
        'MRP (₹)': 22500,
        'Stock Qty': 25,
        'Pcs Per Box': 1,
        'Coverage Area (Sq.Ft)': 0,
        'Weight Per Box (kg)': 24.5,
        'PRODUCT IMAGE': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop&q=80'
      },
      {
        'SKUCODE': 'ROCA-L90-BASIN',
        'Product Category': 'Sanitaryware',
        'RANGE/ SIZE': 'L90',
        'FULL DESCRIPTION': 'Roca L90 Countertop Vessel Wash Basin 550x420mm White',
        'Product Type': 'Wash Basin',
        'Product Sub Type': 'Countertop Basin',
        'COLOUR NAME': 'White',
        'COMPANY': 'ROCA',
        'HSN Code': '69109000',
        'Purchase Price (₹)': 4800,
        'MRP (₹)': 7400,
        'Stock Qty': 30,
        'Pcs Per Box': 1,
        'Coverage Area (Sq.Ft)': 0,
        'Weight Per Box (kg)': 12.0,
        'PRODUCT IMAGE': 'https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=600&auto=format&fit=crop&q=80'
      },
      {
        'SKUCODE': 'ROCA-INSP-FAUCET',
        'Product Category': 'Faucets',
        'RANGE/ SIZE': 'Inspira Round',
        'FULL DESCRIPTION': 'Roca Inspira High Neck Basin Mixer with Cold Start Chrome',
        'Product Type': 'Basin Mixer',
        'Product Sub Type': 'Tall Body Mixer',
        'COLOUR NAME': 'Chrome',
        'COMPANY': 'ROCA',
        'HSN Code': '84818020',
        'Purchase Price (₹)': 3200,
        'MRP (₹)': 5100,
        'Stock Qty': 50,
        'Pcs Per Box': 1,
        'Coverage Area (Sq.Ft)': 0,
        'Weight Per Box (kg)': 2.5,
        'PRODUCT IMAGE': 'https://images.unsplash.com/photo-1584622781867-1c5c7d81a966?w=600&auto=format&fit=crop&q=80'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws['!cols'] = [
      { wch: 18 }, // SKUCODE
      { wch: 18 }, // Product Category
      { wch: 22 }, // RANGE/ SIZE
      { wch: 45 }, // FULL DESCRIPTION
      { wch: 24 }, // Product Type
      { wch: 20 }, // Product Sub Type
      { wch: 20 }, // COLOUR NAME
      { wch: 15 }, // COMPANY
      { wch: 14 }, // HSN Code
      { wch: 18 }, // Purchase Price (₹)
      { wch: 14 }, // MRP (₹)
      { wch: 12 }, // Stock Qty
      { wch: 12 }, // Pcs Per Box
      { wch: 20 }, // Coverage Area (Sq.Ft)
      { wch: 18 }, // Weight Per Box (kg)
      { wch: 16 }  // PRODUCT IMAGE
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');
    XLSX.writeFile(wb, 'Maitri_Ceramic_Master_Product_Import_Sample.xlsx');
  };

  // Parse Excel File on Selection (With Embedded Images Extraction)
  const processExcelFile = (file) => {
    setSelectedFile(file);
    setCommitResult(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          alert('Uploaded Excel workbook contains no sheets.');
          setLoading(false);
          return;
        }

        // Auto-detect the sheet with the most rows (e.g. Roca Portfolio V instead of pivot summary)
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
          const drawingRelsFiles = Object.keys(zip.files).filter(f => f.startsWith('xl/drawings/_rels/'));

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
          console.warn('[ProductImport] Embedded image extraction:', zipErr);
        }

        const worksheet = workbook.Sheets[bestSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert('Uploaded Excel file has no data rows.');
          setLoading(false);
          return;
        }

        const normalizeKey = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

        // Helper to lookup row field ignoring leading/trailing spaces, case, and special characters
        const getField = (row, candidates) => {
          const rowKeys = Object.keys(row);
          // Pass 1: exact trimmed lowercase match
          for (const cand of candidates) {
            const cleanCand = cand.trim().toLowerCase();
            const matchedKey = rowKeys.find(k => k.trim().toLowerCase() === cleanCand);
            if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
              return String(row[matchedKey]).trim();
            }
          }
          // Pass 2: normalized alphanumeric match (e.g. "mrp (₹)" matches "mrp" or "mrp(inr)")
          for (const cand of candidates) {
            const normCand = normalizeKey(cand);
            const matchedKey = rowKeys.find(k => normalizeKey(k) === normCand);
            if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
              return String(row[matchedKey]).trim();
            }
          }
          // Pass 3: substring match
          for (const cand of candidates) {
            const normCand = normalizeKey(cand);
            if (normCand.length >= 3) {
              const matchedKey = rowKeys.find(k => normalizeKey(k).includes(normCand));
              if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null && String(row[matchedKey]).trim() !== '') {
                return String(row[matchedKey]).trim();
              }
            }
          }
          return '';
        };

        const parsed = rawJson.map((row, idx) => {
          const sku = getField(row, ['SKUCODE', 'SKU CODE', 'Item Code', 'Item Code (SKU)', 'SKU', 'Code', 'Product code', 'Item No', 'Sr.NO', 'SR.NO']) || `SKU-${idx + 1}`;
          const productName = getField(row, ['FULL DESCRIPTION', 'Product Name', 'Item Name', 'Description', 'Product Description', 'Title', 'Name', 'PRODUCT NAME', 'DESCRIPTION']);
          const category = getField(row, ['Product Category', 'Category', 'PRODUCT CATEGORY', 'Main Category']) || 'Sanitaryware';
          const productType = getField(row, ['Product Type', 'PRODUCT TYPE', 'Group', 'Product Group', 'PRODUCT GROUP', 'Type']) || 'Sanitaryware';
          const subType = getField(row, ['Product Sub Type', 'PRODUCT SUB TYPE', 'SubType', 'Sub Type', 'Sub-Type', 'SUB TYPE']) || '';
          const company = getField(row, ['COMPANY', 'COMPANY NAME', 'Company Name', 'Company / Brand', 'Company', 'Brand', 'Brand Name', 'BRAND', 'Manufacturer', 'Mfg']) || 'ROCA';
          const tileSize = getField(row, ['RANGE/ SIZE', 'RANGE / SIZE', 'Tile Size / Dimensions', 'Size', 'Dimensions', 'Dimension', 'SIZE']) || '';
          const range = getField(row, ['RANGE/ SIZE', 'RANGE / SIZE', 'Range / Collection', 'Range', 'Collection', 'RANGE']) || '';
          const finish = getField(row, ['COLOUR NAME', 'COLOR NAME', 'Colour Name', 'Color Name', 'Finish / Color', 'Finish', 'Color', 'Colour', 'FINISH']) || '';
          const hsnCode = getField(row, ['HSN Code', 'HSN', 'HSN/SAC', 'HSNCODE', 'Hsn']) || '69109000';

          // Use embedded drawing image if present, fallback to image URL text
          const embeddedImg = rowImageMap[idx + 1] || rowImageMap[idx] || '';
          const image = embeddedImg || getField(row, ['PRODUCT IMAGE', 'Product Image / URL', 'Product Image', 'Image URL', 'Image', 'Photo', 'Image Link', 'Picture', 'URL', 'IMAGE']);

          const pcsPerBox = Number(getField(row, ['Pcs Per Box', 'Pieces', 'Pcs', 'PCS', 'Pieces/Box']) || 1);
          const coverageArea = Number(getField(row, ['Coverage Area (Sq.Ft)', 'SqFt', 'Area', 'Sq.Ft', 'SQFT']) || 0);
          const weight = Number(getField(row, ['Weight Per Box (kg)', 'Weight', 'Weight Kg', 'WEIGHT', 'Weight (Kg)']) || 0);
          const purchasePrice = Number(getField(row, ['Purchase Price (₹)', 'Purchase Rate (₹)', 'Purchase Rate', 'Purchase Price', 'Cost (₹)', 'Cost Rate', 'Cost', 'PURCHASE RATE', 'PURCHASE PRICE']) || 0);
          const salePrice = Number(getField(row, ['MRP (₹)', 'MRP(₹)', 'MRP', 'MRP RATE', 'MRP Rate (₹)', 'Sale Price (₹)', 'Sale Price', 'Rate (₹)', 'Rate', 'Price (₹)', 'Price', 'SALE PRICE', 'RATE', 'PRICE', 'List Price', 'UnitPrice']) || 0);
          const gstPercent = Number(getField(row, ['GST Rate (%)', 'GST', 'GST Rate', 'Tax %', 'GST (%)', 'GST %']) || 18);
          const openingStock = Number(getField(row, ['Stock Qty', 'STOCK QTY', 'Stock Quantity', 'Stock', 'STOCK', 'Opening Stock (Boxes)', 'Opening Stock', 'Current Stock', 'Available Stock', 'Total Stock', 'Quantity', 'Qty', 'QTY']) || 0);
          const alertStock = Number(getField(row, ['Alert Stock Qty', 'Alert Stock', 'Alert Stock Quantity', 'Reorder Level', 'Reorder Alert Qty', 'Min Stock', 'Alert Qty', 'Alert', 'Alert Stock (Boxes)']) || 10);
          const status = getField(row, ['Status', 'Status (Active/Inactive)', 'Active', 'Is Active', 'STATUS']) || 'Active';
          const isTileCategory = category.toLowerCase().includes('tile') || productType.toLowerCase().includes('tile');
          const effectiveTileSize = tileSize || (isTileCategory ? range : '');

          let finalProductName = productName;
          if (!finalProductName && isTileCategory) {
            finalProductName = generateTileTitle({
              company,
              productType,
              productSubType: subType,
              size: effectiveTileSize,
              finish,
              colourName: finish
            });
          } else if (!finalProductName) {
            finalProductName = `${company} ${sku} ${productType}`.trim();
          }

          const errors = [];
          if (!finalProductName) errors.push('Product Name / Description is required');
          if (!sku) errors.push('Item Code / SKU is required');
          if (isNaN(salePrice) || salePrice < 0) errors.push('Invalid Sale Price');

          return {
            rowNumber: idx + 1,
            sku,
            productName: finalProductName,
            category,
            productType,
            subType,
            company,
            tileSize: effectiveTileSize,
            range: isTileCategory ? '' : range,
            finish,
            hsnCode,
            image,
            pcsPerBox,
            coverageArea,
            weight,
            purchasePrice,
            salePrice,
            gstPercent,
            openingStock,
            alertStock,
            status: status || 'Active',
            isActive: true,
            isValid: errors.length === 0,
            errors
          };
        });

        const validCount = parsed.filter(p => p.isValid).length;
        const invalidCount = parsed.length - validCount;

        setPreviewRows(parsed);
        setSummary({
          sheetName: bestSheetName,
          totalRows: parsed.length,
          validRowsCount: validCount,
          invalidRowsCount: invalidCount,
          fileName: file.name
        });
      } catch (err) {
        alert('Failed to parse Excel file: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processExcelFile(e.target.files[0]);
    }
  };

  // Commit and Create Products in Bulk
  const handleConfirmImport = async () => {
    const validRows = previewRows.filter(r => r.isValid);
    if (validRows.length === 0) {
      alert('No valid rows found to import.');
      return;
    }

    setLoading(true);
    setImportProgress({ current: 0, total: validRows.length });

    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const matchedComp = companiesList.find(c => (c.companyName || '').toLowerCase().trim() === (row.company || '').toLowerCase().trim());
        const matchedGroup = groupsList.find(g => (g.groupName || g.typeName || '').toLowerCase().trim() === (row.productType || '').toLowerCase().trim());

        const payload = {
          productName: row.productName,
          companySkuCode: row.sku,
          sku: row.sku,
          hsnCode: row.hsnCode || '69109000',
          category: row.category,
          productType: row.productType,
          subType: row.subType,
          productSubType: row.subType,
          company: matchedComp?._id || matchedComp?.id || null,
          companyName: row.company || null,
          productGroup: matchedGroup?._id || matchedGroup?.id || null,
          groupName: row.productType || null,
          tileSize: row.tileSize,
          size: row.tileSize,
          rangeOrSize: row.tileSize || row.range,
          range: row.range,
          rangeName: row.range,
          finish: row.finish,
          colourName: row.finish,
          finishColor: row.finish,
          fullDescription: row.productName,
          productImage: row.image || null,
          image: row.image || null,
          piecesPerBox: row.pcsPerBox,
          coverageAreaSqFt: row.coverageArea,
          sqftPerBox: row.coverageArea,
          weightKg: row.weight,
          weightPerBox: row.weight,
          purchaseRate: row.purchasePrice,
          costRate: row.purchasePrice,
          salePrice: row.salePrice,
          mrp: row.salePrice,
          gstPct: row.gstPercent,
          openingStock: row.openingStock,
          actualStock: row.openingStock,
          currentStock: row.openingStock,
          reorderAlertQty: row.alertStock,
          unit: 'PCS',
          status: 'Active',
          isActive: true
        };

        await createProduct(payload);
        successCount++;
      } catch (e) {
        console.error('Import row failed:', e);
        failedCount++;
      }
      setImportProgress({ current: i + 1, total: validRows.length });
    }

    setCommitResult({
      status: failedCount === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS',
      successCount,
      failedCount,
      totalProcessed: validRows.length
    });

    setPreviewRows([]);
    setSummary(null);
    setSelectedFile(null);
    setLoading(false);
    loadHistory();
  };

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', paddingBottom: '3rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Bulk Product Import (Excel / CSV)
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Import ceramic tiles, sanitaryware, and faucets in bulk from Excel spreadsheets with full preview & validation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleDownloadSampleExcel}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '9px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.825rem',
              borderColor: '#bbf7d0',
              backgroundColor: '#f0fdf4',
              color: '#166534'
            }}
          >
            <Download size={16} />
            <span>Download Sample Excel Template</span>
          </button>

          <Link
            to="/products"
            className="btn btn-secondary"
            style={{
              borderRadius: '9px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.825rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Products</span>
          </Link>
        </div>
      </div>

      {/* Upload File Card */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        border: '1px solid #e2e8f0',
        padding: '1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <UploadCloud size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              Select Product Catalog Excel File
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              Supports .xlsx, .xls, and .csv formats with automatic column mapping
            </p>
          </div>
        </div>

        <div style={{
          border: '2px dashed #93c5fd',
          borderRadius: '12px',
          padding: '2.5rem 1.5rem',
          textAlign: 'center',
          backgroundColor: '#f8fafc',
          marginBottom: '1.25rem'
        }}>
          <FileSpreadsheet size={44} style={{ color: '#2563eb', margin: '0 auto 0.75rem auto', display: 'block' }} />
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b', marginBottom: '0.35rem' }}>
            {selectedFile ? selectedFile.name : 'Upload Your Products Excel Sheet (.xlsx, .csv)'}
          </div>
          <p style={{ fontSize: '0.825rem', color: '#64748b', marginBottom: '1.25rem' }}>
            Drag and drop your file here, or click below to browse from your device.
          </p>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="excel-upload-input"
          />
          <label
            htmlFor="excel-upload-input"
            className="btn btn-primary"
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 700
            }}
          >
            <UploadCloud size={18} />
            <span>{selectedFile ? 'Choose Different File' : 'Browse Excel Files'}</span>
          </label>
        </div>
      </div>

      {/* Progress Indicator */}
      {loading && importProgress.total > 0 && (
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#1e3a8a', fontSize: '0.9rem' }}>
              Importing Products ({importProgress.current} / {importProgress.total})
            </span>
            <span style={{ fontWeight: 700, color: '#2563eb', fontSize: '0.9rem' }}>
              {Math.round((importProgress.current / importProgress.total) * 100)}%
            </span>
          </div>
          <div style={{ width: '100%', height: '10px', backgroundColor: '#dbeafe', borderRadius: '5px', overflow: 'hidden' }}>
            <div style={{
              width: `${(importProgress.current / importProgress.total) * 100}%`,
              height: '100%',
              backgroundColor: '#2563eb',
              transition: 'width 0.2s ease'
            }} />
          </div>
        </div>
      )}

      {/* Commit Result Banner */}
      {commitResult && (
        <div style={{
          backgroundColor: commitResult.failedCount === 0 ? '#f0fdf4' : '#fffbeb',
          border: commitResult.failedCount === 0 ? '1px solid #bbf7d0' : '1px solid #fef08a',
          borderRadius: '12px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <CheckCircle2 size={28} style={{ color: '#16a34a', flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#166534', margin: 0 }}>
              Bulk Import Completed!
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#15803d', margin: '0.2rem 0 0 0' }}>
              Successfully imported <strong>{commitResult.successCount}</strong> products into catalog.
              {commitResult.failedCount > 0 && ` (${commitResult.failedCount} failed rows).`}
            </p>
          </div>
        </div>
      )}

      {/* Preview Simulation Section */}
      {summary && previewRows.length > 0 && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '1.75rem',
          marginBottom: '1.75rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.25rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Spreadsheet Preview & Validation ({summary.totalRows} Rows)
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                File: {summary.fileName} | Review all rows before committing to database
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleConfirmImport}
              disabled={loading || summary.validRowsCount === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 1.5rem',
                borderRadius: '8px',
                fontWeight: 700
              }}
            >
              <Check size={18} />
              <span>Confirm & Import ({summary.validRowsCount} Valid Products)</span>
            </button>
          </div>

          {/* Row Metrics Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>Total Sheet Rows</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{summary.totalRows}</div>
            </div>
            <div style={{ backgroundColor: '#f0fdf4', padding: '1rem', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: 600 }}>Valid Products</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>{summary.validRowsCount}</div>
            </div>
            <div style={{ backgroundColor: summary.invalidRowsCount > 0 ? '#fef2f2' : '#f8fafc', padding: '1rem', borderRadius: '10px', border: summary.invalidRowsCount > 0 ? '1px solid #fecaca' : '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', color: summary.invalidRowsCount > 0 ? '#dc2626' : '#64748b', fontWeight: 600 }}>Invalid Rows</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: summary.invalidRowsCount > 0 ? '#dc2626' : '#64748b', marginTop: '0.2rem' }}>{summary.invalidRowsCount}</div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Image</th>
                  <th>Item Code</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Company / Brand</th>
                  <th>Size / Range</th>
                  <th>Sale Price (₹)</th>
                  <th>Opening Stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => (
                  <tr key={row.rowNumber} style={{ backgroundColor: !row.isValid ? '#fef2f2' : 'inherit' }}>
                    <td>{row.rowNumber}</td>
                    <td style={{ textAlign: 'center' }}>
                      {row.image ? (
                        <img
                          src={row.image}
                          alt={row.productName}
                          style={{ width: '34px', height: '34px', borderRadius: '6px', objectFit: 'cover', border: '1px solid #cbd5e1' }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.sku}</td>
                    <td style={{ fontWeight: 600 }}>{row.productName}</td>
                    <td><span className="badge badge-info">{row.category}</span></td>
                    <td>{row.company}</td>
                    <td style={{ fontSize: '0.825rem', color: '#475569' }}>{row.tileSize || row.range || '-'}</td>
                    <td style={{ fontWeight: 700, color: '#16a34a' }}>₹{row.salePrice}</td>
                    <td style={{ fontWeight: 600 }}>{row.openingStock} Boxes</td>
                    <td>
                      {row.isValid ? (
                        <span className="badge badge-success">Valid</span>
                      ) : (
                        <span className="badge badge-danger" title={row.errors.join(', ')}>Invalid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Batch Import History Table */}
      <div className="table-container">
        <div className="table-header-bar">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Import Batch History</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Batch Ref ID</th>
              <th>File Name</th>
              <th>Source</th>
              <th>Total Rows</th>
              <th>Success</th>
              <th>Failed</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>No previous import batches found.</td></tr>
            ) : (
              history.map(b => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 600 }}>{b._id}</td>
                  <td>{b.originalFileName}</td>
                  <td><span className="badge badge-info">{b.sourceType}</span></td>
                  <td>{b.totalRows}</td>
                  <td style={{ color: '#16a34a', fontWeight: 600 }}>{b.successCount}</td>
                  <td style={{ color: b.failedCount > 0 ? '#dc2626' : 'inherit' }}>{b.failedCount}</td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>
                    {b.fileUrl && (
                      <a href={b.fileUrl} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                        <ExternalLink size={12} /> Source File
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductImport;

