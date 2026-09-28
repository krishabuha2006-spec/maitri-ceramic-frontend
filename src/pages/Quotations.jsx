import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  getQuotations, 
  getPendingQuotations, 
  sendQuotation, 
  confirmQuotation, 
  cancelQuotation,
  updateQuotation,
  updateQuotationStatus,
  exportQuotationDocument 
} from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';
import { 
  Plus, Search, Eye, Edit, PhoneCall, Printer, Download, 
  CheckCircle2, FileText, RefreshCw, Send, Clock, Package, ChevronDown, Check, X, AlertCircle
} from 'lucide-react';

export const Quotations = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab State: 'all' | 'pending'
  const [activeTab, setActiveTab] = useState('all');
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Status Change Modal state
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    quotation: null,
    status: 'Customer Interested',
    remarks: '',
    saving: false
  });

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '', // 'send' | 'confirm' | 'cancel'
    id: null,
    quotationNumber: '',
    title: '',
    message: '',
    confirmLabel: '',
    danger: false
  });

  const showToast = (msg, type = 'success') => {
    setToastType(type);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

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

  const handleOpenSendModal = (id, quotationNumber) => {
    setConfirmModal({
      isOpen: true,
      type: 'send',
      id,
      quotationNumber,
      title: 'Send Quotation to Customer',
      message: `Mark quotation #${quotationNumber} as SENT to the customer?`,
      confirmLabel: 'Mark as Sent',
      danger: false
    });
  };

  const handleOpenConfirmModal = (id, quotationNumber) => {
    setConfirmModal({
      isOpen: true,
      type: 'confirm',
      id,
      quotationNumber,
      title: 'Confirm Quotation Order',
      message: `Confirm quotation #${quotationNumber} into a verified order?`,
      confirmLabel: 'Confirm Order',
      danger: false
    });
  };

  const handleOpenCancelModal = (id, quotationNumber) => {
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      id,
      quotationNumber,
      title: 'Cancel Quotation',
      message: `Are you sure you want to cancel quotation #${quotationNumber}?`,
      confirmLabel: 'Yes, Cancel',
      danger: true
    });
  };

  const handleConfirmAction = async () => {
    const { type, id, quotationNumber } = confirmModal;
    setConfirmModal(prev => ({ ...prev, isOpen: false }));

    try {
      if (type === 'send') {
        await sendQuotation(id);
        showToast(`Quotation #${quotationNumber} marked as SENT to customer.`);
      } else if (type === 'confirm') {
        await confirmQuotation(id, { remarks: 'Confirmed by customer' });
        showToast(`Quotation #${quotationNumber} successfully CONFIRMED!`);
      } else if (type === 'cancel') {
        await cancelQuotation(id);
        showToast(`Quotation #${quotationNumber} cancelled.`);
      }
      loadQuotations();
    } catch (err) {
      showToast(err.message || 'Operation failed.', 'error');
    }
  };

  const handleOpenStatusModal = (q) => {
    const validStatuses = ['Draft', 'Sent', 'Confirmed', 'Cancelled', 'Expired'];
    setStatusModal({
      isOpen: true,
      quotation: q,
      status: validStatuses.includes(q.status) ? q.status : 'Sent',
      remarks: q.remarks || '',
      saving: false
    });
  };

  const handleSaveStatusChange = async (e) => {
    if (e) e.preventDefault();
    if (!statusModal.quotation) return;
    const q = statusModal.quotation;
    const qId = q.id || q._id;
    const newStatus = statusModal.status;
    const remarks = statusModal.remarks;

    setStatusModal(prev => ({ ...prev, saving: true }));
    try {
      await updateQuotationStatus(qId, newStatus, remarks);
      showToast(`Quotation #${q.quotationNumber} status updated to "${newStatus}" successfully!`);
      setStatusModal({ isOpen: false, quotation: null, status: 'Draft', remarks: '', saving: false });
      await loadQuotations();
    } catch (err) {
      showToast(err.message || 'Failed to update quotation status.', 'error');
      setStatusModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleQuickExport = async (id, quotationNumber, quotationObj) => {
    try {
      showToast(`Generating PDF for #${quotationNumber}...`);
      await exportQuotationDocument(id, 'pdf', quotationNumber, quotationObj);
    } catch (err) {
      showToast(err.message || 'Export failed', 'error');
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
          backgroundColor: toastType === 'error' ? '#dc2626' : '#0284c7',
          color: '#ffffff',
          padding: '0.75rem 1.25rem',
          borderRadius: '10px',
          boxShadow: toastType === 'error' ? '0 8px 20px rgba(220, 38, 38, 0.3)' : '0 8px 20px rgba(2, 132, 199, 0.3)',
          fontSize: '0.85rem',
          fontWeight: 600
        }}>
          {toastType === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter & Table Container */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto', backgroundColor: '#ffffff' }}>
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
                style={{ width: '170px', height: '34px', fontSize: '0.8rem', borderRadius: '8px', borderColor: '#cbd5e1' }} 
                value={statusFilter} 
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Customer Interested">Customer Interested</option>
                <option value="Negotiation">Negotiation</option>
                <option value="Follow-up Pending">Follow-up Pending</option>
                <option value="Follow-up Completed">Follow-up Completed</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Partially Confirmed">Partially Confirmed</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
                <option value="Closed">Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            )}
          </div>
        </div>

        {/* Quotations Table */}
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Quotation No.</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Date</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Customer Name</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Products / Items</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>Amount</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                <th style={{ padding: '0.55rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={22} className="spin" style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading quotations...</span>
                    </div>
                  </td>
                </tr>
              ) : quotations.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', fontSize: '0.825rem', color: '#64748b' }}>No quotations found.</td></tr>
              ) : (
                quotations.map(q => {
                  const itemsList = Array.isArray(q.items) ? q.items : [];
                  const itemCount = itemsList.length;
                  const itemSummary = itemsList.map(i => i.productName || i.sku || i.adHocName).filter(Boolean).slice(0, 2).join(', ');

                  return (
                    <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Quotation No */}
                      <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        <Link to={`/quotations/${q.id}`} style={{ color: '#2563eb', textDecoration: 'none' }} data-tooltip="Open Quotation">
                          {q.quotationNumber}
                        </Link>
                      </td>

                      {/* Date */}
                      <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
                        {formatDate(q.date)}
                      </td>

                      {/* Customer */}
                      <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                        <div>{q.customerName}</div>
                        {q.salesperson && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>By: {q.salesperson}</div>
                        )}
                      </td>

                      {/* Products / Items */}
                      <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.78rem' }}>
                        {itemCount > 0 ? (
                          <div>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              backgroundColor: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '0.15rem 0.45rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              marginBottom: '0.15rem'
                            }}>
                              <Package size={11} /> {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                            </span>
                            <div style={{ color: '#475569', fontSize: '0.74rem', maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={itemsList.map(i => i.productName || i.sku).join('\n')}>
                              {itemSummary}{itemCount > 2 ? ` +${itemCount - 2} more` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>No products listed</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{ padding: '0.55rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                        {formatCurrency(q.quotationAmount)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenStatusModal(q)}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          title="Click to update status"
                        >
                          <StatusBadge status={q.status} />
                        </button>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          {/* View */}
                          <Link 
                            to={`/quotations/${q.id}`} 
                            className="action-btn action-btn-view"
                            data-tooltip="View Details"
                            style={{
                              height: '28px',
                              width: '28px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155'
                            }}
                          >
                            <Eye size={13} />
                          </Link>

                          {/* Quick Status Update */}
                          <button
                            type="button"
                            onClick={() => handleOpenStatusModal(q)}
                            className="action-btn action-btn-status"
                            data-tooltip="Update Status"
                            style={{
                              height: '28px',
                              width: '28px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #bae6fd',
                              backgroundColor: '#f0f9ff',
                              color: '#0284c7',
                              cursor: 'pointer'
                            }}
                          >
                            <RefreshCw size={13} />
                          </button>

                          {/* Edit */}
                          {!String(q.status || '').toLowerCase().includes('confirm') && !String(q.status || '').toLowerCase().includes('cancel') && (
                            <Link 
                              to={`/quotations/edit/${q.id}`} 
                              className="action-btn action-btn-edit"
                              data-tooltip="Edit Quotation"
                              style={{
                                height: '28px',
                                width: '28px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #cbd5e1',
                                backgroundColor: '#ffffff',
                                color: '#334155'
                              }}
                            >
                              <Edit size={13} />
                            </Link>
                          )}

                          {/* Send */}
                          {(q.status === 'Draft' || q.status === 'DRAFT') && (
                            <button
                              type="button"
                              onClick={() => handleOpenSendModal(q.id, q.quotationNumber)}
                              className="action-btn action-btn-send"
                              data-tooltip="Mark as Sent"
                              style={{
                                height: '28px',
                                width: '28px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #bae6fd',
                                backgroundColor: '#f0f9ff',
                                color: '#0284c7',
                                cursor: 'pointer'
                              }}
                            >
                              <Send size={13} />
                            </button>
                          )}

                          {/* Confirm */}
                          {!String(q.status || '').toLowerCase().includes('confirm') && !String(q.status || '').toLowerCase().includes('cancel') && (
                            <button
                              type="button"
                              onClick={() => handleOpenConfirmModal(q.id, q.quotationNumber)}
                              className="action-btn action-btn-confirm"
                              data-tooltip="Confirm Order"
                              style={{
                                height: '28px',
                                width: '28px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #86efac',
                                backgroundColor: '#f0fdf4',
                                color: '#15803d',
                                cursor: 'pointer'
                              }}
                            >
                              <CheckCircle2 size={13} />
                            </button>
                          )}

                          {/* Download PDF */}
                          <button
                            type="button"
                            onClick={() => handleQuickExport(q.id, q.quotationNumber, q)}
                            className="action-btn action-btn-download"
                            data-tooltip="Download PDF"
                            style={{
                              height: '28px',
                              width: '28px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #cbd5e1',
                              backgroundColor: '#ffffff',
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            <Download size={13} />
                          </button>

                          {/* Follow-up button passing quotationId */}
                          <Link 
                            to={`/follow-ups?quotationId=${q.id}`}
                            state={{ quotation: q }}
                            className="action-btn action-btn-followup"
                            data-tooltip="Follow Up"
                            style={{
                              height: '28px',
                              width: '28px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid #fed7aa',
                              backgroundColor: '#fff7ed',
                              color: '#c2410c'
                            }}
                          >
                            <PhoneCall size={13} />
                          </Link>

                          {/* Cancel */}
                          {!String(q.status || '').toLowerCase().includes('confirm') && !String(q.status || '').toLowerCase().includes('cancel') && (
                            <button
                              type="button"
                              onClick={() => handleOpenCancelModal(q.id, q.quotationNumber)}
                              className="action-btn action-btn-cancel"
                              data-tooltip="Cancel Quotation"
                              style={{
                                height: '28px',
                                width: '28px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="floating-toast-container">
          <div className={`floating-toast ${toastType === 'error' ? 'danger' : 'success'}`}>
            {toastType === 'error' ? (
              <AlertCircle size={18} style={{ color: '#dc2626' }} />
            ) : (
              <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {statusModal.isOpen && statusModal.quotation && (
        <Modal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false, quotation: null }))}
          title={`Update Quotation Status — #${statusModal.quotation.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false, quotation: null }))}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleSaveStatusChange}
                disabled={statusModal.saving}
                style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Check size={15} />
                <span>{statusModal.saving ? 'Updating...' : 'Save New Status'}</span>
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveStatusChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CURRENT STATUS</span>
                <div><StatusBadge status={statusModal.quotation.status} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CUSTOMER</span>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                  {statusModal.quotation.customerName}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                Select New Quotation Status <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={statusModal.status}
                onChange={e => setStatusModal(prev => ({ ...prev, status: e.target.value }))}
                style={{ fontSize: '0.85rem', height: '38px', borderRadius: '8px' }}
                required
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent (Delivered to Customer)</option>
                <option value="Confirmed">Confirmed (Realized Sale)</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                Status Remarks / Customer Notes
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={statusModal.remarks}
                onChange={e => setStatusModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Add notes about customer response, discussion, agreed price or feedback..."
                style={{ fontSize: '0.825rem', borderRadius: '8px' }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Custom Interactive Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        danger={confirmModal.danger}
      />
    </div>
  );
};

export default Quotations;

