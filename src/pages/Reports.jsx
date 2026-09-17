import React, { useState, useEffect, useMemo } from 'react';
import { REPORT_CATEGORIES, REPORT_TYPES, getReportData } from '../services/reportService';
import { getCustomers } from '../services/customerService';
import * as XLSX from 'xlsx';
import { 
  BarChart3, 
  FileSpreadsheet, 
  Printer, 
  Download, 
  Search, 
  CheckCircle2, 
  RefreshCw,
  FileText,
  User
} from 'lucide-react';

export const Reports = () => {
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES.CUSTOMER);
  const [selectedReport, setSelectedReport] = useState(REPORT_TYPES[0]);
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    getCustomers().then(res => {
      setCustomers(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
    });
  }, []);

  useEffect(() => {
    const firstInCat = REPORT_TYPES.find(r => r.category === selectedCategory);
    if (firstInCat) {
      setSelectedReport(firstInCat);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedReport) {
      loadReportData(selectedReport.id, selectedCustomerId);
    }
  }, [selectedReport, selectedCustomerId]);

  const loadReportData = async (reportId, customerId = '') => {
    setLoading(true);
    try {
      const params = {};
      if (customerId) {
        params.id = customerId;
        params.customerId = customerId;
      }
      const data = await getReportData(reportId, params);
      setReportResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!reportResult?.rows) return [];
    if (!searchFilter.trim()) return reportResult.rows;
    const q = searchFilter.toLowerCase();
    return reportResult.rows.filter(r => 
      String(r.c1 || '').toLowerCase().includes(q) ||
      String(r.c2 || '').toLowerCase().includes(q) ||
      String(r.c3 || '').toLowerCase().includes(q) ||
      String(r.c4 || '').toLowerCase().includes(q) ||
      String(r.c5 || '').toLowerCase().includes(q) ||
      String(r.c6 || '').toLowerCase().includes(q)
    );
  }, [reportResult, searchFilter]);

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportExcel = () => {
    if (!reportResult || !reportResult.rows || reportResult.rows.length === 0) {
      showToast('No report data available to export.');
      return;
    }

    const cols = reportResult.columns || ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'];
    const exportData = filteredRows.map(r => {
      const obj = {};
      obj[cols[0] || 'Column 1'] = r.c1;
      obj[cols[1] || 'Column 2'] = r.c2;
      obj[cols[2] || 'Column 3'] = r.c3;
      obj[cols[3] || 'Column 4'] = r.c4;
      obj[cols[4] || 'Column 5'] = r.c5;
      obj[cols[5] || 'Column 6'] = r.c6;
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const cleanTitle = (selectedReport?.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, cleanTitle);
    const filename = `${cleanTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);

    showToast(`Exported ${filename} successfully!`);
  };

  const handleExportCSV = () => {
    if (!reportResult || !reportResult.rows || reportResult.rows.length === 0) {
      showToast('No report data available to export.');
      return;
    }

    const headers = reportResult.columns ? reportResult.columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') : '';
    const rowStrings = filteredRows.map(r => {
      const vals = [r.c1, r.c2, r.c3, r.c4, r.c5, r.c6];
      return vals
        .map(val => `"${String(val ?? '').replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = [headers, ...rowStrings].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanTitle = (selectedReport?.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${cleanTitle}_${new Date().toISOString().split('T')[0]}.csv`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${filename} successfully!`);
  };

  const currentCategoryReports = REPORT_TYPES.filter(r => r.category === selectedCategory);

  return (
    <div>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="no-print" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: '#16a34a',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
          fontWeight: 600
        }}>
          <CheckCircle2 size={22} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Business Reports & Analytics</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Comprehensive reporting with Excel, CSV export, and print capabilities</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{
              height: '38px',
              padding: '0 0.85rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: '#cbd5e1'
            }}
          >
            <Download size={14} />
            <span>CSV</span>
          </button>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: '#cbd5e1'
            }}
          >
            <FileSpreadsheet size={15} />
            <span>Excel (.xlsx)</span>
          </button>
          <button 
            type="button"
            className="btn btn-primary"
            onClick={handlePrintReport}
            style={{
              height: '38px',
              padding: '0 1.1rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)'
            }}
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="tabs-header no-print" style={{ marginBottom: '1rem' }}>
        {Object.values(REPORT_CATEGORIES).map(cat => (
          <button 
            key={cat}
            className={`tab-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.25rem' }}>
        
        {/* Report Selection Sidebar */}
        <div className="card no-print" style={{ padding: '0.75rem', alignSelf: 'start' }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', padding: '0.4rem 0.6rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Available Reports
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.25rem' }}>
            {currentCategoryReports.map(rpt => (
              <button
                key={rpt.id}
                onClick={() => {
                  setSelectedReport(rpt);
                  setSearchFilter('');
                }}
                style={{
                  textAlign: 'left',
                  padding: '0.6rem 0.75rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedReport?.id === rpt.id ? '#eff6ff' : 'transparent',
                  color: selectedReport?.id === rpt.id ? '#2563eb' : '#334155',
                  fontWeight: selectedReport?.id === rpt.id ? 700 : 500,
                  cursor: 'pointer',
                  fontSize: '0.825rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {rpt.title}
              </button>
            ))}
          </div>
        </div>

        {/* Report Output Container */}
        <div className="table-container printable-document" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{selectedReport?.title}</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>{selectedReport?.description}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              {selectedReport?.requiresCustomer && (
                <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={14} style={{ color: '#64748b' }} />
                  <select
                    className="form-control"
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    style={{ height: '34px', fontSize: '0.8rem', borderRadius: '6px', paddingRight: '1.5rem' }}
                  >
                    <option value="">All Customers</option>
                    {customers.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.customerName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="no-print" style={{ position: 'relative', width: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Filter rows..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    height: '34px',
                    paddingLeft: '2rem',
                    paddingRight: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
              </div>

              {reportResult?.summary?.grandTotal !== undefined && (
                <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #dbeafe', whiteSpace: 'nowrap' }}>
                  Total: ₹{Number(reportResult.summary.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {reportResult?.columns?.map((col, i) => (
                    <th key={i} style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={reportResult?.columns?.length || 6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Generating live report data...</td></tr>
                ) : filteredRows.length === 0 ? (
                  <tr><td colSpan={reportResult?.columns?.length || 6} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No records found for this report filter.</td></tr>
                ) : (
                  filteredRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{row.c1}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap' }}>{row.c2}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.c3}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>{row.c4}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>{row.c5}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{row.c6}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Reports;
