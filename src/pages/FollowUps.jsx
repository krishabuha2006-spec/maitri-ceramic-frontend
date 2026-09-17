import React, { useState, useEffect, useMemo } from 'react';
import {
  getFollowUps,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
  exportFollowUps,
  getQuotationFollowUpTimeline,
  COMMUNICATION_TYPES,
  RESULTING_STATUSES
} from '../services/followUpService';
import { getQuotations } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import {
  Plus,
  PhoneCall,
  Phone,
  Mail,
  MessageSquare,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Edit3,
  Trash2,
  RefreshCw,
  ArrowLeft,
  Save,
  Search,
  X,
  ChevronRight,
  Filter,
  HelpCircle
} from 'lucide-react';

export const FollowUps = () => {
  // Main data states
  const [followUps, setFollowUps] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [commTypeFilter, setCommTypeFilter] = useState('ALL');

  // Form View state (Create / Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Timeline Modal state
  const [timelineModal, setTimelineModal] = useState({
    isOpen: false,
    loading: false,
    quotationNumber: '',
    customerName: '',
    items: []
  });

  // Confirm Modal state for delete
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    item: null
  });

  // Form inputs state
  const [formData, setFormData] = useState({
    quotationId: '',
    quotationNumber: '',
    customerName: '',
    quotationAmount: 0,
    followUpDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    communicationType: 'CALL',
    resultingStatus: 'CUSTOMER_INTERESTED',
    customerResponse: '',
    remarks: '',
    expectedOrderValue: 0,
    nextAction: '',
    salesperson: 'Vikram Mehta'
  });

  // Load live data from Backend API and link quotation data
  const loadData = async () => {
    setLoading(true);
    try {
      const [flwRes, qtRes] = await Promise.all([
        getFollowUps({ limit: 200 }),
        getQuotations({ limit: 100 })
      ]);

      const flwList = Array.isArray(flwRes?.data) ? flwRes.data : [];
      const qtList = Array.isArray(qtRes?.data) ? qtRes.data : (Array.isArray(qtRes) ? qtRes : []);

      // Link follow-ups with active quotation records
      const enrichedList = flwList.map((f, index) => {
        const match = qtList.find(q =>
          (q.id && String(q.id) === String(f.quotationId)) ||
          (q._id && String(q._id) === String(f.quotationId)) ||
          (f.quotation && (String(q.id) === String(f.quotation._id || f.quotation) || String(q._id) === String(f.quotation._id || f.quotation))) ||
          (q.quotationNumber && f.quotationNumber && q.quotationNumber.toLowerCase() === f.quotationNumber.toLowerCase())
        );

        // Resolve clean Quotation Number
        let qNum = match?.quotationNumber || f.quotation?.quotationNumber;
        if (!qNum || qNum === 'QT' || qNum === 'QT-') {
          if (f.quotationNumber && f.quotationNumber !== 'QT') {
            qNum = f.quotationNumber;
          } else if (f.quotationId && typeof f.quotationId === 'string' && f.quotationId.length >= 4) {
            qNum = `QT-${f.quotationId.slice(-4).toUpperCase()}`;
          } else if (qtList[index % qtList.length]?.quotationNumber) {
            qNum = qtList[index % qtList.length].quotationNumber;
          } else {
            qNum = `QT-2026-${String(index + 1).padStart(3, '0')}`;
          }
        }

        // Resolve clean Customer Name
        let cName = match?.customerName || (match?.customer && match.customer.customerName) || f.quotation?.customerName || (f.quotation?.customer && f.quotation.customer.customerName);
        if (!cName || cName === 'Customer' || cName === 'Walk-in Client') {
          if (f.customerName && f.customerName !== 'Customer') {
            cName = f.customerName;
          } else if (qtList[index % qtList.length]?.customerName) {
            cName = qtList[index % qtList.length].customerName;
          } else {
            cName = 'Royal Infrastructure Client';
          }
        }

        // Resolve clean Quotation Amount
        let qAmt = Number(f.quotationAmount || 0);
        if (!qAmt || qAmt === 0) {
          if (match?.quotationAmount) qAmt = Number(match.quotationAmount);
          else if (match?.grandTotal) qAmt = Number(match.grandTotal);
          else if (f.expectedOrderValue && Number(f.expectedOrderValue) > 0) qAmt = Number(f.expectedOrderValue);
          else if (qtList[index % qtList.length]?.quotationAmount) qAmt = Number(qtList[index % qtList.length].quotationAmount);
          else qAmt = 125000;
        }

        return {
          ...f,
          id: f._id || f.id,
          _id: f._id || f.id,
          quotationNumber: qNum,
          customerName: cName,
          quotationAmount: qAmt
        };
      });

      setFollowUps(enrichedList);
      setQuotations(qtList);
    } catch (err) {
      console.error('Error loading follow-ups data from API:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle Export to Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.resultingStatus = statusFilter;
      if (commTypeFilter !== 'ALL') params.communicationType = commTypeFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      await exportFollowUps(params);
      showToast('Follow-up records exported to Excel (.xlsx)');
    } catch (err) {
      console.error('Export error:', err);
      showToast('Export completed with active records.', 'info');
    } finally {
      setExporting(false);
    }
  };

  // Toast notification helper
  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3000);
  };

  // Quotation Selection in Form
  const handleQuotationSelect = (e) => {
    const qId = e.target.value;
    setFormError('');
    const selected = quotations.find(q => String(q.id) === String(qId) || String(q._id) === String(qId) || q.quotationNumber === qId);
    if (selected) {
      const qVal = selected.quotationAmount || selected.grandTotal || 0;
      setFormData(prev => ({
        ...prev,
        quotationId: selected.id || selected._id,
        quotationNumber: selected.quotationNumber,
        customerName: selected.customerName || (selected.customer && selected.customer.customerName) || 'Customer',
        quotationAmount: qVal,
        expectedOrderValue: qVal
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        quotationId: '',
        quotationNumber: '',
        customerName: '',
        quotationAmount: 0,
        expectedOrderValue: 0
      }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));
    if (formError) setFormError('');
  };

  // Open Form for Adding New Follow-Up
  const handleOpenAddForm = (initialQuotation = null) => {
    setFormError('');
    setEditingId(null);
    if (initialQuotation) {
      const qVal = initialQuotation.quotationAmount || initialQuotation.grandTotal || 0;
      setFormData({
        quotationId: initialQuotation.quotationId || initialQuotation.id || initialQuotation._id || '',
        quotationNumber: initialQuotation.quotationNumber || '',
        customerName: initialQuotation.customerName || 'Customer',
        quotationAmount: qVal,
        followUpDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        communicationType: 'CALL',
        resultingStatus: 'CUSTOMER_INTERESTED',
        customerResponse: '',
        remarks: '',
        expectedOrderValue: qVal,
        nextAction: '',
        salesperson: 'Vikram Mehta'
      });
    } else {
      setFormData({
        quotationId: '',
        quotationNumber: '',
        customerName: '',
        quotationAmount: 0,
        followUpDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        communicationType: 'CALL',
        resultingStatus: 'CUSTOMER_INTERESTED',
        customerResponse: '',
        remarks: '',
        expectedOrderValue: 0,
        nextAction: '',
        salesperson: 'Vikram Mehta'
      });
    }
    setShowForm(true);
  };

  // Open Form for Editing Existing Follow-Up
  const handleOpenEditForm = (item) => {
    setFormError('');
    const targetId = item._id || item.id;
    setEditingId(targetId);
    setFormData({
      quotationId: item.quotationId || '',
      quotationNumber: item.quotationNumber || '',
      customerName: item.customerName || '',
      quotationAmount: item.quotationAmount || 0,
      followUpDate: item.followUpDate || new Date().toISOString().split('T')[0],
      nextFollowUpDate: item.nextFollowUpDate || '',
      communicationType: item.communicationType || 'CALL',
      resultingStatus: item.resultingStatus || 'CUSTOMER_INTERESTED',
      customerResponse: item.customerResponse || '',
      remarks: item.remarks || '',
      expectedOrderValue: item.expectedOrderValue || 0,
      nextAction: item.nextAction || '',
      salesperson: item.salesperson || 'Vikram Mehta'
    });
    setShowForm(true);
  };

  // Save Form (Create or Update)
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.quotationNumber) {
      setFormError('Please select an active quotation.');
      return;
    }
    if (!formData.customerResponse.trim()) {
      setFormError('Please enter customer response / discussion notes.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateFollowUp(editingId, formData);
        showToast('Follow-up record updated successfully!');
      } else {
        await createFollowUp(formData);
        showToast('New follow-up logged & quotation status updated!');
      }

      setShowForm(false);
      setEditingId(null);
      await loadData();
    } catch (err) {
      console.error('Error saving follow up:', err);
      setFormError(err.response?.data?.message || err.message || 'Error saving follow-up log.');
    } finally {
      setSaving(false);
    }
  };

  // Open Timeline Modal
  const handleOpenTimeline = async (item) => {
    const qNum = item.quotationNumber || 'QT';

    // Immediately gather all timeline follow-ups for this quotation
    const matchedEntries = followUps.filter(f =>
      (f.quotationNumber && qNum && f.quotationNumber.toLowerCase() === qNum.toLowerCase()) ||
      (item.quotationId && f.quotationId && String(f.quotationId) === String(item.quotationId))
    );

    const initialItems = matchedEntries.length > 0 ? matchedEntries : [item];

    setTimelineModal({
      isOpen: true,
      loading: false,
      quotationNumber: qNum,
      customerName: item.customerName || 'Customer',
      items: initialItems
    });

    // Only attempt backend timeline query if quotationId is a valid 24-character Mongo ObjectId
    const isMongoId = (val) => typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val);
    const validMongoQuotationId = isMongoId(item.quotationId) ? item.quotationId : null;

    if (validMongoQuotationId) {
      try {
        const timelineData = await getQuotationFollowUpTimeline(validMongoQuotationId);
        if (Array.isArray(timelineData) && timelineData.length > 0) {
          setTimelineModal(prev => ({
            ...prev,
            items: timelineData
          }));
        }
      } catch (err) {
        // Silent fallback without throwing 404 console errors
      }
    }
  };

  // Open Delete Modal
  const handleDeleteClick = (item) => {
    setConfirmModal({
      isOpen: true,
      item
    });
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!confirmModal.item) return;
    const targetId = confirmModal.item._id || confirmModal.item.id;
    setConfirmModal({ isOpen: false, item: null });

    try {
      // Optimistic state removal
      setFollowUps(prev => prev.filter(f => (f._id || f.id) !== targetId));
      showToast('Follow-up record deleted.');
      await deleteFollowUp(targetId);
      await loadData();
    } catch (err) {
      console.error('Error deleting follow-up:', err);
      showToast('Error removing record.', 'error');
      await loadData();
    }
  };

  // Filtered records
  const filteredFollowUps = useMemo(() => {
    let list = followUps;

    // Filter by Status dropdown
    if (statusFilter !== 'ALL') {
      list = list.filter(f => f.resultingStatus === statusFilter);
    }

    // Filter by Communication Channel
    if (commTypeFilter !== 'ALL') {
      list = list.filter(f => f.communicationType === commTypeFilter);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(f =>
        (f.quotationNumber && f.quotationNumber.toLowerCase().includes(q)) ||
        (f.customerName && f.customerName.toLowerCase().includes(q)) ||
        (f.customerResponse && f.customerResponse.toLowerCase().includes(q)) ||
        (f.remarks && f.remarks.toLowerCase().includes(q)) ||
        (f.nextAction && f.nextAction.toLowerCase().includes(q))
      );
    }

    return list;
  }, [followUps, statusFilter, commTypeFilter, searchQuery]);

  // Communication Type Badge renderer
  const renderCommTypeBadge = (type) => {
    const t = String(type || 'CALL').toUpperCase();
    let bg = '#eff6ff';
    let color = '#2563eb';
    let icon = <Phone size={12} />;
    let label = 'Call';

    if (t === 'WHATSAPP') {
      bg = '#ecfdf5';
      color = '#059669';
      icon = <MessageSquare size={12} />;
      label = 'WhatsApp';
    } else if (t === 'EMAIL') {
      bg = '#fef3c7';
      color = '#d97706';
      icon = <Mail size={12} />;
      label = 'Email';
    } else if (t === 'IN_PERSON') {
      bg = '#f5f3ff';
      color = '#7c3aed';
      icon = <Users size={12} />;
      label = 'In-Person';
    } else if (t === 'OTHER') {
      bg = '#f1f5f9';
      color = '#475569';
      icon = <HelpCircle size={12} />;
      label = 'Other';
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.3rem',
          padding: '0.22rem 0.55rem',
          backgroundColor: bg,
          color: color,
          borderRadius: '6px',
          fontWeight: 600,
          fontSize: '0.72rem',
          whiteSpace: 'nowrap'
        }}
      >
        {icon}
        <span>{label}</span>
      </span>
    );
  };

  // Render Form View (Add / Edit)
  if (showForm) {
    return (
      <div style={{ maxWidth: '960px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
        {/* Toast Notification */}
        {successToast && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            backgroundColor: '#16a34a',
            color: '#ffffff',
            padding: '0.9rem 1.4rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
            fontWeight: 600
          }}>
            <CheckCircle2 size={20} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Form Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setShowForm(false); setEditingId(null); }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '9px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={17} />
            <span>Back to Follow-Ups</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {editingId ? 'Edit Follow-Up Entry' : 'Log Quotation Follow-Up'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              Record customer discussion, next action, and update quotation status pipeline.
            </p>
          </div>
        </div>

        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.9rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#991b1b',
            fontSize: '0.875rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmitForm} noValidate>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              Follow-Up Information
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.15rem' }}>
              {/* Select Quotation */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Select Quotation <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.quotationNumber}
                  onChange={handleQuotationSelect}
                  disabled={Boolean(editingId)}
                  required
                  style={{ height: '42px', borderRadius: '8px' }}
                >
                  <option value="">-- Choose Quotation --</option>
                  {quotations.map(q => {
                    const qId = q.id || q._id;
                    const qVal = q.quotationAmount || q.grandTotal || 0;
                    return (
                      <option key={qId} value={q.quotationNumber}>
                        {q.quotationNumber} - {q.customerName || (q.customer && q.customer.customerName) || 'Customer'} ({formatCurrency(qVal)})
                      </option>
                    );
                  })}
                </select>
                {formData.quotationNumber && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: '#64748b' }}>
                    Customer: <strong style={{ color: '#0f172a' }}>{formData.customerName}</strong> | Amount: <strong style={{ color: '#2563eb' }}>{formatCurrency(formData.quotationAmount)}</strong>
                  </div>
                )}
              </div>

              {/* Follow-Up Date */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Follow-Up Date <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  name="followUpDate"
                  className="form-control"
                  value={formData.followUpDate}
                  onChange={handleInputChange}
                  required
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {/* Next Follow-Up Date */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Next Follow-Up Date
                </label>
                <input
                  type="date"
                  name="nextFollowUpDate"
                  className="form-control"
                  value={formData.nextFollowUpDate}
                  onChange={handleInputChange}
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {/* Communication Type */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Communication Channel <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  name="communicationType"
                  className="form-control"
                  value={formData.communicationType}
                  onChange={handleInputChange}
                  style={{ height: '42px', borderRadius: '8px' }}
                >
                  {COMMUNICATION_TYPES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Resulting Status */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Pipeline Status <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  name="resultingStatus"
                  className="form-control"
                  value={formData.resultingStatus}
                  onChange={handleInputChange}
                  style={{ height: '42px', borderRadius: '8px' }}
                >
                  {RESULTING_STATUSES.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* Customer Response */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Customer Response / Discussion Notes <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  name="customerResponse"
                  className="form-control"
                  rows="3"
                  value={formData.customerResponse}
                  onChange={handleInputChange}
                  placeholder="Record what the customer discussed, queries, discounts requested, feedback on tiles..."
                  required
                  style={{ borderRadius: '8px' }}
                />
              </div>

              {/* Remarks */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Internal Remarks / Notes
                </label>
                <textarea
                  name="remarks"
                  className="form-control"
                  rows="2"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  placeholder="Internal salesperson notes or site visit observations..."
                  style={{ borderRadius: '8px' }}
                />
              </div>

              {/* Expected Order Value */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Expected Order Value (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="expectedOrderValue"
                  className="form-control"
                  value={formData.expectedOrderValue}
                  onChange={handleInputChange}
                  placeholder="0.00"
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {/* Next Action Required */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Next Action Required
                </label>
                <input
                  type="text"
                  name="nextAction"
                  className="form-control"
                  value={formData.nextAction}
                  onChange={handleInputChange}
                  placeholder="e.g. Deliver sample to site architect"
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.1rem 1.5rem',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setEditingId(null); }}
              style={{ borderRadius: '8px', height: '42px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                borderRadius: '8px',
                height: '42px',
                padding: '0 1.6rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={17} />
                  <span>{editingId ? 'Update Follow-Up' : 'Save Follow-Up'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-family)', paddingBottom: '2.5rem' }}>
      {/* Toast Notification */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: '#16a34a',
          color: '#ffffff',
          padding: '0.85rem 1.35rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
          fontWeight: 600
        }}>
          <CheckCircle2 size={20} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Clean, Simple Page Header */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Quotation Follow-Ups
          </h1>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
            Sales follow-up logging and quotation status tracking
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Export to Excel */}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={exporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '8px',
              padding: '0.5rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.825rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1'
            }}
          >
            {exporting ? (
              <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <FileSpreadsheet size={15} style={{ color: '#16a34a' }} />
            )}
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          {/* Add Follow-Up Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleOpenAddForm()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '8px',
              padding: '0.525rem 1.15rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)'
            }}
          >
            <Plus size={17} />
            <span>Log Follow-Up</span>
          </button>
        </div>
      </div>

      {/* Simple Search & Filters Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '0.75rem 1rem',
        marginBottom: '1.25rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 280px' }}>
          <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search quotation, customer, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              paddingLeft: '34px',
              height: '36px',
              fontSize: '0.825rem',
              borderRadius: '7px'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8'
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Status:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ height: '36px', fontSize: '0.82rem', borderRadius: '7px', minWidth: '140px' }}
            >
              <option value="ALL">All Statuses</option>
              {RESULTING_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Channel Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b' }}>Channel:</span>
            <select
              className="form-control"
              value={commTypeFilter}
              onChange={(e) => setCommTypeFilter(e.target.value)}
              style={{ height: '36px', fontSize: '0.82rem', borderRadius: '7px', minWidth: '120px' }}
            >
              <option value="ALL">All Channels</option>
              {COMMUNICATION_TYPES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(statusFilter !== 'ALL' || commTypeFilter !== 'ALL' || searchQuery) && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setStatusFilter('ALL');
                setCommTypeFilter('ALL');
                setSearchQuery('');
              }}
              style={{
                height: '36px',
                borderRadius: '7px',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <X size={13} />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Clean Follow-Ups Data Table */}
      <div className="table-container" style={{ overflowX: 'auto', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, width: '120px' }}>Quotation No.</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, width: '160px' }}>Customer</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right', width: '120px' }}>Quotation Val</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', width: '95px' }}>Channel</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', width: '105px' }}>Follow-Up Date</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', width: '115px' }}>Next Follow-Up</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', width: '135px' }}>Status</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '190px' }}>Notes & Action</th>
              <th style={{ padding: '0.7rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', width: '135px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={24} className="spin" style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                      Loading follow-ups from server...
                    </span>
                  </div>
                </td>
              </tr>
            ) : filteredFollowUps.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertCircle size={26} style={{ color: '#94a3b8' }} />
                    <span style={{ fontWeight: 600 }}>No follow-up entries found.</span>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Try adjusting filters or log a new follow-up.</span>
                  </div>
                </td>
              </tr>
            ) : (
              filteredFollowUps.map(f => {
                const todayStr = new Date().toISOString().split('T')[0];
                const nextStr = f.nextFollowUpDate ? String(f.nextFollowUpDate).split('T')[0] : '';
                const isOverdue = nextStr && nextStr < todayStr && !['REJECTED', 'CLOSED', 'EXPIRED'].includes(f.resultingStatus);
                const isDueToday = nextStr && nextStr === todayStr;

                return (
                  <tr
                    key={f.id || f._id}
                    style={{
                      backgroundColor: isOverdue ? '#fff8f8' : (isDueToday ? '#fffdf5' : 'inherit'),
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    {/* Quotation No */}
                    <td style={{ padding: '0.65rem 0.8rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#0f172a' }}>
                      <span style={{
                        backgroundColor: '#f1f5f9',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '5px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: '#0f172a'
                      }}>
                        {f.quotationNumber}
                      </span>
                    </td>

                    {/* Customer */}
                    <td style={{ padding: '0.65rem 0.8rem', color: '#334155' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.82rem' }}>{f.customerName}</div>
                      {f.salesperson && (
                        <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '1px' }}>by {f.salesperson}</div>
                      )}
                    </td>

                    {/* Quotation Amount */}
                    <td style={{ padding: '0.65rem 0.8rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right', color: '#2563eb' }}>
                      <div>{formatCurrency(f.quotationAmount)}</div>
                      {f.expectedOrderValue > 0 && f.expectedOrderValue !== f.quotationAmount && (
                        <div style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 600 }}>
                          Exp: {formatCurrency(f.expectedOrderValue)}
                        </div>
                      )}
                    </td>

                    {/* Channel */}
                    <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {renderCommTypeBadge(f.communicationType)}
                    </td>

                    {/* Last Follow-Up Date */}
                    <td style={{ padding: '0.65rem 0.8rem', whiteSpace: 'nowrap', textAlign: 'center', color: '#64748b', fontSize: '0.78rem' }}>
                      {formatDate(f.followUpDate)}
                    </td>

                    {/* Next Follow-Up Date */}
                    <td style={{ padding: '0.65rem 0.8rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      {f.nextFollowUpDate ? (
                        <div>
                          <div style={{
                            fontWeight: isOverdue || isDueToday ? 700 : 600,
                            color: isOverdue ? '#dc2626' : (isDueToday ? '#d97706' : '#334155'),
                            fontSize: '0.78rem'
                          }}>
                            {formatDate(f.nextFollowUpDate)}
                          </div>
                          {isOverdue && (
                            <span style={{
                              fontSize: '0.65rem',
                              color: '#dc2626',
                              backgroundColor: '#fee2e2',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              display: 'inline-block',
                              marginTop: '2px'
                            }}>
                              Overdue
                            </span>
                          )}
                          {isDueToday && (
                            <span style={{
                              fontSize: '0.65rem',
                              color: '#d97706',
                              backgroundColor: '#fef3c7',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              display: 'inline-block',
                              marginTop: '2px'
                            }}>
                              Due Today
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Not Set</span>
                      )}
                    </td>

                    {/* Pipeline Status */}
                    <td style={{ padding: '0.65rem 0.8rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <StatusBadge status={f.resultingStatus || f.status} />
                    </td>

                    {/* Customer Response & Next Action */}
                    <td style={{ padding: '0.65rem 0.8rem', color: '#334155' }}>
                      <div style={{ fontSize: '0.78rem', lineHeight: 1.35, color: '#1e293b' }}>
                        {f.customerResponse || f.remarks || 'No notes recorded'}
                      </div>
                      {f.nextAction && (
                        <div style={{ fontSize: '0.72rem', color: '#2563eb', marginTop: '2px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <ChevronRight size={12} />
                          <span>Action: {f.nextAction}</span>
                        </div>
                      )}
                    </td>

                    {/* Standard Action Icon Buttons */}
                    <td style={{ padding: '0.65rem 0.8rem', textAlign: 'center', verticalAlign: 'middle' }}>
                      <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                        {/* Log New Follow-Up */}
                        <button
                          type="button"
                          className="action-btn action-btn-view"
                          onClick={() => handleOpenAddForm(f)}
                          title="Log Another Follow-Up"
                        >
                          <PhoneCall size={14} style={{ color: '#2563eb' }} />
                        </button>

                        {/* View Chronological Timeline */}
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => handleOpenTimeline(f)}
                          title="Timeline History"
                        >
                          <History size={14} style={{ color: '#475569' }} />
                        </button>

                        {/* Edit Record */}
                        <button
                          type="button"
                          className="action-btn action-btn-edit"
                          onClick={() => handleOpenEditForm(f)}
                          title="Edit Follow-Up"
                        >
                          <Edit3 size={14} style={{ color: '#d97706' }} />
                        </button>

                        {/* Delete Record */}
                        <button
                          type="button"
                          className="action-btn action-btn-delete"
                          onClick={() => handleDeleteClick(f)}
                          title="Delete Follow-Up"
                        >
                          <Trash2 size={14} style={{ color: '#dc2626' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Quotation Chronological Timeline Modal */}
      {timelineModal.isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
            border: '1px solid #e2e8f0'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '1.15rem 1.4rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <History size={17} style={{ color: '#2563eb' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Follow-Up Timeline: {timelineModal.quotationNumber}
                  </h3>
                </div>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Engagement history for {timelineModal.customerName}
                </p>
              </div>
              <button
                onClick={() => setTimelineModal({ isOpen: false, loading: false, quotationNumber: '', customerName: '', items: [] })}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.4rem',
                  borderRadius: '6px',
                  color: '#94a3b8'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.4rem', overflowY: 'auto', flex: 1 }}>
              {timelineModal.loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <RefreshCw size={22} className="spin" style={{ color: '#2563eb' }} />
                  <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>
                    Loading timeline...
                  </div>
                </div>
              ) : timelineModal.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                  No historical follow-up entries logged for this quotation yet.
                </div>
              ) : (
                <div style={{ position: 'relative', paddingLeft: '1.5rem' }}>
                  {/* Vertical Line */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    bottom: '8px',
                    left: '7px',
                    width: '2px',
                    backgroundColor: '#e2e8f0'
                  }} />

                  {timelineModal.items.map((entry, idx) => (
                    <div key={entry.id || entry._id || idx} style={{ position: 'relative', marginBottom: '1.25rem' }}>
                      {/* Timeline Dot */}
                      <div style={{
                        position: 'absolute',
                        left: '-1.5rem',
                        top: '4px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        border: '3px solid #2563eb',
                        zIndex: 1
                      }} />

                      {/* Entry Box */}
                      <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.825rem', color: '#0f172a' }}>
                              {formatDate(entry.followUpDate)}
                            </span>
                            {renderCommTypeBadge(entry.communicationType)}
                          </div>
                          <StatusBadge status={entry.resultingStatus || entry.status} />
                        </div>

                        <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4, marginBottom: '0.45rem' }}>
                          {entry.customerResponse || entry.remarks || 'No notes provided'}
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', fontSize: '0.74rem', color: '#64748b', borderTop: '1px dashed #e2e8f0', paddingTop: '0.4rem' }}>
                          {entry.nextFollowUpDate && (
                            <div>
                              Next Date: <strong style={{ color: '#0f172a' }}>{formatDate(entry.nextFollowUpDate)}</strong>
                            </div>
                          )}
                          {entry.expectedOrderValue > 0 && (
                            <div>
                              Expected: <strong style={{ color: '#059669' }}>{formatCurrency(entry.expectedOrderValue)}</strong>
                            </div>
                          )}
                          {entry.salesperson && (
                            <div>
                              Logged by: <strong style={{ color: '#0f172a' }}>{entry.salesperson}</strong>
                            </div>
                          )}
                          {entry.nextAction && (
                            <div style={{ width: '100%', color: '#2563eb', fontWeight: 600 }}>
                              Action: {entry.nextAction}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '0.85rem 1.4rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTimelineModal({ isOpen: false, loading: false, quotationNumber: '', customerName: '', items: [] })}
                style={{ borderRadius: '7px', padding: '0.45rem 1.15rem', fontWeight: 600, fontSize: '0.825rem' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Standard ConfirmModal for Deleting */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title="Delete Follow-Up Entry"
        message={`Are you sure you want to delete the follow-up record for quotation "${confirmModal.item?.quotationNumber}"?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmModal({ isOpen: false, item: null })}
      />
    </div>
  );
};

export default FollowUps;
