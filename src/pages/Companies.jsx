import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, Plus, Search, Edit3, Trash2, ToggleLeft, ToggleRight, 
  CheckCircle2, AlertCircle, RefreshCw, X, Save, ArrowLeft, ShieldCheck
} from 'lucide-react';
import { getCompanies, createCompany, updateCompany, deleteCompany, deactivateCompany } from '../services/productService';
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
    code: '',
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
      code: '',
      isOwnCompany: false,
      status: 'Active'
    });
    setShowForm(true);
  };

  // Open Full Page Form for Editing Existing Company
  const handleEdit = (comp) => {
    setEditingId(comp.id);
    setFormError('');
    setFormData({
      companyName: comp.companyName || '',
      code: comp.code || '',
      isOwnCompany: !!comp.isOwnCompany,
      status: comp.status || 'Active'
    });
    setShowForm(true);
  };

  const handleDelete = async (id, name) => {
    try {
      setCompanies(prev => prev.filter(c => String(c.id) !== String(id) && c.companyName !== name));
      setSuccessToast(`Company "${name}" deleted.`);
      setTimeout(() => setSuccessToast(''), 2500);
      await deleteCompany(id, name);
    } catch (err) {
      setCompanies(prev => prev.filter(c => String(c.id) !== String(id) && c.companyName !== name));
    }
  };

  const handleToggleStatus = async (id, name) => {
    try {
      await deactivateCompany(id);
      setSuccessToast(`Status updated for "${name}".`);
      setTimeout(() => setSuccessToast(''), 2500);
      loadCompanies();
    } catch (err) {
      alert('Failed to toggle status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.companyName.trim()) {
      setFormError('Please enter Company / Brand Name.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateCompany(editingId, {
          companyName: formData.companyName.trim(),
          code: formData.code.trim(),
          isOwnCompany: formData.isOwnCompany,
          status: formData.status
        });
        setSuccessToast(`Company "${formData.companyName}" updated successfully!`);
      } else {
        await createCompany({
          companyName: formData.companyName.trim(),
          code: formData.code.trim(),
          isOwnCompany: formData.isOwnCompany,
          status: formData.status
        });
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
      (c.code && c.code.toLowerCase().includes(q));

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
              Define company name, brand code prefix, primary firm configuration, and active status.
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
        <form onSubmit={handleSubmit}>
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
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px' }}
                  required
                />
              </div>

              {/* Code / Prefix */}
              <div style={{ gridColumn: 'span 4' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Brand SKU Code Prefix
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. KJR, HND, JQR"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  style={{ height: '44px', borderRadius: '8px' }}
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
            placeholder="Search company name or code..."
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

        {/* Filter by Type */}
        <select
          className="form-control"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          style={{ width: '170px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
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
          style={{ width: '135px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
        >
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>
      </div>

      {/* Data Table Container */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Company / Brand Name</th>
              <th>Company Category</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading company records...</span>
                  </div>
                </td>
              </tr>
            ) : filteredCompanies.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No companies found matching search filters.
                </td>
              </tr>
            ) : (
              filteredCompanies
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map(comp => (
                <tr key={comp.id}>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{comp.companyName}</td>
                  <td>
                    {comp.isOwnCompany ? (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem'
                      }}>
                        <ShieldCheck size={13} />
                        <span>Primary Own Firm</span>
                      </span>
                    ) : (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: '#f8fafc',
                        color: '#475569',
                        border: '1px solid #e2e8f0',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px'
                      }}>
                        Brand Supplier / Vendor
                      </span>
                    )}
                  </td>
                  <td><StatusBadge status={comp.status} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                      <button 
                        onClick={() => handleEdit(comp)} 
                        className="action-btn action-btn-edit"
                        title="Edit Company Details"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        onClick={() => handleToggleStatus(comp.id, comp.companyName)} 
                        className="action-btn action-btn-toggle"
                        title={comp.status === 'Active' ? 'Deactivate Company' : 'Activate Company'}
                      >
                        {comp.status === 'Active' ? (
                          <ToggleRight size={17} style={{ color: '#16a34a' }} />
                        ) : (
                          <ToggleLeft size={17} style={{ color: '#94a3b8' }} />
                        )}
                      </button>
                      <button 
                        onClick={() => handleDelete(comp.id, comp.companyName)} 
                        className="action-btn action-btn-delete"
                        title="Delete Company Record"
                      >
                        <Trash2 size={15} />
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
