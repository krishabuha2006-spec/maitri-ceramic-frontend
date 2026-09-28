import React, { useState, useEffect, useMemo } from 'react';
import { 
  REPORT_CATEGORIES, 
  REPORT_TYPES, 
  getReportData, 
  exportBackendExcel 
} from '../services/reportService';
import { getCustomers } from '../services/customerService';
import { printReportPdf } from '../utils/reportPdfGenerator';
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
  User, 
  Calendar, 
  CreditCard, 
  Layers, 
  Package, 
  Users, 
  AlertTriangle,
  FileCheck,
  RotateCcw,
  Truck,
  ArrowRight,
  TrendingUp,
  Receipt
} from 'lucide-react';

const CATEGORY_ICONS = {
  [REPORT_CATEGORIES.CUSTOMER]: Users,
  [REPORT_CATEGORIES.QUOTATION]: FileText,
  [REPORT_CATEGORIES.PRODUCT]: Package,
  [REPORT_CATEGORIES.STOCK]: Layers,
  [REPORT_CATEGORIES.FINANCIAL]: CreditCard
};

export const Reports = () => {
  const [selectedCategory, setSelectedCategory] = useState(REPORT_CATEGORIES.CUSTOMER);
  const [selectedReport, setSelectedReport] = useState(REPORT_TYPES[0]);
  const [reportResult, setReportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  
  // Filter States
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activeDatePreset, setActiveDatePreset] = useState('ALL');

  // Customer 360 sub-tab
  const [customer360Tab, setCustomer360Tab] = useState('timeline'); // 'timeline' | 'quotations' | 'invoices' | 'payments'

  // Pagination state for UI view
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Load customer master
  useEffect(() => {
    getCustomers().then(res => {
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setCustomers(list);
      // If customer-specific report and no customer selected, default to first customer
      if (list.length > 0 && !selectedCustomerId) {
        setSelectedCustomerId(list[0]._id || list[0].id || '');
      }
    }).catch(() => {});
  }, []);

  // When category changes, switch to first report in category
  useEffect(() => {
    const firstInCat = REPORT_TYPES.find(r => r.category === selectedCategory);
    if (firstInCat) {
      setSelectedReport(firstInCat);
      setSearchFilter('');
      setCurrentPage(1);
    }
  }, [selectedCategory]);

  // Load report data
  useEffect(() => {
    if (selectedReport) {
      loadReportData();
    }
  }, [selectedReport, selectedCustomerId, fromDate, toDate]);

  const loadReportData = async () => {
    if (!selectedReport) return;
    setLoading(true);
    try {
      const params = {};
      if (selectedCustomerId) {
        params.id = selectedCustomerId;
        params.customerId = selectedCustomerId;
      }
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const data = await getReportData(selectedReport.id, params);
      setReportResult(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Error loading report:', err);
      showToast('Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Date Presets Handler
  const handleDatePreset = (preset) => {
    setActiveDatePreset(preset);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (preset === 'TODAY') {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'THIS_MONTH') {
      setFromDate(`${yyyy}-${mm}-01`);
      setToDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
      const prevYear = today.getMonth() === 0 ? yyyy - 1 : yyyy;
      const prevMmStr = String(prevMonth).padStart(2, '0');
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      setFromDate(`${prevYear}-${prevMmStr}-01`);
      setToDate(`${prevYear}-${prevMmStr}-${lastDay}`);
    } else if (preset === 'THIS_FY') {
      const startYear = today.getMonth() >= 3 ? yyyy : yyyy - 1;
      setFromDate(`${startYear}-04-01`);
      setToDate(todayStr);
    } else {
      // ALL TIME
      setFromDate('');
      setToDate('');
    }
  };

  // Filtered Rows based on Search
  const filteredRows = useMemo(() => {
    if (!reportResult?.rows) return [];
    if (!searchFilter.trim()) return reportResult.rows;
    const q = searchFilter.toLowerCase();
    return reportResult.rows.filter(r => 
      Object.values(r).some(val => String(val ?? '').toLowerCase().includes(q))
    );
  }, [reportResult, searchFilter]);

  // Paginated Rows for UI display
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;

  // Selected Customer name resolver
  const activeCustomerName = useMemo(() => {
    if (!selectedCustomerId) return '';
    const found = customers.find(c => (c._id || c.id) === selectedCustomerId);
    return found ? found.customerName : '';
  }, [customers, selectedCustomerId]);

  // Professional PDF Download & Print Engine (Contains 100% of data - ZERO cutoffs)
  const handleDownloadPdfOrPrint = () => {
    if (!reportResult) {
      showToast('No report data available to generate PDF.');
      return;
    }

    const dateRangeStr = fromDate ? `${fromDate} to ${toDate || 'Present'}` : 'All Time';

    printReportPdf({
      reportTitle: selectedReport.title,
      reportDescription: selectedReport.description,
      category: selectedCategory,
      dateRange: dateRangeStr,
      customerName: activeCustomerName,
      summary: reportResult.summary,
      columns: reportResult.columns || [],
      rows: filteredRows, // Full filtered rows without pagination cutoffs
      customer360Data: reportResult.customer360Data
    });

    showToast(`Generating high-definition PDF for ${selectedReport.title}...`);
  };

  // Server Excel Export Handler
  const handleExportBackendExcel = async () => {
    if (!selectedReport) return;
    setExporting(true);
    try {
      const params = {};
      if (selectedCustomerId) {
        params.id = selectedCustomerId;
        params.customerId = selectedCustomerId;
      }
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const blob = await exportBackendExcel(selectedReport.endpoint, params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      const cleanTitle = (selectedReport.title || 'Report').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${cleanTitle}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast(`Server Excel export downloaded: ${filename}`);
    } catch (err) {
      console.warn('Backend excel export fallback to client-side:', err);
      handleExportClientExcel();
    } finally {
      setExporting(false);
    }
  };

  // Client-side Excel Export Fallback
  const handleExportClientExcel = () => {
    if (!reportResult || !reportResult.rows || reportResult.rows.length === 0) {
      showToast('No report records available to export.');
      return;
    }

    const cols = reportResult.columns || ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'];
    const exportData = filteredRows.map(r => {
      const obj = {};
      cols.forEach((colName, idx) => {
        obj[colName] = r[`c${idx + 1}`] ?? '-';
      });
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

  // Client-side CSV Export
  const handleExportCSV = () => {
    if (!reportResult || !reportResult.rows || reportResult.rows.length === 0) {
      showToast('No report records available to export.');
      return;
    }

    const cols = reportResult.columns || ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Col 5', 'Col 6'];
    const headers = cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
    const rowStrings = filteredRows.map(r => {
      return cols.map((_, idx) => `"${String(r[`c${idx + 1}`] ?? '').replace(/"/g, '""')}"`).join(',');
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
  const CategoryIcon = CATEGORY_ICONS[selectedCategory] || FileText;

  // Helper to render badges and formatted values
  const renderCellContent = (val, colName) => {
    if (!val || val === '-') return <span style={{ color: '#94a3b8' }}>-</span>;
    const s = String(val).trim();
    const upper = s.toUpperCase();

    // Badges for Status
    if (['CONFIRMED', 'PAID', 'ADEQUATE', 'ACTIVE', 'COMPLETED', 'DELIVERED', 'RECEIVED', 'PURCHASED'].includes(upper)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
          {s}
        </span>
      );
    }
    if (['PENDING', 'DRAFT', 'SENT', 'FOLLOW_UP_PENDING', 'NEGOTIATION', 'PARTIAL'].includes(upper)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
          {s}
        </span>
      );
    }
    if (['REJECTED', 'EXPIRED', 'LOW_STOCK', 'OVERDUE', 'CANCELLED', 'INACTIVE'].includes(upper)) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          {s}
        </span>
      );
    }

    // Currency values
    if (s.startsWith('₹') || (typeof val === 'number' && colName?.toLowerCase().includes('amount'))) {
      return <span style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{s}</span>;
    }

    // SKU / Doc Codes
    if (colName?.toLowerCase().includes('sku') || colName?.toLowerCase().includes('no') || colName?.toLowerCase().includes('ref') || colName?.toLowerCase().includes('voucher')) {
      return <span style={{ fontWeight: 600, color: '#1e293b', fontFamily: 'monospace' }}>{s}</span>;
    }

    return <span>{s}</span>;
  };

  return (
    <div style={{ paddingBottom: '2rem' }}>
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
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '0.85rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          fontWeight: 600,
          border: '1px solid #334155'
        }}>
          <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
          <span style={{ fontSize: '0.875rem' }}>{toastMessage}</span>
        </div>
      )}

      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={22} style={{ color: '#2563eb' }} />
            Business Reports & Analytics
          </h2>
          <p style={{ fontSize: '0.835rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Full suite of 34 real-time business reports with live backend filters, full-data PDF download, and Excel exports
          </p>
        </div>

        {/* Action Controls */}
        <div className="no-print" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={loadReportData}
            title="Refresh Data"
            style={{ height: '38px', padding: '0 0.85rem', fontSize: '0.825rem', fontWeight: 600, borderRadius: '8px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCSV}
            style={{ height: '38px', padding: '0 0.85rem', fontSize: '0.825rem', fontWeight: 600, borderRadius: '8px' }}
          >
            <Download size={14} />
            <span>CSV</span>
          </button>

          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleExportBackendExcel}
            disabled={exporting}
            style={{ height: '38px', padding: '0 0.95rem', fontSize: '0.825rem', fontWeight: 600, borderRadius: '8px', borderColor: '#22c55e', color: '#166534', backgroundColor: '#f0fdf4' }}
          >
            <FileSpreadsheet size={15} />
            <span>{exporting ? 'Exporting...' : 'Excel (.xlsx)'}</span>
          </button>

          <button 
            type="button"
            className="btn btn-primary"
            onClick={handleDownloadPdfOrPrint}
            style={{ 
              height: '38px', 
              padding: '0 1.15rem', 
              fontSize: '0.825rem', 
              fontWeight: 700, 
              borderRadius: '8px', 
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem'
            }}
          >
            <Printer size={15} />
            <span>Download PDF / Print</span>
          </button>
        </div>
      </div>

      {/* Category Navigation Bar */}
      <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem', paddingBottom: '0.25rem', borderBottom: '1px solid #e2e8f0' }}>
        {Object.values(REPORT_CATEGORIES).map(cat => {
          const Icon = CATEGORY_ICONS[cat] || FileText;
          const isActive = selectedCategory === cat;
          return (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.65rem 1.1rem',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 600,
                color: isActive ? '#2563eb' : '#64748b',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '3px solid #2563eb' : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      {/* Main Grid: Left Sidebar & Right Report View */}
      <div className="reports-layout-grid">
        
        {/* Left Sidebar: Report Navigator */}
        <div className="card no-print" style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569', padding: '0.4rem 0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #f1f5f9', marginBottom: '0.5rem' }}>
            <CategoryIcon size={14} style={{ color: '#2563eb' }} />
            <span>{selectedCategory} ({currentCategoryReports.length})</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {currentCategoryReports.map(rpt => {
              const isSelected = selectedReport?.id === rpt.id;
              return (
                <button
                  key={rpt.id}
                  onClick={() => {
                    setSelectedReport(rpt);
                    setSearchFilter('');
                    setCurrentPage(1);
                  }}
                  style={{
                    textAlign: 'left',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#1d4ed8' : '#334155',
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    fontSize: '0.825rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{rpt.title}</span>
                  {isSelected && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#2563eb' }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Section: Filters, Customer 360, KPI Summary, & Report Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0, overflow: 'hidden' }}>
          
          {/* Universal Interactive Filter Header */}
          <div className="card no-print" style={{ padding: '0.9rem 1.1rem', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              
              {/* Date Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginRight: '0.25rem' }}>Period:</span>
                {[
                  { key: 'ALL', label: 'All Time' },
                  { key: 'TODAY', label: 'Today' },
                  { key: 'THIS_MONTH', label: 'This Month' },
                  { key: 'LAST_MONTH', label: 'Last Month' },
                  { key: 'THIS_FY', label: 'This FY' }
                ].map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handleDatePreset(p.key)}
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: activeDatePreset === p.key ? 700 : 500,
                      backgroundColor: activeDatePreset === p.key ? '#2563eb' : '#f1f5f9',
                      color: activeDatePreset === p.key ? '#ffffff' : '#475569',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Date Range Inputs & Customer Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Calendar size={13} style={{ color: '#94a3b8' }} />
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => {
                      setFromDate(e.target.value);
                      setActiveDatePreset('CUSTOM');
                    }}
                    style={{ height: '32px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 0.45rem' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>to</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => {
                      setToDate(e.target.value);
                      setActiveDatePreset('CUSTOM');
                    }}
                    style={{ height: '32px', fontSize: '0.78rem', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '0 0.45rem' }}
                  />
                </div>

                {/* Customer Filter Dropdown */}
                {selectedReport?.requiresCustomer && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <User size={13} style={{ color: '#2563eb' }} />
                    <select
                      className="form-control"
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      style={{ height: '32px', fontSize: '0.78rem', fontWeight: 600, borderRadius: '6px', borderColor: '#2563eb', maxWidth: '200px', backgroundColor: '#eff6ff' }}
                    >
                      <option value="">-- Select Customer --</option>
                      {customers.map(c => (
                        <option key={c._id || c.id} value={c._id || c.id}>
                          {c.customerName} {c.mobile ? `(${c.mobile})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Customer 360 Specific Profile Card */}
          {selectedReport?.id === 'CUSTOMER_HISTORY' && reportResult?.customer360Data?.profile && (
            <div className="card no-print" style={{ padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Customer 360 Profile</span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0.1rem 0 0 0' }}>
                    {reportResult.customer360Data.profile.customerName}
                  </h3>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <strong>GSTIN:</strong> {reportResult.customer360Data.profile.gstNumber || 'Unregistered'} | <strong>Type:</strong> {reportResult.customer360Data.profile.customerType || 'Retail'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.65rem' }}>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <span style={{ color: '#94a3b8' }}>Mobile:</span> <strong>{reportResult.customer360Data.profile.mobile || '-'}</strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <span style={{ color: '#94a3b8' }}>City:</span> <strong>{reportResult.customer360Data.profile.city || '-'}</strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <span style={{ color: '#94a3b8' }}>State:</span> <strong>{reportResult.customer360Data.profile.state || 'Gujarat'}</strong>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <span style={{ color: '#94a3b8' }}>Email:</span> <strong>{reportResult.customer360Data.profile.email || '-'}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Top KPI Metric Cards from Summary (financial / actionable stats only) */}
          {reportResult?.summary && (
            reportResult.summary.totalInvoiceValue !== undefined ||
            reportResult.summary.pageTotalValue !== undefined ||
            reportResult.summary.totalQuotedValue !== undefined ||
            reportResult.summary.grandTotal !== undefined ||
            reportResult.summary.totalPaidAmount !== undefined ||
            reportResult.summary.totalCollectedAmount !== undefined ||
            reportResult.summary.totalCredit !== undefined ||
            reportResult.summary.totalOutstanding !== undefined ||
            reportResult.summary.totalOutstandingAmount !== undefined ||
            reportResult.summary.netDifference !== undefined ||
            reportResult.summary.totalDebit !== undefined ||
            reportResult.summary.conversionRateValuePct !== undefined ||
            reportResult.summary.totalCustomersWithOutstanding !== undefined
          ) && (
            <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {reportResult.summary.totalCustomersWithOutstanding !== undefined && (
                <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
                    Customers with Due
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '0.15rem' }}>
                    {reportResult.summary.totalCustomersWithOutstanding}
                  </div>
                </div>
              )}

              {(reportResult.summary.totalInvoiceValue !== undefined || reportResult.summary.pageTotalValue !== undefined || reportResult.summary.totalQuotedValue !== undefined || reportResult.summary.grandTotal !== undefined) && (
                <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #dbeafe', backgroundColor: '#eff6ff' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#1e40af' }}>Total Amount / Value</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.15rem' }}>
                    ₹{Number(reportResult.summary.totalInvoiceValue ?? reportResult.summary.pageTotalValue ?? reportResult.summary.totalQuotedValue ?? reportResult.summary.grandTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {(reportResult.summary.totalPaidAmount !== undefined || reportResult.summary.totalCollectedAmount !== undefined || reportResult.summary.totalCredit !== undefined) && (
                <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #dcfce7', backgroundColor: '#f0fdf4' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534' }}>Total Paid / Received</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '0.15rem' }}>
                    ₹{Number(reportResult.summary.totalPaidAmount ?? reportResult.summary.totalCollectedAmount ?? reportResult.summary.totalCredit ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {(reportResult.summary.totalOutstanding !== undefined || reportResult.summary.totalOutstandingAmount !== undefined || reportResult.summary.netDifference !== undefined || reportResult.summary.totalDebit !== undefined) && (
                <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>Outstanding / Balance</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b91c1c', marginTop: '0.15rem' }}>
                    ₹{Number(reportResult.summary.totalOutstanding ?? reportResult.summary.totalOutstandingAmount ?? reportResult.summary.netDifference ?? reportResult.summary.totalDebit ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {reportResult.summary.conversionRateValuePct !== undefined && (
                <div className="card" style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid #fef3c7', backgroundColor: '#fffbeb' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>Conversion Rate</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309', marginTop: '0.15rem' }}>
                    {reportResult.summary.conversionRateValuePct}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main Table Document Container */}
          <div className="table-container printable-document" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'visible', backgroundColor: '#ffffff' }}>
            
            {/* Report Header Bar */}
            <div style={{ padding: '1.1rem 1.35rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {selectedReport?.title}
                  {filteredRows.length > 0 && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      {filteredRows.length} {filteredRows.length === 1 ? 'record' : 'records'}
                    </span>
                  )}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                  {selectedReport?.description}
                </p>
              </div>

              {/* Instant Search Filter */}
              <div className="no-print" style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Instant filter rows..."
                  value={searchFilter}
                  onChange={(e) => {
                    setSearchFilter(e.target.value);
                    setCurrentPage(1);
                  }}
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
            </div>

            {/* Isolated Scrolling Data Table */}
            <div className="report-table-scroll">
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    {reportResult?.columns?.map((col, i) => (
                      <th 
                        key={i} 
                        style={{ 
                          position: 'sticky',
                          top: 0,
                          zIndex: 10,
                          backgroundColor: '#f8fafc',
                          padding: '0.6rem 0.75rem', 
                          fontWeight: 700, 
                          color: '#475569', 
                          textTransform: 'uppercase', 
                          letterSpacing: '0.02em', 
                          whiteSpace: 'nowrap',
                          borderBottom: '2px solid #e2e8f0'
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={reportResult?.columns?.length || 6} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                        <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem auto', color: '#2563eb' }} />
                        <div>Generating live report data from database...</div>
                      </td>
                    </tr>
                  ) : paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={reportResult?.columns?.length || 6} style={{ textAlign: 'center', padding: '3.5rem 1rem', color: '#64748b' }}>
                        <AlertTriangle size={24} style={{ margin: '0 auto 0.5rem auto', color: '#94a3b8' }} />
                        <div style={{ fontWeight: 600 }}>No records found for the selected criteria.</div>
                        <div style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                          {selectedReport?.requiresCustomer && !selectedCustomerId 
                            ? 'Please select a Customer from the dropdown above.' 
                            : 'Try adjusting your date range or search filter.'}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        {reportResult?.columns?.map((col, colIdx) => (
                          <td key={colIdx} style={{ padding: '0.55rem 0.75rem' }}>
                            {renderCellContent(row[`c${colIdx + 1}`], col)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredRows.length > pageSize && (
              <div className="no-print" style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', backgroundColor: '#ffffff' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} records
                </span>

                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: '1px solid #cbd5e1',
                      background: currentPage === 1 ? '#f8fafc' : '#ffffff',
                      color: currentPage === 1 ? '#94a3b8' : '#334155',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Previous
                  </button>

                  <span style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                    Page {currentPage} of {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      border: '1px solid #cbd5e1',
                      background: currentPage === totalPages ? '#f8fafc' : '#ffffff',
                      color: currentPage === totalPages ? '#94a3b8' : '#334155',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
};

export default Reports;
