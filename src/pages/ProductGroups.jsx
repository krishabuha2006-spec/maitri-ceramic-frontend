import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderTree, Plus, Search, Edit3, Trash2, ToggleLeft, ToggleRight, 
  CheckCircle2, AlertCircle, RefreshCw, X, Save, ArrowLeft, Layers
} from 'lucide-react';
import { 
  getProductGroups, 
  createProductGroup, 
  updateProductGroup, 
  deleteProductGroup, 
  deactivateProductGroup 
} from '../services/productService';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

export const ProductGroups = () => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null, name: '' });

  // Page View Mode: false = Table List Directory, true = Form View
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    groupName: '',
    groupCode: '',
    parentGroup: '',
    description: '',
    status: 'Active'
  });

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await getProductGroups();
      setGroups(data || []);
    } catch (err) {
      console.error('Error loading product groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleAddNew = () => {
    setEditingId(null);
    setFormError('');
    setFormData({
      groupName: '',
      groupCode: '',
      parentGroup: '',
      description: '',
      status: 'Active'
    });
    setShowForm(true);
  };

  const handleEdit = (group) => {
    setEditingId(group.id);
    setFormError('');
    setFormData({
      groupName: group.groupName || '',
      groupCode: group.groupCode || '',
      parentGroup: group.parentGroup || '',
      description: group.description || '',
      status: group.status || 'Active'
    });
    setShowForm(true);
  };

  const handleDelete = (id, name) => {
    setConfirmState({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = confirmState;
    setConfirmState({ isOpen: false, id: null, name: '' });
    try {
      setGroups(prev => prev.filter(g => String(g.id) !== String(id) && g.groupName !== name));
      setSuccessToast(`Product Group "${name}" deleted.`);
      setTimeout(() => setSuccessToast(''), 2500);
      await deleteProductGroup(id, name);
    } catch (err) {
      loadGroups();
    }
  };

  const handleToggleStatus = async (id, name) => {
    try {
      await deactivateProductGroup(id);
      setSuccessToast(`Status updated for "${name}".`);
      setTimeout(() => setSuccessToast(''), 2500);
      loadGroups();
    } catch (err) {
      alert('Failed to toggle status.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.groupName.trim()) {
      setFormError('Please enter Product Group Name.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateProductGroup(editingId, formData);
        setSuccessToast(`Product Group "${formData.groupName}" updated.`);
      } else {
        await createProductGroup(formData);
        setSuccessToast(`Product Group "${formData.groupName}" created.`);
      }
      setTimeout(() => setSuccessToast(''), 2500);
      setShowForm(false);
      loadGroups();
    } catch (err) {
      setFormError(err.message || 'Failed to save product group.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // Filtered Groups
  const filteredGroups = groups.filter(g => {
    const q = search.toLowerCase();
    const matchSearch = !search || (
      (g.groupName || '').toLowerCase().includes(q) ||
      (g.groupCode || '').toLowerCase().includes(q) ||
      (g.description || '').toLowerCase().includes(q)
    );
    const matchStatus = !statusFilter || g.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalCount = groups.length;
  const activeCount = groups.filter(g => g.status === 'Active').length;
  const inactiveCount = groups.filter(g => g.status === 'Inactive').length;

  return (
    <div style={{ paddingBottom: '2.5rem' }}>
      {/* Toast Notification */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

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
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FolderTree size={24} style={{ color: '#2563eb' }} />
            Product Group Master
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Hierarchical Product Categories & Material Group Classifications
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

          {!showForm && (
            <button
              type="button"
              onClick={handleAddNew}
              className="btn btn-primary"
              style={{
                borderRadius: '9px',
                padding: '0.55rem 1.1rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Plus size={16} />
              <span>Add Product Group</span>
            </button>
          )}
        </div>
      </div>

      {showForm ? (
        /* Form View */
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          maxWidth: '780px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              {editingId ? 'Edit Product Group' : 'Create New Product Group'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', borderRadius: '7px' }}
            >
              <ArrowLeft size={14} style={{ marginRight: '0.25rem' }} /> Back to Directory
            </button>
          </div>

          {formError && (
            <div style={{ padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.825rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
              
              {/* Group Name */}
              <div style={{ gridColumn: 'span 8' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Group Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Vitrified Tiles, CP Fittings..."
                  value={formData.groupName}
                  onChange={(e) => setFormData(prev => ({ ...prev, groupName: e.target.value }))}
                  style={{ height: '42px', borderRadius: '8px' }}
                  required
                />
              </div>

              {/* Group Code */}
              <div style={{ gridColumn: 'span 4' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Group Code / Prefix
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. VT, CWT, SAN"
                  value={formData.groupCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, groupCode: e.target.value.toUpperCase() }))}
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {/* Parent Group */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Parent Group (Hierarchical Category)
                </label>
                <select
                  className="form-control"
                  value={formData.parentGroup}
                  onChange={(e) => setFormData(prev => ({ ...prev, parentGroup: e.target.value }))}
                  style={{ height: '42px', borderRadius: '8px' }}
                >
                  <option value="">None (Top-Level Category)</option>
                  {groups
                    .filter(g => String(g.id) !== String(editingId))
                    .map(g => (
                      <option key={g.id} value={g.groupName}>{g.groupName}</option>
                    ))}
                </select>
              </div>

              {/* Status */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  style={{ height: '42px', borderRadius: '8px' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Description */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ display: 'block', fontSize: '0.825rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Description / Remarks
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Additional details about this material group..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  style={{ borderRadius: '8px', padding: '0.5rem 0.75rem' }}
                />
              </div>

            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
                style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                <span>{editingId ? 'Update Group' : 'Save Product Group'}</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* List Directory View */
        <>
          {/* Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ backgroundColor: '#eff6ff', padding: '0.6rem', borderRadius: '8px', color: '#2563eb' }}>
                <Layers size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Groups</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{totalCount}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '8px', color: '#16a34a' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Groups</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{activeCount}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ backgroundColor: '#fef2f2', padding: '0.6rem', borderRadius: '8px', color: '#dc2626' }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Deactivated</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#dc2626' }}>{inactiveCount}</div>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
            overflow: 'hidden'
          }}>
            {/* Filter Bar */}
            <div style={{
              padding: '0.85rem 1.15rem',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap'
            }}>
              <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '340px' }}>
                <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search Group Name or Code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
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

              <select
                className="form-control"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '130px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
              >
                <option value="">All Status</option>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, width: '110px' }}>Code</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Product Group Name</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Parent Group</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Description</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'center', width: '100px' }}>Status</th>
                    <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'center', width: '110px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        <RefreshCw size={20} className="spin" style={{ color: '#2563eb', marginBottom: '0.4rem' }} />
                        <div>Loading Product Groups...</div>
                      </td>
                    </tr>
                  ) : filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No product groups found.
                      </td>
                    </tr>
                  ) : (
                    filteredGroups
                      .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                      .map(g => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle' }}>
                          <span style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '5px',
                            border: '1px solid #bfdbfe'
                          }}>
                            {g.groupCode || 'PG'}
                          </span>
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', fontWeight: 600, color: '#0f172a' }}>
                          {g.groupName}
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', color: '#64748b' }}>
                          {g.parentGroup ? (
                            <span style={{ backgroundColor: '#f8fafc', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #e2e8f0', fontSize: '0.75rem' }}>
                              ↳ {g.parentGroup}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Main Category</span>
                          )}
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', color: '#64748b', fontSize: '0.775rem' }}>
                          {g.description || '-'}
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <StatusBadge status={g.status} />
                        </td>

                        <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="action-btn action-btn-edit"
                              onClick={() => handleEdit(g)}
                              title="Edit Product Group"
                            >
                              <Edit3 size={14} />
                            </button>

                            <button
                              type="button"
                              className="action-btn action-btn-toggle"
                              onClick={() => handleToggleStatus(g.id, g.groupName)}
                              title={g.status === 'Active' ? 'Deactivate' : 'Activate'}
                            >
                              {g.status === 'Active' ? (
                                <ToggleRight size={16} style={{ color: '#16a34a' }} />
                              ) : (
                                <ToggleLeft size={16} style={{ color: '#94a3b8' }} />
                              )}
                            </button>

                            <button
                              type="button"
                              className="action-btn action-btn-delete"
                              onClick={() => handleDelete(g.id, g.groupName)}
                              title="Delete Product Group"
                              style={{ color: '#dc2626' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredGroups.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Delete Product Group"
        message={`Are you sure you want to permanently delete "${confirmState.name}"? This action cannot be undone.`}
        confirmLabel="Delete Group"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, id: null, name: '' })}
        danger
      />
    </div>
  );
};

export default ProductGroups;
