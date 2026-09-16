import React, { useState, useEffect } from 'react';
import { REPORT_CATEGORIES, REPORT_TYPES, getReportData } from '../services/reportService';
import { BarChart3, FileSpreadsheet, Printer, Download, Search, CheckCircle2 } from 'lucide-react';

export const Reports = () => {
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES.CUSTOMER);
  const [selectedReport, setSelectedReport] = useState(REPORT_TYPES[0]);
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exportToast, setExportToast] = useState('');

  useEffect(() => {
    // Select first report in current category
    const firstInCat = REPORT_TYPES.find(r => r.category === selectedCategory);
    if (firstInCat) {
      setSelectedReport(firstInCat);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedReport) {
      loadReportData(selectedReport.id);
    }
  }, [selectedReport]);

  const loadReportData = async (reportId) => {
    setLoading(true);
    try {
      const data = await getReportData(reportId);
      setReportResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportResult || !reportResult.rows || reportResult.rows.length === 0) {
      alert('No report data available to export.');
      return;
    }

    const headers = reportResult.columns ? reportResult.columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',') : '';
    const rowStrings = reportResult.rows.map(r => {
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

    setExportToast(`Exported ${filename} successfully!`);
    setTimeout(() => setExportToast(''), 3000);
  };

  const currentCategoryReports = REPORT_TYPES.filter(r => r.category === selectedCategory);

  return (
    <div>
      {/* Toast Notification */}
      {exportToast && (
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
          <span>{exportToast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Business Reports & Analytics Hub</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Clean tabular reports with instant CSV export and print capabilities</p>
        </div>
        <div className="no-print" style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{
              height: '38px',
              padding: '0 1rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: '#cbd5e1'
            }}
          >
            <Download size={15} />
            <span>Export CSV</span>
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

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
        
        {/* Report Selection List */}
        <div className="card no-print" style={{ padding: '0.75rem' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', padding: '0.5rem 0.75rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
            Select Report
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {currentCategoryReports.map(rpt => (
              <button
                key={rpt.id}
                onClick={() => setSelectedReport(rpt)}
                style={{
                  textAlign: 'left',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '6px',
                  border: 'none',
                  background: selectedReport?.id === rpt.id ? '#eff6ff' : 'transparent',
                  color: selectedReport?.id === rpt.id ? '#2563eb' : '#334155',
                  fontWeight: selectedReport?.id === rpt.id ? 600 : 400,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {rpt.title}
              </button>
            ))}
          </div>
        </div>

        {/* Report Output Container */}
        <div className="table-container printable-document" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>{selectedReport?.title}</h3>
              <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>{selectedReport?.description}</p>
            </div>
            {reportResult?.summary && (
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid #dbeafe' }}>
                Grand Total: ₹{reportResult.summary.grandTotal?.toLocaleString('en-IN')}
              </div>
            )}
          </div>

          <div style={{ overflowX: 'hidden' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {reportResult?.columns?.map((col, i) => (
                    <th key={i} style={{ padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Generating report data...</td></tr>
                ) : !reportResult?.rows || reportResult.rows.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No data records for this report.</td></tr>
                ) : (
                  reportResult.rows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{row.c1}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: '#1e293b' }}>{row.c2}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>{row.c3}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>{row.c4}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#2563eb' }}>{row.c5}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>{row.c6}</td>
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
