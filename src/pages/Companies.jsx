import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Plus, Search, Edit3, ToggleLeft, ToggleRight, 
  CheckCircle2, AlertCircle, RefreshCw, X, Save, ArrowLeft, ShieldCheck
} from 'lucide-react';
import { getCompanies, createCompany, updateCompany, toggleCompanyStatus } from '../services/productService';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

export const Companies = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Page View Mode: false = Table List Directory, true = Full Page 1020px Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    companyName: '',
    gstNumber: '',
    contactPerson: '',
    contactMobile: '',
    address: '',
    isOwnCompany: false,
    status: 'Active'
  });

  const loadCompanies = async () => {
    setLoading(true);
    try {
      const data = await getCompanies();
      setCompanies(data || []);
    } catch (err) {
      console.error('Error loading companies:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  // Open Full Page Form for Adding New Company
  const handleAddNew = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      companyName: '',
      gstNumber: '',
      contactPerson: '',
      contactMobile: '',
      address: '',
      isOwnCompany: false,
      status: 'Active'
    });
    setShowForm(true);
  };

  // Open Full Page Form for Editing Existing Company
  const handleEdit = (comp) => {
    setEditingId(comp.id || comp._id);
    setFormError('');
    setFormData({
      companyName: comp.companyName || '',
      gstNumber: comp.gstNumber || '',
      contactPerson: comp.contactPerson || '',
      contactMobile: comp.contactMobile || '',
      address: comp.address || '',
      isOwnCompany: comp.companyType === 'OWN' || !!comp.isOwnCompany,
      status: comp.status || (comp.isActive === false ? 'Inactive' : 'Active')
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (comp) => {
    const id = comp.id || comp._id;
    const isCurrentlyActive = comp.status === 'Active' || comp.isActive !== false;
    const actionText = isCurrentlyActive ? 'deactivated' : 'activated';

    try {
      await toggleCompanyStatus(id, isCurrentlyActive);
      setSuccessToast(`Company "${comp.companyName}" ${actionText} successfully.`);
      setTimeout(() => setSuccessToast(''), 2500);
      loadCompanies();
    } catch (err) {
      alert(err.message || `Failed to update status.`);
    }
  };

  const [validationErrors, setValidationErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const errors = {};
    if (!formData.companyName.trim()) {
      errors.companyName = 'Company / Brand Name is required.';
    }

    const trimmedGst = (formData.gstNumber || '').trim().toUpperCase();
    if (trimmedGst) {
      // Standard Indian GSTIN Regex (15 alphanumeric characters: 2 state + 5 PAN alpha + 4 PAN num + 1 PAN alpha + 1 entity num + 'Z' + 1 checksum)
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (trimmedGst.length !== 15 || !gstRegex.test(trimmedGst)) {
        errors.gstNumber = 'Invalid GSTIN format (e.g. 24ABCDE1234F1Z9). Must be a valid 15-character GSTIN.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    setSaving(true);
    try {
      const payload = {
        companyName: formData.companyName.trim(),
        gstNumber: trimmedGst || null,
        contactPerson: formData.contactPerson ? formData.contactPerson.trim() : null,
        contactMobile: formData.contactMobile ? formData.contactMobile.trim() : null,
        address: formData.address ? formData.address.trim() : null,
        isOwnCompany: formData.isOwnCompany,
        companyType: formData.isOwnCompany ? 'OWN' : 'BRAND_MANUFACTURER',
        status: formData.status,
        isActive: formData.status === 'Active'
      };

      if (editingId) {
        await updateCompany(editingId, payload);
        setSuccessToast(`Company "${formData.companyName}" updated successfully!`);
      } else {
        await createCompany(payload);
        setSuccessToast(`New Company "${formData.companyName}" created successfully!`);
      }

      setTimeout(() => setSuccessToast(''), 3000);
      setShowForm(false);
      loadCompanies();
    } catch (err) {
      setFormError(err.message || 'Failed to save company record.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter]);

  // Filter logic
  const filteredCompanies = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !search || 
      c.companyName.toLowerCase().includes(q) || 
      (c.gstNumber && c.gstNumber.toLowerCase().includes(q)) ||
      (c.contactPerson && c.contactPerson.toLowerCase().includes(q)) ||
      (c.contactMobile && c.contactMobile.includes(q));

    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchType = !typeFilter || (typeFilter === 'own' ? c.isOwnCompany : !c.isOwnCompany);

    return matchSearch && matchStatus && matchType;
  });

  // Render Full Page Form View (1020px layout matching Users & CreateChallan)
  if (showForm) {
    return (
      <div style={{ maxWidth: '1020px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
        {/* Toast Notification */}
        {successToast && (
          <div className="app-toast">
            <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
            <span>{successToast}</span>
          </div>
        )}

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            onClick={() => setShowForm(false)} 
            className="btn btn-secondary"
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
            <span>Back to Companies</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {editingId ? 'Edit Company / Brand Profile' : 'Add New Company / Brand'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              Define company name, GSTIN, primary firm configuration, contact information, and active status.
            </p>
          </div>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            color: '#dc2626',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}>
            <AlertCircle size={18} />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Card */}
        <form onSubmit={handleSubmit} noValidate>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
            padding: '1.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
              
              {/* Company Name */}
              <div style={{ gridColumn: 'span 8' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Company / Brand Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Kajaria, Hindware, Jaquar, Somany..."
                  value={formData.companyName}
                  onChange={(e) => {
                    setFormData({ ...formData, companyName: e.target.value });
                    if (validationErrors.companyName) setValidationErrors(prev => ({ ...prev, companyName: '' }));
                  }}
                  style={{
                    height: '44px',
                    borderRadius: '8px',
                    borderColor: validationErrors.companyName ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.companyName ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.companyName && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.companyName}
                  </div>
                )}
              </div>

              {/* GST Number */}
              <div style={{ gridColumn: 'span 4' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  GSTIN / GST Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 24ABCDE1234F1Z9"
                  maxLength={15}
                  value={formData.gstNumber}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                    setFormData({ ...formData, gstNumber: val });
                    if (validationErrors.gstNumber) {
                      setValidationErrors(prev => ({ ...prev, gstNumber: '' }));
                    }
                  }}
                  style={{
                    height: '44px',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    letterSpacing: '0.5px',
                    fontWeight: 600,
                    borderColor: validationErrors.gstNumber ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.gstNumber ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.gstNumber ? (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.35rem', fontWeight: 500 }}>
                    {validationErrors.gstNumber}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: '0.25rem' }}>
                    15-character alphanumeric GSTIN (Optional)
                  </div>
                )}
              </div>

              {/* Contact Person */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Contact Person Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Rajesh Shah, Sales Head"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Contact Mobile */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Contact Mobile Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 98250 12345"
                  value={formData.contactMobile}
                  onChange={(e) => setFormData({ ...formData, contactMobile: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Address */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Registered Office / Showroom Address
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. 101, Corporate Heights, Near Circle, Ahmedabad, Gujarat"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ borderRadius: '8px', fontSize: '0.825rem' }}
                />
              </div>

              {/* Status */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Account Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px', fontWeight: 600 }}
                >
                  <option value="Active">Active (Available across catalog)</option>
                  <option value="Inactive">Inactive (Disabled for new quotations)</option>
                </select>
              </div>

              {/* Primary Own Firm Checkbox */}
              <div style={{ gridColumn: 'span 6', display: 'flex', alignItems: 'center' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem 1.1rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  width: '100%',
                  marginTop: '1.4rem'
                }}>
                  <input
                    type="checkbox"
                    id="isOwnCompanyCheckFull"
                    checked={formData.isOwnCompany}
                    onChange={(e) => setFormData({ ...formData, isOwnCompany: e.target.checked })}
                    style={{ width: '18px', height: '18px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <label htmlFor="isOwnCompanyCheckFull" style={{ cursor: 'pointer', margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    This is our Own Primary Company (Max 1 allowed)
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Bottom Action Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '1rem',
            backgroundColor: '#ffffff',
            padding: '1.25rem 1.75rem',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
          }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
              style={{ borderRadius: '9px', padding: '0.65rem 1.25rem', fontWeight: 600 }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                borderRadius: '9px',
                padding: '0.65rem 1.5rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{editingId ? 'Update Company Profile' : 'Save Company Profile'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // Render Table Directory View
  return (
    <div>
      {/* Toast Notification */}
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
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '9px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Building2 size={20} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Company & Brand Management
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Manage ceramic manufacturing brands, suppliers & primary company configurations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
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

          <button 
            className="btn btn-primary" 
            onClick={handleAddNew} 
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px', padding: '0.6rem 1.25rem', fontWeight: 700 }}
          >
            <Plus size={18} />
            <span>Add New Company</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        backgroundColor: '#ffffff',
        padding: '0.85rem 1rem',
        borderRadius: '12px',
        border: '1px solid #e2e8f0'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 260px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search company name, GSTIN, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'nowrap', flexShrink: 0, marginLeft: 'auto' }}>
          {/* Filter by Type */}
          <select
            className="form-control"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: '170px', height: '38px', borderRadius: '8px', fontSize: '0.825rem', flexShrink: 0 }}
          >
            <option value="">All Company Types</option>
            <option value="own">Primary Own Firm</option>
            <option value="brand">Brand Supplier</option>
          </select>

          {/* Filter by Status */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '135px', height: '38px', borderRadius: '8px', fontSize: '0.825rem', flexShrink: 0 }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="table-container" style={{ width: '100%', overflowX: 'auto' }}>
        <table className="data-table" style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Company / Brand Name</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Category</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>GSTIN</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Contact Info</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading company records...</span>
                  </div>
                </td>
              </tr>
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No companies found matching search filters.
                </td>
              </tr>
            ) : (
              filteredCompanies
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map(comp => (
                <tr key={comp.id || comp._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle', fontWeight: 700, color: '#0f172a' }}>
                    {comp.companyName}
                    {comp.address && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400, marginTop: '2px' }}>
                        {comp.address}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    {comp.isOwnCompany ? (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        whiteSpace: 'nowrap'
                      }}>
                        <ShieldCheck size={13} style={{ color: '#16a34a' }} />
                        <span>Primary Own Firm</span>
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #cbd5e1',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '20px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        whiteSpace: 'nowrap'
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#64748b' }}></span>
                        <span>Brand Supplier</span>
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                    {comp.gstNumber || '-'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle', color: '#334155' }}>
                    {comp.contactPerson ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{comp.contactPerson}</div>
                        {comp.contactMobile && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{comp.contactMobile}</div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle' }}>
                    <StatusBadge status={comp.status} />
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleEdit(comp)} 
                        className="action-btn action-btn-edit"
                        data-tooltip="Edit Company Details"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          color: '#2563eb',
                          cursor: 'pointer'
                        }}
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(comp)} 
                        className="action-btn action-btn-toggle"
                        data-tooltip={comp.status === 'Active' || comp.isActive !== false ? 'Deactivate Company' : 'Activate Company'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: (comp.status === 'Active' || comp.isActive !== false) ? '#f0fdf4' : '#f8fafc',
                          cursor: 'pointer'
                        }}
                      >
                        {comp.status === 'Active' || comp.isActive !== false ? (
                          <ToggleRight size={18} style={{ color: '#16a34a' }} />
                        ) : (
                          <ToggleLeft size={18} style={{ color: '#94a3b8' }} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={filteredCompanies.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default Companies;

