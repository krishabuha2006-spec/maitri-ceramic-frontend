import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Truck, Plus, Search, Edit3, ToggleLeft, ToggleRight, 
  CheckCircle2, AlertCircle, RefreshCw, X, Save, ArrowLeft, Phone, Mail, MapPin
} from 'lucide-react';
import { getVendors, createVendor, updateVendor, toggleVendorStatus } from '../services/vendorService';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';

export const Vendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Page View Mode: false = Table List Directory, true = Full Page 1020px Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [formData, setFormData] = useState({
    vendorName: '',
    mobile: '',
    email: '',
    gstNumber: '',
    address: '',
    status: 'Active'
  });

  const loadVendors = async () => {
    setLoading(true);
    try {
      const data = await getVendors();
      setVendors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  // Open Full Page Form for Adding New Vendor
  const handleAddNew = () => {
    setEditingId(null);
    setFormError('');
    setValidationErrors({});
    setFormData({
      vendorName: '',
      mobile: '',
      email: '',
      gstNumber: '',
      address: '',
      status: 'Active'
    });
    setShowForm(true);
  };

  // Open Full Page Form for Editing Existing Vendor
  const handleEdit = (vendor) => {
    setEditingId(vendor.id || vendor._id);
    setFormError('');
    setValidationErrors({});
    setFormData({
      vendorName: vendor.vendorName || '',
      mobile: vendor.mobile || '',
      email: vendor.email || '',
      gstNumber: vendor.gstNumber || '',
      address: vendor.address || '',
      status: vendor.status || (vendor.isActive === false ? 'Inactive' : 'Active')
    });
    setShowForm(true);
  };

  const handleToggleStatus = async (vendor) => {
    const id = vendor.id || vendor._id;
    const isCurrentlyActive = vendor.status === 'Active' || vendor.isActive !== false;
    const actionText = isCurrentlyActive ? 'deactivated' : 'activated';

    try {
      await toggleVendorStatus(id, isCurrentlyActive);
      setSuccessToast(`Vendor "${vendor.vendorName}" ${actionText} successfully.`);
      setTimeout(() => setSuccessToast(''), 2500);
      loadVendors();
    } catch (err) {
      alert(err.message || 'Failed to update vendor status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const errors = {};
    if (!formData.vendorName.trim()) {
      errors.vendorName = 'Vendor / Supplier Name is required.';
    }

    const trimmedGst = (formData.gstNumber || '').trim().toUpperCase();
    if (trimmedGst) {
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (trimmedGst.length !== 15 || !gstRegex.test(trimmedGst)) {
        errors.gstNumber = 'Invalid GSTIN format (e.g. 24ABCDE1234F1Z9). Must be a valid 15-character GSTIN.';
      }
    }

    if (formData.email && formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        errors.email = 'Please enter a valid email address.';
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
        vendorName: formData.vendorName.trim(),
        mobile: formData.mobile ? formData.mobile.trim() : null,
        email: formData.email ? formData.email.trim().toLowerCase() : null,
        gstNumber: trimmedGst || null,
        address: formData.address ? formData.address.trim() : null,
        status: formData.status,
        isActive: formData.status === 'Active'
      };

      if (editingId) {
        await updateVendor(editingId, payload);
        setSuccessToast(`Vendor "${formData.vendorName}" updated successfully!`);
      } else {
        await createVendor(payload);
        setSuccessToast(`New Vendor "${formData.vendorName}" created successfully!`);
      }

      setTimeout(() => setSuccessToast(''), 3000);
      setShowForm(false);
      loadVendors();
    } catch (err) {
      setFormError(err.message || 'Failed to save vendor record.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Filter logic
  const filteredVendors = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !search || 
      (v.vendorName && v.vendorName.toLowerCase().includes(q)) || 
      (v.gstNumber && v.gstNumber.toLowerCase().includes(q)) ||
      (v.mobile && v.mobile.includes(q)) ||
      (v.email && v.email.toLowerCase().includes(q));

    const matchStatus = !statusFilter || v.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Render Full Page Form View (1020px layout matching Companies & Users)
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
            <span>Back to Vendors</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {editingId ? 'Edit Vendor / Supplier Profile' : 'Add New Vendor / Supplier'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              Define supplier name, contact phone, email, GSTIN, and registered office address.
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
              
              {/* Vendor Name */}
              <div style={{ gridColumn: 'span 8' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Vendor / Supplier Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Morbi Tile Factory, Ceramic Hub Supplier..."
                  value={formData.vendorName}
                  onChange={(e) => {
                    setFormData({ ...formData, vendorName: e.target.value });
                    if (validationErrors.vendorName) setValidationErrors(prev => ({ ...prev, vendorName: '' }));
                  }}
                  style={{
                    height: '44px',
                    borderRadius: '8px',
                    borderColor: validationErrors.vendorName ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.vendorName ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.vendorName && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.vendorName}
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
                    if (validationErrors.gstNumber) setValidationErrors(prev => ({ ...prev, gstNumber: '' }));
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

              {/* Mobile Number */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Contact Mobile Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 98250 12345"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Email Address */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. supplier@morbi.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (validationErrors.email) setValidationErrors(prev => ({ ...prev, email: '' }));
                  }}
                  style={{
                    height: '44px',
                    borderRadius: '8px',
                    borderColor: validationErrors.email ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.email ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.email && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.email}
                  </div>
                )}
              </div>

              {/* Registered Address */}
              <div style={{ gridColumn: 'span 8' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
                  Registered Office / Warehouse Address
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="e.g. Plot No 42, 8-A National Highway, Morbi, Gujarat"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  style={{ borderRadius: '8px', fontSize: '0.825rem' }}
                />
              </div>

              {/* Status */}
              <div style={{ gridColumn: 'span 4' }}>
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
                  <option value="Inactive">Inactive (Disabled for new purchases)</option>
                </select>
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
                  <span>{editingId ? 'Update Vendor Profile' : 'Save Vendor Profile'}</span>
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
              <Truck size={20} />
            </div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Vendor & Supplier Management
            </h2>
          </div>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Manage ceramic tile suppliers, manufacturers & procurement vendors
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
            <span>Add New Vendor</span>
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
            placeholder="Search vendor name, GSTIN, mobile, email..."
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
          {/* Filter by Status */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '140px', height: '38px', borderRadius: '8px', fontSize: '0.825rem', flexShrink: 0 }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="table-container" style={{ width: '100%', overflowX: 'hidden' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Vendor / Supplier Name</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', fontWeight: 700 }}>Contact Info</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>GSTIN</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading vendor records...</span>
                  </div>
                </td>
              </tr>
            ) : filteredVendors.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No vendors found matching search filters.
                </td>
              </tr>
            ) : (
              filteredVendors
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map(v => (
                <tr key={v.id || v._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle', fontWeight: 700, color: '#0f172a' }}>
                    {v.vendorName}
                    {v.address && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 400, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <MapPin size={11} style={{ flexShrink: 0, color: '#94a3b8' }} />
                        <span>{v.address}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', verticalAlign: 'middle', color: '#334155' }}>
                    {v.mobile || v.email ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {v.mobile && (
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={12} style={{ color: '#2563eb' }} />
                            <span>{v.mobile}</span>
                          </div>
                        )}
                        {v.email && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Mail size={12} style={{ color: '#94a3b8' }} />
                            <span>{v.email}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', fontFamily: 'monospace', color: '#475569', fontWeight: 600 }}>
                    {v.gstNumber || '-'}
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <StatusBadge status={v.status} />
                  </td>
                  <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <button 
                        onClick={() => handleEdit(v)} 
                        className="action-btn action-btn-edit"
                        data-tooltip="Edit Vendor Details"
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
                        onClick={() => handleToggleStatus(v)} 
                        className="action-btn action-btn-toggle"
                        data-tooltip={v.status === 'Active' || v.isActive !== false ? 'Deactivate Vendor' : 'Activate Vendor'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          backgroundColor: (v.status === 'Active' || v.isActive !== false) ? '#f0fdf4' : '#f8fafc',
                          cursor: 'pointer'
                        }}
                      >
                        {v.status === 'Active' || v.isActive !== false ? (
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
          totalItems={filteredVendors.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </div>
  );
};

export default Vendors;
