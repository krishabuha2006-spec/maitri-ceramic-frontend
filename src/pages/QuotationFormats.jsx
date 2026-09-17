import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, Plus, Search, Edit3, Trash2, ToggleLeft, ToggleRight, 
  CheckCircle2, AlertCircle, RefreshCw, X, Save, ArrowLeft, Printer, ShieldCheck, Check
} from 'lucide-react';
import { 
  getQuotationFormats, 
  createQuotationFormat, 
  updateQuotationFormat, 
  deleteQuotationFormat, 
  deactivateQuotationFormat,
  DEFAULT_8_FORMATS 
} from '../services/quotationFormatService';
import StatusBadge from '../components/StatusBadge';
import { usePermissions } from '../utils/permissions';

export const QuotationFormats = () => {
  const { canCreate, canEdit, canDelete } = usePermissions('quotations');
  const [formats, setFormats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [successToast, setSuccessToast] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Form View State: false = Directory Table, true = Form view
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    formatKey: 'STANDARD_GST',
    formatType: 'Standard Tax Invoice Format',
    description: '',
    showGst: true,
    showMrp: true,
    showDiscount: true,
    showHsn: true,
    terms: '',
    isDefault: false,
    status: 'Active'
  });

  const loadFormats = async () => {
    setLoading(true);
    try {
      const res = await getQuotationFormats();
      setFormats(res?.data || []);
    } catch (err) {
      console.error('Error loading quotation formats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFormats();
  }, []);

  const handleAddNew = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      name: 'Quotation With GST Breakdown',
      formatKey: 'WITH_GST',
      formatType: 'Print Configuration',
      description: 'Full tax breakdown quote with CGST/SGST/IGST details',
      showGst: true,
      showMrp: true,
      showDiscount: true,
      showHsn: true,
      terms: '1. Quotation valid for 15 days from date of issue.\n2. 50% advance along with order confirmation.\n3. Goods once sold will not be taken back without return voucher.',
      isDefault: false,
      status: 'Active'
    });
    setShowForm(true);
  };

  const handleEdit = (fmt) => {
    setEditingId(fmt.id);
    setFormError('');
    setFormData({
      name: fmt.name || '',
      formatKey: fmt.formatKey || 'WITH_GST',
      formatType: fmt.formatType || 'Print Configuration',
      description: fmt.description || '',
      showGst: fmt.showGst !== false,
      showMrp: fmt.showMrp !== false,
      showDiscount: fmt.showDiscount !== false,
      showHsn: fmt.showHsn !== false,
      terms: fmt.terms || '',
      isDefault: Boolean(fmt.isDefault),
      status: fmt.status || 'Active'
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (id, name, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await deactivateQuotationFormat(id, newStatus);
      setFormats(prev => prev.map(f => String(f.id) === String(id) ? { ...f, status: newStatus } : f));
      setSuccessToast(`Format "${name}" status changed to ${newStatus}.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete quotation format "${name}"?`)) return;
    try {
      await deleteQuotationFormat(id);
      setFormats(prev => prev.filter(f => String(f.id) !== String(id)));
      setSuccessToast(`Format "${name}" deleted.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Please enter a format name.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateQuotationFormat(editingId, formData);
        setSuccessToast(`Quotation format "${formData.name}" updated successfully.`);
      } else {
        await createQuotationFormat(formData);
        setSuccessToast(`New quotation format "${formData.name}" created successfully.`);
      }
      setTimeout(() => setSuccessToast(''), 3000);
      setShowForm(false);
      loadFormats();
    } catch (err) {
      setFormError(err?.message || 'Failed to save quotation format.');
    } finally {
      setSaving(false);
    }
  };

  const filteredFormats = formats.filter(f => {
    const matchSearch = (f.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.formatKey || '').toLowerCase().includes(search.toLowerCase()) ||
      (f.formatType || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Render Form View
  if (showForm) {
    return (
      <div style={{ maxWidth: '980px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
        {/* Toast */}
        {successToast && (
          <div className="app-toast">
            <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Form Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button" 
            onClick={() => setShowForm(false)} 
            className="btn btn-secondary"
            style={{ borderRadius: '10px', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} />
            <span>Back to Formats</span>
          </button>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {editingId ? 'Edit Quotation Print Format' : 'Configure New Quotation Print Format'}
            </h2>
            <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
              Define print format template, tax calculations, line item pricing visibility & terms
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {formError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#dc2626', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Card 1: Format Details */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Printer size={18} style={{ color: '#2563eb' }} />
              <span>Format Identity & Output Configuration</span>
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
              {/* Format Name */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Format Display Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Quotation With GST (Standard)"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {/* Format Type Preset */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Format Template Type <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={formData.formatKey}
                  onChange={e => {
                    const key = e.target.value;
                    const found = DEFAULT_8_FORMATS.find(f => f.formatKey === key);
                    setFormData(prev => ({
                      ...prev,
                      formatKey: key,
                      formatType: found?.formatType || 'Print Configuration',
                      description: found?.description || prev.description,
                      showGst: found ? found.showGst : prev.showGst,
                      showMrp: found ? found.showMrp : prev.showMrp,
                      showDiscount: found ? found.showDiscount : prev.showDiscount,
                      showHsn: found ? found.showHsn : prev.showHsn
                    }));
                  }}
                  style={{ height: '42px', borderRadius: '8px', fontWeight: 600 }}
                >
                  <option value="DISCOUNT">Discounted Quotation (DISCOUNT)</option>
                  <option value="MRP">MRP Quotation (MRP)</option>
                  <option value="PENDING">Pending Items Quotation (PENDING)</option>
                  <option value="PLUMBER">Plumber Quotation (PLUMBER)</option>
                  <option value="WITH_GST">Quotation With GST Breakdown (WITH_GST)</option>
                  <option value="WITHOUT_SKU">Quotation Without SKU Code (WITHOUT_SKU)</option>
                  <option value="STANDARD">Standard Customer Quotation (STANDARD)</option>
                  <option value="DETAILED">Detailed Breakdown Quotation (DETAILED)</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Format Description & Usage Notes
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Short explanation of when this print format is used"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>

          {/* Card 2: Print Display Columns & Switches */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0' }}>
              Print Column & Calculation Visibility
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {/* Show GST */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', backgroundColor: formData.showGst ? '#f0fdf4' : '#ffffff' }}>
                <input
                  type="checkbox"
                  checked={formData.showGst}
                  onChange={e => setFormData({ ...formData, showGst: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>Calculate & Print GST Taxes</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Includes CGST/SGST/IGST tax rates and tax summary block</div>
                </div>
              </label>

              {/* Show MRP */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', backgroundColor: formData.showMrp ? '#f0fdf4' : '#ffffff' }}>
                <input
                  type="checkbox"
                  checked={formData.showMrp}
                  onChange={e => setFormData({ ...formData, showMrp: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>Show MRP Column</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Displays official manufacturer Maximum Retail Price per box/sqft</div>
                </div>
              </label>

              {/* Show Discount */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', backgroundColor: formData.showDiscount ? '#f0fdf4' : '#ffffff' }}>
                <input
                  type="checkbox"
                  checked={formData.showDiscount}
                  onChange={e => setFormData({ ...formData, showDiscount: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>Show Discount % Column</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Shows special project/contractor discount percentage explicitly</div>
                </div>
              </label>

              {/* Show HSN */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.75rem 1rem', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', backgroundColor: formData.showHsn ? '#f0fdf4' : '#ffffff' }}>
                <input
                  type="checkbox"
                  checked={formData.showHsn}
                  onChange={e => setFormData({ ...formData, showHsn: e.target.checked })}
                  style={{ width: '18px', height: '18px', accentColor: '#16a34a', cursor: 'pointer' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>Show HSN Code Column</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Displays ceramic tile HSN code (6907) for tax compliance</div>
                </div>
              </label>
            </div>
          </div>

          {/* Card 3: Terms and Conditions */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 1rem 0' }}>
              Standard Terms & Conditions (Footer)
            </h3>
            <textarea
              rows={4}
              className="form-control"
              placeholder="Terms and conditions to be printed at the bottom of the quotation..."
              value={formData.terms}
              onChange={e => setFormData({ ...formData, terms: e.target.value })}
              style={{ borderRadius: '8px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
              style={{ padding: '0.65rem 1.4rem', borderRadius: '8px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.75rem', borderRadius: '8px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
            >
              <Save size={16} />
              <span>{saving ? 'Saving...' : 'Save Format Configuration'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Render Main Directory Table
  return (
    <div>
      {/* Toast */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Quotation Format Master
            </h2>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
              8 Print Formats
            </span>
          </div>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Manage all 8 quotation print templates, GST tax breakdowns, line-item pricing visibility, and terms
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            to="/quotations"
            className="btn btn-secondary"
            style={{ borderRadius: '8px', padding: '0.5rem 0.9rem', fontSize: '0.825rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={16} />
            <span>Quotation Directory</span>
          </Link>

          {canCreate && (
            <button
              type="button"
              onClick={handleAddNew}
              className="btn btn-primary"
              style={{ borderRadius: '8px', padding: '0.5rem 1.1rem', fontSize: '0.825rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)' }}
            >
              <Plus size={16} />
              <span>New Print Format</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="table-container" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
        {/* Filter bar */}
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: '380px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search format name, key or type..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2.1rem', height: '36px', fontSize: '0.825rem', borderRadius: '8px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ height: '36px', fontSize: '0.825rem', borderRadius: '8px', minWidth: '130px' }}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        {/* Formats Data Table */}
        <table className="data-table">
          <thead>
            <tr>
              <th>Format Name</th>
              <th>Template Category</th>
              <th>Format Key</th>
              <th>Print Features</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <RefreshCw size={22} className="spin" style={{ color: '#2563eb', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>Fetching formats from backend API...</div>
                </td>
              </tr>
            ) : filteredFormats.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No quotation formats found matching criteria.
                </td>
              </tr>
            ) : (
              filteredFormats.map(f => (
                <tr key={f.id}>
                  <td>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{f.name}</div>
                    <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '0.1rem' }}>{f.description}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>{f.formatType}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, backgroundColor: '#f1f5f9', color: '#475569', padding: '0.15rem 0.5rem', borderRadius: '5px' }}>
                      {f.formatKey}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {f.showGst && (
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#f0fdf4', color: '#16a34a', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #bbf7d0' }}>
                          GST
                        </span>
                      )}
                      {f.showMrp && (
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                          MRP
                        </span>
                      )}
                      {f.showDiscount && (
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#fef3c7', color: '#d97706', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #fde68a' }}>
                          Discount
                        </span>
                      )}
                      {f.showHsn && (
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid #ddd6fe' }}>
                          HSN
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      color: f.status === 'Active' ? '#16a34a' : '#94a3b8',
                      backgroundColor: f.status === 'Active' ? '#f0fdf4' : '#f8fafc',
                      border: f.status === 'Active' ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '5px',
                      letterSpacing: '0.02em'
                    }}>
                      <CheckCircle2 size={12} />
                      {f.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleEdit(f)}
                          className="action-btn action-btn-edit"
                          title="Edit Format Configuration"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(f.id, f.name, f.status)}
                          className="action-btn action-btn-toggle"
                          title={f.status === 'Active' ? 'Deactivate Format' : 'Activate Format'}
                        >
                          {f.status === 'Active' ? (
                            <ToggleRight size={16} style={{ color: '#16a34a' }} />
                          ) : (
                            <ToggleLeft size={16} style={{ color: '#94a3b8' }} />
                          )}
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id, f.name)}
                          className="action-btn action-btn-delete"
                          title="Delete Format"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
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

export default QuotationFormats;
