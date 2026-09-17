import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getQuotations, getPendingQuotations, sendQuotation, confirmQuotation, exportQuotationDocument } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { Plus, Search, Eye, Edit, PhoneCall, Printer, Download, CheckCircle2, FileText, RefreshCw, Send, Clock } from 'lucide-react';

export const Quotations = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab State: 'all' | 'pending'
  const [activeTab, setActiveTab] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadQuotations = async () => {
    setLoading(true);
    try {
      if (activeTab === 'pending') {
        const pList = await getPendingQuotations();
        setQuotations(Array.isArray(pList) ? pList : []);
      } else {
        const res = await getQuotations({ search, status: statusFilter });
        setQuotations(Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSend = async (id, quotationNumber) => {
    if (!window.confirm(`Mark quotation #${quotationNumber} as SENT to customer?`)) return;
    try {
      await sendQuotation(id);
      setToastMessage(`Quotation #${quotationNumber} marked as Sent.`);
      setTimeout(() => setToastMessage(''), 3000);
      loadQuotations();
    } catch (err) {
      alert('Failed to send quotation: ' + err.message);
    }
  };

  const handleQuickConfirm = async (id, quotationNumber) => {
    if (!window.confirm(`Confirm quotation #${quotationNumber}?`)) return;
    try {
      await confirmQuotation(id, {
        remarks: 'Confirmed by customer'
      });
      setToastMessage(`Quotation #${quotationNumber} marked as CONFIRMED!`);
      setTimeout(() => setToastMessage(''), 3000);
      loadQuotations();
    } catch (err) {
      alert('Failed to confirm quotation: ' + err.message);
    }
  };

  const handleQuickExport = async (id, quotationNumber) => {
    try {
      await exportQuotationDocument(id, 'pdf', quotationNumber);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  };

  useEffect(() => {
    loadQuotations();
  }, [search, statusFilter, activeTab]);

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Quotation Directory</h2>
          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Create and manage customer sales quotations</p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <Link 
            to="/quotation-formats" 
            className="btn btn-secondary" 
            style={{ 
              height: '36px', 
              padding: '0 0.95rem', 
              fontSize: '0.825rem', 
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155'
            }}
          >
            <Printer size={15} />
            <span>Format Master (8 Formats)</span>
          </Link>
          <Link 
            to="/quotations/create" 
            className="btn btn-primary" 
            style={{ 
              height: '36px', 
              padding: '0 0.95rem', 
              fontSize: '0.825rem', 
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            <Plus size={15} />
            <span>Create New Quotation</span>
          </Link>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          backgroundColor: '#0284c7',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          boxShadow: '0 8px 20px rgba(2, 132, 199, 0.3)',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter & Table Container */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
        {/* Tab & Filters Bar */}
        <div style={{ padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', backgroundColor: '#ffffff', flexWrap: 'wrap' }}>
          
          {/* Tabs: All Quotations vs Pending Review */}
          <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: '#f1f5f9', padding: '0.2rem', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              style={{
                border: 'none',
                backgroundColor: activeTab === 'all' ? '#ffffff' : 'transparent',
                color: activeTab === 'all' ? '#0f172a' : '#64748b',
                fontWeight: activeTab === 'all' ? 700 : 500,
                fontSize: '0.78rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: activeTab === 'all' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              All Quotations
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              style={{
                border: 'none',
                backgroundColor: activeTab === 'pending' ? '#ffffff' : 'transparent',
                color: activeTab === 'pending' ? '#0284c7' : '#64748b',
                fontWeight: activeTab === 'pending' ? 700 : 500,
                fontSize: '0.78rem',
                padding: '0.3rem 0.75rem',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                boxShadow: activeTab === 'pending' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Clock size={13} />
              <span>Pending Review</span>
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search Quotation No, Customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.1rem', height: '34px', fontSize: '0.8rem', borderRadius: '8px', borderColor: '#cbd5e1' }}
              />
            </div>

            {activeTab === 'all' && (
              <select 
                className="form-control" 
                style={{ width: '150px', height: '34px', fontSize: '0.8rem', borderRadius: '8px', borderColor: '#cbd5e1' }} 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Follow-up Pending">Follow-up Pending</option>
                <option value="Customer Interested">Customer Interested</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Partially Confirmed">Partially Confirmed</option>
                <option value="Rejected">Rejected</option>
                <option value="Closed">Closed</option>
              </select>
            )}
          </div>
        </div>

        {/* Quotations Table */}
        <div style={{ overflowX: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Quotation No.</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Customer Name</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Salesperson</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Format</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Amount</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '0.5rem 0.6rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading quotations...</span>
                    </div>
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.25rem', fontSize: '0.825rem', color: '#64748b' }}>No quotations found.</td></tr>
              ) : (
                quotations.map(q => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{q.quotationNumber}</td>
                    <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDate(q.date)}</td>
                    <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{q.customerName}</td>
                    <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{q.salesperson || '-'}</td>
                    <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap' }}>
                      <span style={{ 
                        fontSize: '0.65rem', 
                        fontWeight: 700, 
                        color: '#0284c7', 
                        backgroundColor: '#e0f2fe', 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: '5px',
                        border: '1px solid #bae6fd',
                        display: 'inline-block',
                        textTransform: 'uppercase'
                      }}>
                        {q.quotationType || 'STANDARD'}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>{formatCurrency(q.quotationAmount)}</td>
                    <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={q.status} />
                    </td>
                    <td style={{ padding: '0.5rem 0.6rem', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        <Link 
                          to={`/quotations/${q.id}`} 
                          className="btn btn-secondary" 
                          title="View Quotation Details"
                          style={{
                            height: '26px',
                            padding: '0 0.5rem',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            borderColor: '#cbd5e1'
                          }}
                        >
                          <Eye size={12} /> View
                        </Link>
                        {String(q.status || '').toLowerCase().includes('confirm') ? (
                          <Link 
                            to={`/quotations/${q.id}`} 
                            className="btn btn-secondary" 
                            title="Quotation is CONFIRMED (Locked from direct line edits) - View details & adjustments"
                            style={{
                              height: '26px',
                              width: '26px',
                              padding: 0,
                              fontSize: '0.725rem',
                              borderRadius: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderColor: '#cbd5e1',
                              opacity: 0.75
                            }}
                          >
                            <Edit size={12} />
                          </Link>
                        ) : (
                          <Link 
                            to={`/quotations/edit/${q.id}`} 
                            className="btn btn-secondary" 
                            title="Edit Quotation"
                            style={{
                              height: '26px',
                              width: '26px',
                              padding: 0,
                              fontSize: '0.725rem',
                              borderRadius: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderColor: '#cbd5e1'
                            }}
                          >
                            <Edit size={12} />
                          </Link>
                        )}
                        {q.status === 'Draft' && (
                          <button
                            type="button"
                            onClick={() => handleQuickSend(q.id, q.quotationNumber)}
                            className="btn btn-secondary"
                            title="Mark as Sent to customer"
                            style={{
                              height: '26px',
                              width: '26px',
                              padding: 0,
                              fontSize: '0.725rem',
                              borderRadius: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#0284c7',
                              borderColor: '#bae6fd'
                            }}
                          >
                            <Send size={12} />
                          </button>
                        )}
                        {!String(q.status || '').toLowerCase().includes('confirm') && (
                          <button
                            type="button"
                            onClick={() => handleQuickConfirm(q.id, q.quotationNumber)}
                            className="btn btn-secondary"
                            title="Confirm Quotation"
                            style={{
                              height: '26px',
                              padding: '0 0.35rem',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              borderRadius: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              color: '#15803d',
                              backgroundColor: '#f0fdf4',
                              borderColor: '#86efac'
                            }}
                          >
                            <CheckCircle2 size={12} style={{ strokeWidth: 2.2 }} />
                            <span>Confirm</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleQuickExport(q.id, q.quotationNumber)}
                          className="btn btn-secondary"
                          title="Download PDF"
                          style={{
                            height: '26px',
                            width: '26px',
                            padding: 0,
                            fontSize: '0.725rem',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderColor: '#cbd5e1'
                          }}
                        >
                          <Download size={12} />
                        </button>
                        <Link 
                          to="/follow-ups" 
                          className="btn btn-secondary" 
                          title="Follow Up Journal"
                          style={{
                            height: '26px',
                            width: '26px',
                            padding: 0,
                            fontSize: '0.725rem',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderColor: '#cbd5e1'
                          }}
                        >
                          <PhoneCall size={12} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Quotations;
