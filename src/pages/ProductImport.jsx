import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { previewImportFile, commitImportBatch, getImportBatches } from '../services/importService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { UploadCloud, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Download, ExternalLink, RefreshCw, ArrowLeft } from 'lucide-react';

export const ProductImport = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await getImportBatches();
      setHistory(res.data?.batches || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      alert('Please select an Excel (.xlsx, .xls, .csv) or PDF file to upload.');
      return;
    }
    setLoading(true);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await previewImportFile(formData);
      setPreviewData(res.data || res);
    } catch (err) {
      alert('Error generating file preview: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!previewData || !previewData.batchId) return;
    setLoading(true);
    try {
      const res = await commitImportBatch(previewData.batchId);
      setCommitResult(res.data || res);
      setPreviewData(null);
      setSelectedFile(null);
      loadHistory();
    } catch (err) {
      alert('Error committing import batch: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrorReport = () => {
    alert('Downloading annotated Excel error report...');
  };

  return (
    <div style={{ maxWidth: '1100px' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Bulk Product Import (Excel & PDF)</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            Cloudinary Cloud Stream & Zero-Write Preview Simulation Engine (Module 3)
          </p>
        </div>

        <Link
          to="/products"
          className="btn btn-secondary"
          style={{
            borderRadius: '9px',
            padding: '0.5rem 0.85rem',
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

      {/* Upload File Card */}
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <UploadCloud size={18} style={{ color: '#2563eb' }} />
          <span>Select Catalog or Price List Document</span>
        </h3>

        <form onSubmit={handlePreview}>
          <div style={{
            border: '2px dashed #cbd5e1',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center',
            backgroundColor: '#f8fafc',
            marginBottom: '1.25rem'
          }}>
            <FileSpreadsheet size={36} style={{ color: '#2563eb', marginBottom: '0.5rem' }} />
            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.25rem' }}>
              Upload Excel Sheet (.xlsx, .xls, .csv) or Digital PDF Price List
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
              Files are streamed securely to Cloudinary storage before zero-write preview simulation.
            </p>

            <input 
              type="file" 
              accept=".xlsx,.xls,.csv,.pdf" 
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-upload-input"
            />
            <label htmlFor="file-upload-input" className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              {selectedFile ? selectedFile.name : 'Browse Computer Files'}
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading || !selectedFile}>
              {loading ? 'Processing Cloud Stream & Preview...' : 'Generate Zero-Write Preview'}
            </button>
          </div>
        </form>
      </div>

      {/* Commit Result Alert */}
      {commitResult && (
        <div className="card" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <CheckCircle2 size={24} style={{ color: '#16a34a' }} />
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#166534' }}>Import Commit Completed!</h4>
              <p style={{ fontSize: '0.85rem', color: '#15803d' }}>
                Import Status: <strong>{commitResult.status || 'PARTIAL_SUCCESS'}</strong> | Success: {commitResult.successCount} | Failed: {commitResult.failedCount}.
                <br />
                <em>Repeat Import Rule Enforced: Existing product pricing updated; live <strong>currentStock</strong> strictly preserved.</em>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Simulation Section */}
      {previewData && (
        <div className="card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Zero-Write Simulation Preview</h3>
              <p style={{ fontSize: '0.825rem', color: '#64748b' }}>
                Batch ID: {previewData.importBatchId} | File URL: <a href={previewData.fileUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>View in Cloudinary <ExternalLink size={12} /></a>
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {previewData.invalidRowsCount > 0 && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDownloadErrorReport} style={{ borderColor: '#dc2626', color: '#dc2626' }}>
                  <Download size={14} /> Download Excel Error Report
                </button>
              )}
              <button type="button" className="btn btn-primary btn-sm" onClick={handleCommit} disabled={loading}>
                Confirm & Commit Valid Rows ({previewData.validRowsCount})
              </button>
            </div>
          </div>

          {/* Row Metrics */}
          <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="stat-card" style={{ background: '#f8fafc' }}>
              <div className="stat-label">Total Sheet Rows</div>
              <div className="stat-value">{previewData.totalRows}</div>
            </div>
            <div className="stat-card" style={{ background: '#f0fdf4' }}>
              <div className="stat-label">Valid Rows</div>
              <div className="stat-value" style={{ color: '#16a34a' }}>{previewData.validRowsCount}</div>
            </div>
            <div className="stat-card" style={{ background: '#fef2f2' }}>
              <div className="stat-label">Invalid Rows</div>
              <div className="stat-value" style={{ color: '#dc2626' }}>{previewData.invalidRowsCount}</div>
            </div>
          </div>

          {/* Preview Table */}
          <div className="table-container" style={{ border: 'none', boxShadow: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Row #</th>
                  <th>Product Name</th>
                  <th>Company SKU</th>
                  <th>Unit</th>
                  <th>Sale Price (₹)</th>
                  <th>Validation Status</th>
                  <th>Errors / Remarks</th>
                </tr>
              </thead>
              <tbody>
                {previewData.previewRows?.map((row) => (
                  <tr key={row.rowNumber} style={{ backgroundColor: !row.isValid ? '#fef2f2' : 'inherit' }}>
                    <td>{row.rowNumber}</td>
                    <td style={{ fontWeight: 600 }}>{row.mappedData?.productName || '-'}</td>
                    <td>{row.mappedData?.companySkuCode || '-'}</td>
                    <td>{row.mappedData?.unit || 'Sq.Ft'}</td>
                    <td>₹{row.mappedData?.salePrice || 0}</td>
                    <td>
                      {row.isValid ? (
                        <span className="badge badge-success">Valid {row.isExisting ? '(Update)' : '(New)'}</span>
                      ) : (
                        <span className="badge badge-danger">Invalid Row</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: !row.isValid ? '#dc2626' : '#64748b' }}>
                      {row.errors?.join(', ') || 'Ready for import'}
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
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Import Batch History</h3>
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
              <tr><td colSpan="8" style={{ textAlign: 'center', color: '#64748b' }}>No previous import batches.</td></tr>
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
