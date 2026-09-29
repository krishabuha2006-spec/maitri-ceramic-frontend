import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { previewImportFile, commitImportBatch, getImportBatches } from '../services/importService';
import { createProduct, getCompanies, getProductGroups } from '../services/productService';
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
    getCompanies().then(c => Array.isArray(c) && setCompaniesList(c)).catch(() => {});
    getProductGroups().then(g => Array.isArray(g) && setGroupsList(g)).catch(() => {});
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
        'Item Code': 'KAJ-STAT-60120',
        'Product Name': 'Kajaria Statuario White Glazed Vitrified Tile 600x1200mm',
        'Category': 'Tiles',
        'Product Type': 'Vitrified Tiles',
        'SubType': 'GVT / PGVT High Gloss',
        'Company / Brand': 'Kajaria',
        'Tile Size / Dimensions': '600x1200mm (2x4 Ft)',
        'Range / Collection': 'The Royal Marble Series',
        'Finish / Color': 'Statuario White Marble',
        'Pcs Per Box': 2,
        'Coverage Area (Sq.Ft)': 15.5,
        'Weight Per Box (kg)': 29.5,
        'Purchase Price (₹)': 620,
        'Sale Price (₹)': 980,
        'GST Rate (%)': 18,
        'Opening Stock (Boxes)': 120,
        'Min Alert Stock': 20
      },
      {
        'Item Code': 'ROCA-L90-BASIN',
        'Product Name': 'Roca L90 Single Lever Countertop Basin',
        'Category': 'Sanitaryware',
        'Product Type': 'Wash Basin',
        'SubType': 'Countertop Basin',
        'Company / Brand': 'Roca',
        'Tile Size / Dimensions': '-',
        'Range / Collection': 'L90 Premium Collection',
        'Finish / Color': 'Glossy White',
        'Pcs Per Box': 1,
        'Coverage Area (Sq.Ft)': 0,
        'Weight Per Box (kg)': 14.5,
        'Purchase Price (₹)': 4800,
        'Sale Price (₹)': 7200,
        'GST Rate (%)': 18,
        'Opening Stock (Boxes)': 25,
        'Min Alert Stock': 5
      },
      {
        'Item Code': 'ROCA-INSP-FAUCET',
        'Product Name': 'Roca Inspira High Basin Mixer Chrome',
        'Category': 'Faucets',
        'Product Type': 'Basin Mixers',
        'SubType': 'Tall Body Mixer',
        'Company / Brand': 'Roca',
        'Tile Size / Dimensions': '-',
        'Range / Collection': 'Inspira Round',
        'Finish / Color': 'Evershine Chrome',
        'Pcs Per Box': 1,
        'Coverage Area (Sq.Ft)': 0,
        'Weight Per Box (kg)': 2.8,
        'Purchase Price (₹)': 3200,
        'Sale Price (₹)': 5100,
        'GST Rate (%)': 18,
        'Opening Stock (Boxes)': 40,
        'Min Alert Stock': 8
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');
    XLSX.writeFile(wb, 'Maitri_Ceramic_Product_Import_Template.xlsx');
  };

  // Parse Excel File on Selection
  const processExcelFile = (file) => {
    setSelectedFile(file);
    setCommitResult(null);
    setLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          alert('Uploaded Excel file has no data rows.');
          setLoading(false);
          return;
        }

        const parsed = rawJson.map((row, idx) => {
          const sku = String(row['Item Code'] || row['Item Code (SKU)'] || row['SKU'] || row['Code'] || `SKU-${idx + 1}`).trim();
          const productName = String(row['Product Name'] || row['Item Name'] || row['Description'] || '').trim();
          const category = String(row['Category'] || 'Tiles').trim();
          const productType = String(row['Product Type'] || row['Group'] || 'Vitrified Tiles').trim();
          const subType = String(row['SubType'] || row['Sub Type'] || '').trim();
          const company = String(row['Company / Brand'] || row['Company'] || row['Brand'] || 'General').trim();
          const tileSize = String(row['Tile Size / Dimensions'] || row['Size'] || row['Dimensions'] || '').trim();
          const range = String(row['Range / Collection'] || row['Range'] || row['Collection'] || '').trim();
          const finish = String(row['Finish / Color'] || row['Finish'] || row['Color'] || '').trim();
          const pcsPerBox = Number(row['Pcs Per Box'] || row['Pieces'] || 1);
          const coverageArea = Number(row['Coverage Area (Sq.Ft)'] || row['SqFt'] || row['Area'] || 0);
          const weight = Number(row['Weight Per Box (kg)'] || row['Weight'] || 0);
          const purchasePrice = Number(row['Purchase Price (₹)'] || row['Purchase Rate'] || row['Cost'] || 0);
          const salePrice = Number(row['Sale Price (₹)'] || row['MRP'] || row['Rate'] || 0);
          const gstPercent = Number(row['GST Rate (%)'] || row['GST'] || 18);
          const openingStock = Number(row['Opening Stock (Boxes)'] || row['Stock'] || row['Quantity'] || 0);
          const alertStock = Number(row['Min Alert Stock'] || row['Alert Qty'] || 10);

          const errors = [];
          if (!productName) errors.push('Product Name is required');
          if (!sku) errors.push('Item Code / SKU is required');
          if (isNaN(salePrice) || salePrice < 0) errors.push('Invalid Sale Price');

          return {
            rowNumber: idx + 1,
            sku,
            productName,
            category,
            productType,
            subType,
            company,
            tileSize,
            range,
            finish,
            pcsPerBox,
            coverageArea,
            weight,
            purchasePrice,
            salePrice,
            gstPercent,
            openingStock,
            alertStock,
            isValid: errors.length === 0,
            errors
          };
        });

        const validCount = parsed.filter(p => p.isValid).length;
        const invalidCount = parsed.length - validCount;

        setPreviewRows(parsed);
        setSummary({
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
        const payload = {
          productName: row.productName,
          companySkuCode: row.sku,
          sku: row.sku,
          category: row.category,
          productType: row.productType,
          subType: row.subType,
          companyName: row.company,
          tileSize: row.tileSize,
          rangeName: row.range,
          finishColor: row.finish,
          piecesPerBox: row.pcsPerBox,
          coverageAreaSqFt: row.coverageArea,
          weightKg: row.weight,
          purchaseRate: row.purchasePrice,
          salePrice: row.salePrice,
          mrp: row.salePrice,
          gstPct: row.gstPercent,
          openingStock: row.openingStock,
          actualStock: row.openingStock,
          currentStock: row.openingStock,
          reorderAlertQty: row.alertStock,
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

