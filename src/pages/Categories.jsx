import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Tags, Plus, Search, Edit3, Trash2, CheckCircle2, AlertCircle, 
  RefreshCw, X, Save, ArrowLeft, Layers, ShieldCheck, Check, 
  ToggleLeft, ToggleRight, Sparkles, FolderTree, Package
} from 'lucide-react';
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory, 
  deactivateCategory 
} from '../services/categoryService';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import Modal from '../components/Modal';

export const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal Form state (Add / Edit)
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    categoryName: '',
    categoryCode: '',
    description: '',
    displayOrder: 0,
    status: 'Active'
  });

  // Confirm Delete Modal state
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null, name: '' });

  const loadCategories = async () => {
    setLoading(true);
    try {
      const data = await getCategories({ search, isActive: statusFilter === 'Active' ? 'true' : (statusFilter === 'Inactive' ? 'false' : undefined) });
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [search, statusFilter]);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(''), 3500);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      categoryName: '',
      categoryCode: '',
      description: '',
      displayOrder: categories.length + 1,
      status: 'Active'
    });
    setModalOpen(true);
  };

  const handleOpenEditModal = (cat) => {
    setEditingId(cat.id || cat._id);
    setFormError('');
    setFormData({
      categoryName: cat.categoryName || '',
      categoryCode: cat.categoryCode || '',
      description: cat.description || '',
      displayOrder: cat.displayOrder || 0,
      status: cat.status || (cat.isActive !== false ? 'Active' : 'Inactive')
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.categoryName.trim()) {
      setFormError('Category Name is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, formData);
        showToast(`Category "${formData.categoryName}" updated successfully!`);
      } else {
        await createCategory(formData);
        showToast(`Category "${formData.categoryName}" created successfully!`);
      }
      setModalOpen(false);
      loadCategories();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (id, name) => {
    setConfirmState({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = confirmState;
    setConfirmState({ isOpen: false, id: null, name: '' });
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => String(c.id || c._id) !== String(id)));
      showToast(`Category "${name}" deleted successfully.`);
    } catch (err) {
      console.error('Delete category error:', err);
      showToast(err.message || 'Failed to delete category');
    }
  };

  const handleToggleStatus = async (cat) => {
    try {
      const isCurrentlyActive = cat.status === 'Active' || cat.isActive !== false;
      const updatedStatus = isCurrentlyActive ? 'Inactive' : 'Active';
      await updateCategory(cat.id || cat._id, {
        ...cat,
        status: updatedStatus,
        isActive: !isCurrentlyActive
      });
      setCategories(prev => prev.map(c => (c.id === cat.id || c._id === cat.id) ? { ...c, status: updatedStatus, isActive: !isCurrentlyActive } : c));
      showToast(`Category "${cat.categoryName}" set to ${updatedStatus}.`);
    } catch (err) {
      showToast('Failed to update category status.');
    }
  };

  // Filter & Pagination
  const filteredCategories = categories.filter(c => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      (c.categoryName && c.categoryName.toLowerCase().includes(q)) ||
      (c.categoryCode && c.categoryCode.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q));

    const isAct = c.status === 'Active' || c.isActive !== false;
    const matchesStatus = !statusFilter || (statusFilter === 'Active' ? isAct : !isAct);

    return matchesSearch && matchesStatus;
  });

  const totalItems = filteredCategories.length;
  const paginatedCategories = filteredCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totalCount = categories.length;
  const activeCount = categories.filter(c => c.status === 'Active' || c.isActive !== false).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div style={{ paddingBottom: '3rem', width: '100%' }}>
      {/* Toast Notification */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Delete Category"
        message={`Are you sure you want to delete category "${confirmState.name}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, id: null, name: '' })}
      />

      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Tags size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Product Category Master
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
                Add, update, and manage root product categories for catalog organization and filtering.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <Link
            to="/product-types"
            className="btn btn-secondary"
            style={{
              borderRadius: '9px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.825rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <FolderTree size={15} />
            <span>Product Types & SubTypes</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="btn btn-primary"
            style={{
              borderRadius: '9px',
              padding: '0.55rem 1.15rem',
              fontWeight: 700,
              fontSize: '0.85rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem'
            }}
          >
            <Plus size={16} />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '0.7rem', borderRadius: '8px', color: '#2563eb' }}>
            <Tags size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Total Categories</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a' }}>{totalCount}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '0.7rem', borderRadius: '8px', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Active Categories</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#16a34a' }}>{activeCount}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ backgroundColor: '#fef2f2', padding: '0.7rem', borderRadius: '8px', color: '#dc2626' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Inactive Categories</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#dc2626' }}>{inactiveCount}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto' }}>
        {/* Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 260px', maxWidth: '380px' }}>
            <Search size={16} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by Category Name, Code, Description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.825rem', width: '100%' }}
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

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              style={{ width: '140px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
            >
              <option value="">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Data Table */}
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '70px', textAlign: 'center' }}>#</th>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '220px' }}>Category Name</th>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '120px' }}>Code</th>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Description & Material Scope</th>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '100px', textAlign: 'center' }}>Order</th>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '110px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '120px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span>Loading categories...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedCategories.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  No categories found matching criteria.
                </td>
              </tr>
            ) : (
              paginatedCategories.map((cat, idx) => {
                const id = cat.id || cat._id || idx;
                const isAct = cat.status === 'Active' || cat.isActive !== false;

                return (
                  <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', textAlign: 'center', color: '#94a3b8', fontWeight: 600 }}>
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>

                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <span style={{
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '6px',
                          fontWeight: 800,
                          fontSize: '0.85rem'
                        }}>
                          {cat.categoryName}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.75rem'
                      }}>
                        {cat.categoryCode || '-'}
                      </span>
                    </td>

                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', color: '#475569' }}>
                      {cat.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No description specified</span>}
                    </td>

                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', textAlign: 'center', fontWeight: 700, color: '#334155' }}>
                      {cat.displayOrder || 0}
                    </td>

                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(cat)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                        title="Click to toggle status"
                      >
                        <StatusBadge status={isAct ? 'Active' : 'Inactive'} />
                      </button>
                    </td>

                    <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => handleOpenEditModal(cat)}
                          data-tooltip="Edit Category"
                          style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => handleDeleteClick(id, cat.categoryName)}
                          data-tooltip="Delete Category"
                          style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid #e2e8f0' }}>
          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={(p) => setCurrentPage(p)}
            onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Product Category' : 'Add New Product Category'}
      >
        <form onSubmit={handleSubmit} style={{ padding: '0.5rem 0' }}>
          {formError && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            {/* Category Name */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Category Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Sanitaryware, Tiles, Faucets, Kitchen Sinks..."
                value={formData.categoryName}
                onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })}
                style={{ height: '42px', borderRadius: '8px', fontSize: '0.9rem' }}
                required
                autoFocus
              />
            </div>

            {/* Category Code */}
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Category Code (Short Tag)
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. SAN, TILE, FAU"
                value={formData.categoryCode}
                onChange={(e) => setFormData({ ...formData, categoryCode: e.target.value.toUpperCase() })}
                style={{ height: '42px', borderRadius: '8px', fontSize: '0.9rem', fontFamily: 'monospace' }}
                maxLength={10}
              />
            </div>

            {/* Display Order */}
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Display Sort Order
              </label>
              <input
                type="number"
                className="form-control"
                placeholder="0"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                style={{ height: '42px', borderRadius: '8px', fontSize: '0.9rem' }}
                min="0"
              />
            </div>
          </div>

          {/* Description */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
              Description & Material Scope
            </label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="e.g. Glazed porcelain floor tiles, wall tiles, bathroom fittings..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              style={{ borderRadius: '8px', fontSize: '0.85rem' }}
            />
          </div>

          {/* Status */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
              Status
            </label>
            <select
              className="form-control"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              style={{ width: '160px', height: '40px', borderRadius: '8px', fontSize: '0.85rem' }}
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="btn btn-secondary"
              style={{ borderRadius: '8px', padding: '0.55rem 1.15rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                borderRadius: '8px',
                padding: '0.55rem 1.4rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{editingId ? 'Update Category' : 'Save Category'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Categories;
