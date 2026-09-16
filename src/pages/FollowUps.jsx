import React, { useState, useEffect } from 'react';
import { getFollowUps, addFollowUp, getQuotations } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { Plus, PhoneCall, ArrowLeft, Save, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

export const FollowUps = () => {
  const [followUps, setFollowUps] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    quotationId: '',
    quotationNumber: '',
    customerName: '',
    quotationAmount: 0,
    followUpDate: new Date().toISOString().split('T')[0],
    nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    user: 'Vikram Mehta',
    communicationType: 'Phone Call',
    customerResponse: '',
    remarks: '',
    expectedOrderValue: 0,
    status: 'Customer Interested',
    nextAction: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [flwRes, qtRes] = await Promise.all([getFollowUps(), getQuotations()]);
      const flwList = Array.isArray(flwRes?.data) ? flwRes.data : (Array.isArray(flwRes) ? flwRes : (Array.isArray(flwRes?.followUps) ? flwRes.followUps : []));
      const qtList = Array.isArray(qtRes?.data) ? qtRes.data : (Array.isArray(qtRes) ? qtRes : []);
      setFollowUps(flwList);
      setQuotations(qtList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleQuotationSelect = (e) => {
    const qId = e.target.value;
    setFormError('');
    const selected = quotations.find(q => q.id === qId || q._id === qId || q.quotationNumber === qId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        quotationId: selected.id || selected._id,
        quotationNumber: selected.quotationNumber,
        customerName: selected.customerName,
        quotationAmount: selected.quotationAmount,
        expectedOrderValue: selected.quotationAmount
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

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
    if (formError) setFormError('');
  };

  const handleOpenForm = (initialQuotation = null) => {
    setFormError('');
    if (initialQuotation) {
      setFormData({
        quotationId: initialQuotation.id || initialQuotation._id || '',
        quotationNumber: initialQuotation.quotationNumber || '',
        customerName: initialQuotation.customerName || '',
        quotationAmount: initialQuotation.quotationAmount || 0,
        followUpDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        user: 'Vikram Mehta',
        communicationType: 'Phone Call',
        customerResponse: '',
        remarks: '',
        expectedOrderValue: initialQuotation.quotationAmount || 0,
        status: 'Customer Interested',
        nextAction: ''
      });
    } else {
      setFormData({
        quotationId: '',
        quotationNumber: '',
        customerName: '',
        quotationAmount: 0,
        followUpDate: new Date().toISOString().split('T')[0],
        nextFollowUpDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        user: 'Vikram Mehta',
        communicationType: 'Phone Call',
        customerResponse: '',
        remarks: '',
        expectedOrderValue: 0,
        status: 'Customer Interested',
        nextAction: ''
      });
    }
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.quotationNumber) {
      setFormError('Please select an active quotation.');
      return;
    }
    if (!formData.customerResponse.trim()) {
      setFormError('Please enter the customer response or notes.');
      return;
    }

    setSaving(true);
    try {
      await addFollowUp(formData);
      setSuccessToast('Follow-up entry saved successfully!');
      setTimeout(() => {
        setSuccessToast('');
        setShowForm(false);
        loadData();
      }, 800);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error saving follow-up log.');
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <div style={{ maxWidth: '1020px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
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
            padding: '1rem 1.5rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
            fontWeight: 600
          }}>
            <CheckCircle2 size={22} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Page Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowForm(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '10px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Follow-Ups</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Add Quotation Follow-Up Log
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
              Log customer response, next follow-up date, communication channel, and order value.
            </p>
          </div>
        </div>

        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#991b1b',
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Card: Follow-Up Form Details */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            padding: '1.75rem',
            marginBottom: '1.5rem'
          }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              Follow-Up Details & Communication Log
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
              {/* Select Quotation */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Select Quotation <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.quotationNumber}
                  onChange={handleQuotationSelect}
                  required
                  style={{ height: '46px', borderRadius: '10px' }}
                >
                  <option value="">-- Choose Active Quotation --</option>
                  {quotations.map(q => (
                    <option key={q.id || q._id} value={q.quotationNumber}>
                      {q.quotationNumber} - {q.customerName} ({formatCurrency(q.quotationAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Follow-Up Date */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Follow-Up Date
                </label>
                <input
                  type="date"
                  name="followUpDate"
                  className="form-control"
                  value={formData.followUpDate}
                  onChange={handleChange}
                  required
                  style={{ height: '46px', borderRadius: '10px' }}
                />
              </div>

              {/* Next Follow-Up Date */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Next Follow-Up Date
                </label>
                <input
                  type="date"
                  name="nextFollowUpDate"
                  className="form-control"
                  value={formData.nextFollowUpDate}
                  onChange={handleChange}
                  required
                  style={{ height: '46px', borderRadius: '10px' }}
                />
              </div>

              {/* Communication Type */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Communication Type
                </label>
                <select
                  name="communicationType"
                  className="form-control"
                  value={formData.communicationType}
                  onChange={handleChange}
                  style={{ height: '46px', borderRadius: '10px' }}
                >
                  <option value="Phone Call">Phone Call</option>
                  <option value="Showroom Visit">Showroom Visit</option>
                  <option value="Site Visit">Site Visit</option>
                  <option value="WhatsApp / Email">WhatsApp / Email</option>
                </select>
              </div>

              {/* Updated Status */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Updated Status
                </label>
                <select
                  name="status"
                  className="form-control"
                  value={formData.status}
                  onChange={handleChange}
                  style={{ height: '46px', borderRadius: '10px' }}
                >
                  <option value="Follow-up Pending">Follow-up Pending</option>
                  <option value="Follow-up Completed">Follow-up Completed</option>
                  <option value="Customer Interested">Customer Interested</option>
                  <option value="Negotiation">Negotiation</option>
                  <option value="Confirmed">Confirmed</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Customer Response */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Customer Response / Conversation Notes <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  name="customerResponse"
                  className="form-control"
                  rows="3"
                  value={formData.customerResponse}
                  onChange={handleChange}
                  placeholder="What did the customer say?"
                  required
                  style={{ borderRadius: '10px' }}
                />
              </div>

              {/* Expected Order Value */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Expected Order Value (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="expectedOrderValue"
                  className="form-control"
                  value={formData.expectedOrderValue}
                  onChange={handleChange}
                  style={{ height: '46px', borderRadius: '10px' }}
                />
              </div>

              {/* Next Action Required */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Next Action Required
                </label>
                <input
                  type="text"
                  name="nextAction"
                  className="form-control"
                  value={formData.nextAction}
                  onChange={handleChange}
                  placeholder="e.g. Call architect, send revised rate"
                  style={{ height: '46px', borderRadius: '10px' }}
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.75rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.85rem'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
              style={{ borderRadius: '10px', height: '46px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.9rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                borderRadius: '10px',
                height: '46px',
                padding: '0 1.75rem',
                fontWeight: 700,
                fontSize: '0.925rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Follow-Up Entry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Quotation Follow-Up Tracking</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Identify overdue, upcoming, and expiring quotations</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenForm()}>
          <Plus size={16} />
          <span>Add Follow-Up</span>
        </button>
      </div>

      <div className="table-container" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px', fontSize: '0.785rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '130px' }}>Quotation No.</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '160px' }}>Customer</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right', minWidth: '130px' }}>Quotation Amount</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '110px' }}>Last Follow-Up</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '125px' }}>Next Follow-Up</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '130px' }}>Status</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '220px' }}>Customer Response</th>
              <th style={{ padding: '0.65rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '85px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} className="spin" style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading follow-ups...</span>
                  </div>
                </td>
              </tr>
            ) : followUps.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No follow-up entries.</td></tr>
            ) : (
              followUps.map(f => {
                const isOverdue = f.nextFollowUpDate && new Date(f.nextFollowUpDate) < new Date();
                return (
                  <tr key={f.id || f._id} style={{ backgroundColor: isOverdue ? '#fff5f5' : 'inherit', borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 700, whiteSpace: 'nowrap', color: '#0f172a', fontSize: '0.8rem' }}>{f.quotationNumber}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontSize: '0.8rem', color: '#334155' }}>{f.customerName}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right', fontSize: '0.82rem', color: '#2563eb' }}>{formatCurrency(f.quotationAmount)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', textAlign: 'center', fontSize: '0.78rem', color: '#64748b' }}>{formatDate(f.followUpDate)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      <div style={{ fontWeight: isOverdue ? 700 : 500, color: isOverdue ? '#dc2626' : '#334155', fontSize: '0.78rem' }}>
                        {formatDate(f.nextFollowUpDate)}
                      </div>
                      {isOverdue && (
                        <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'block', marginTop: '1px' }}>
                          (Overdue)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap', textAlign: 'center' }}><StatusBadge status={f.status} /></td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.4, whiteSpace: 'normal', maxWidth: '240px' }}>{f.customerResponse || f.remarks}</td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenForm(f)}
                        title="Log Follow-Up"
                        style={{ borderRadius: '6px', height: '28px', padding: '0 0.55rem', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <PhoneCall size={13} /> <span>Log</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FollowUps;
