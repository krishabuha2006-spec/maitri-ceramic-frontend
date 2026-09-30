import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  FolderTree, Plus, Search, Edit3, Trash2, ToggleLeft, ToggleRight, 
  CheckCircle2, AlertCircle, RefreshCw, X, Save, ArrowLeft, Layers,
  Tag, ChevronRight, Tags
} from 'lucide-react';
import { 
  getProductGroups, 
  createProductGroup, 
  updateProductGroup, 
  deleteProductGroup, 
  deactivateProductGroup 
} from '../services/productService';
import { getCategories } from '../services/categoryService';
import { usePermissions } from '../utils/permissions';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';

export const CATEGORIES = [
  'Sanitaryware',
  'Tiles',
  'Faucets',
  'Showers',
  'Wellness',
  'Allied',
  'Bathroom Accessories'
];

export const DEFAULT_PRODUCT_TYPES = [
  {
    groupName: 'Water Closet',
    category: 'Sanitaryware',
    subTypes: ['Wall Hung WC', 'Floor Mounted WC', 'Smart Water Closet', 'In-Tank WC', 'Single Unit W+W', 'One Piece Toilet', 'Couple Closet'],
    description: 'European water closets, rimless vortex flushing, wall hung and floor standing toilets'
  },
  {
    groupName: 'Wash Basin',
    category: 'Sanitaryware',
    subTypes: ['Table Top Basin', 'Wall Hung Basin', 'Under Counter Basin', 'Semi-Recessed Basin', 'Pedestal Basin', 'Integrated Vanity Basin'],
    description: 'Ceramic wash basins for vanity and counter setups'
  },
  {
    groupName: 'Urinal & Pan',
    category: 'Sanitaryware',
    subTypes: ['Sensor Urinal', 'Wall Hung Urinal', 'Squatting Pan / Orissa Pan', 'Half Stall Urinal'],
    description: 'Urinals, squatting pans and sensor flushing bowls'
  },
  {
    groupName: 'Cistern & Flush Plate',
    category: 'Sanitaryware',
    subTypes: ['Concealed Cistern', 'Dual Flush Plate', 'Pneumatic Flush Tank', 'Exposed Plastic Cistern'],
    description: 'Concealed flushing cisterns and decorative dual flush plates'
  },
  {
    groupName: 'Floor Tiles',
    category: 'Tiles',
    subTypes: ['Glazed Vitrified Tiles (GVT)', 'Polished Glazed Vitrified (PGVT)', 'Full Body Vitrified', 'Double Charge', 'Parking & Outdoor Tiles', 'Matte Porcelain'],
    description: 'Large format porcelain floor slabs and vitrified tiles'
  },
  {
    groupName: 'Wall Tiles',
    category: 'Tiles',
    subTypes: ['Digital Ceramic Wall', 'Subway / Metro Tiles', 'High Gloss Kitchen Wall', 'Elevation & Stone Textured', 'Bookmatch Marble Look', 'Highlighter Tile'],
    description: 'Glossy, matte, and textured wall tiles'
  },
  {
    groupName: 'Large Format Slabs',
    category: 'Tiles',
    subTypes: ['800x1600 mm Slab', '1200x1800 mm Slab', '1200x2400 mm Slab', 'Countertop Kitchen Slab'],
    description: 'Ultra slim and heavy duty large ceramic slabs'
  },
  {
    groupName: 'Basin Mixer',
    category: 'Faucets',
    subTypes: ['Single Lever BM', 'High Neck BM', 'Deck Mounted Pillar', 'Concealed Body Basin Mixer', 'Wall Mounted BM'],
    description: 'Precision hot and cold water basin mixer taps'
  },
  {
    groupName: 'Sink Mixer / Kitchen',
    category: 'Faucets',
    subTypes: ['Swivel Spout Sink Mixer', 'Pull-out Spray Tap', 'Wall Mounted Sink Cock', 'Deck Mounted Sink Cock'],
    description: 'Kitchen sink mixers and pull-out spout taps'
  },
  {
    groupName: 'Bath & Shower Diverter',
    category: 'Showers',
    subTypes: ['Thermostat 2 Way', 'Thermostat 3 Way', 'Manual 2 Way Diverter', 'Manual 3 Way', 'Exposed Thermostatic Column', 'Concealed Diverter Body'],
    description: 'Thermostatic and manual water mixing systems for luxury showers'
  },
  {
    groupName: 'Overhead & Hand Showers',
    category: 'Showers',
    subTypes: ['Rain Shower Head', 'Multi-Function Shower', 'Cascade Waterfall Shower', 'Hand Shower Sliding Rail Set'],
    description: 'Ceiling and wall mounted rain showers and sliding hand sprays'
  },
  {
    groupName: 'Bathtubs & Whirlpool',
    category: 'Wellness',
    subTypes: ['Freestanding Acrylic Tub', 'Drop-in Water Massage', 'Air & Water Whirlpool', 'Shower Tray Floor Mounted'],
    description: 'Luxury bathtubs, spa jets and soaking tubs'
  },
  {
    groupName: 'Allied & Accessories',
    category: 'Allied',
    subTypes: ['Health Faucet', 'Angle Valve', 'Concealed Stop Cock', 'Waste Coupling Click-Clack', 'Bottle Trap', 'Towel Rack', 'Soap Dispenser', 'Robe Hook'],
    description: 'Plumbing fittings, angle valves, health faucets and bathroom accessories'
  }
];

export const ProductGroups = () => {
  const { canCreate, canEdit, canDelete } = usePermissions('product-groups');
  const [types, setTypes] = useState([]);
  const [categoriesList, setCategoriesList] = useState(CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null, name: '' });

  // Page View Mode: false = Table List, true = Form View
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  
  const [formData, setFormData] = useState({
    groupName: '',
    category: 'Sanitaryware',
    subTypes: [],
    description: '',
    status: 'Active'
  });

  const [subTypeInput, setSubTypeInput] = useState('');

  const loadProductTypes = async () => {
    setLoading(true);
    try {
      const [data, cats] = await Promise.all([
        getProductGroups().catch(() => []),
        getCategories().catch(() => [])
      ]);

      if (Array.isArray(cats) && cats.length > 0) {
        setCategoriesList(cats.map(c => c.categoryName).filter(Boolean));
      }

      const list = Array.isArray(data) ? data : (data?.data || []);
      
      // If server returned empty, merge default pre-seeded types for an instant rich experience
      if (list.length === 0) {
        setTypes(DEFAULT_PRODUCT_TYPES.map((dt, idx) => ({ id: `default-${idx}`, ...dt, status: 'Active' })));
      } else {
        // Merge subTypes if missing
        const enriched = list.map(item => {
          if (!item.subTypes || item.subTypes.length === 0) {
            const match = DEFAULT_PRODUCT_TYPES.find(d => d.groupName.toLowerCase() === (item.groupName || '').toLowerCase());
            if (match) {
              return { ...item, category: item.category || match.category, subTypes: match.subTypes };
            }
          }
          return item;
        });
        setTypes(enriched);
      }
    } catch (err) {
      console.error('Error loading product types:', err);
      setTypes(DEFAULT_PRODUCT_TYPES.map((dt, idx) => ({ id: `default-${idx}`, ...dt, status: 'Active' })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductTypes();
  }, []);

  const handleAddNew = () => {
    setEditingId(null);
    setFormError('');
    setSubTypeInput('');
    setFormData({
      groupName: '',
      category: 'Sanitaryware',
      subTypes: [],
      description: '',
      status: 'Active'
    });
    setShowForm(true);
  };

  const handleEdit = (pt) => {
    setEditingId(pt.id || pt._id);
    setFormError('');
    setSubTypeInput('');
    setFormData({
      groupName: pt.groupName || '',
      category: pt.category || 'Sanitaryware',
      subTypes: Array.isArray(pt.subTypes) ? [...pt.subTypes] : [],
      description: pt.description || '',
      status: pt.status || (pt.isActive !== false ? 'Active' : 'Inactive')
    });
    setShowForm(true);
  };

  const handleAddSubType = () => {
    if (!subTypeInput.trim()) return;
    const newItems = subTypeInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
    const existing = new Set(formData.subTypes);
    const combined = [...formData.subTypes];
    newItems.forEach(item => {
      if (!existing.has(item)) {
        combined.push(item);
        existing.add(item);
      }
    });
    setFormData(prev => ({ ...prev, subTypes: combined }));
    setSubTypeInput('');
  };

  const handleRemoveSubType = (subToRemove) => {
    setFormData(prev => ({
      ...prev,
      subTypes: prev.subTypes.filter(s => s !== subToRemove)
    }));
  };

  const handleDelete = (id, name) => {
    setConfirmState({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = confirmState;
    setConfirmState({ isOpen: false, id: null, name: '' });
    try {
      setTypes(prev => prev.filter(g => String(g.id || g._id) !== String(id) && g.groupName !== name));
      setSuccessToast(`Product Type "${name}" deleted.`);
      setTimeout(() => setSuccessToast(''), 2500);
      await deleteProductGroup(id, name);
    } catch (err) {
      loadProductTypes();
    }
  };

  const handleToggleStatus = async (id, name) => {
    try {
      await deactivateProductGroup(id);
      setSuccessToast(`Status updated for "${name}".`);
      setTimeout(() => setSuccessToast(''), 2500);
      loadProductTypes();
    } catch (err) {
      // Fallback
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.groupName.trim()) {
      setFormError('Please enter Product Type Name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        groupName: formData.groupName.trim(),
        typeName: formData.groupName.trim(),
        category: formData.category,
        subTypes: formData.subTypes,
        description: formData.description.trim() || null,
        isActive: formData.status === 'Active'
      };

      if (editingId && !String(editingId).startsWith('default-')) {
        await updateProductGroup(editingId, payload);
        setSuccessToast(`Product Type "${payload.groupName}" updated successfully.`);
      } else {
        await createProductGroup(payload);
        setSuccessToast(`Product Type "${payload.groupName}" created successfully.`);
      }

      setTimeout(() => setSuccessToast(''), 3000);
      setShowForm(false);
      loadProductTypes();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save Product Type.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered List
  const filteredTypes = types.filter(t => {
    const matchesSearch = !search || 
      (t.groupName && t.groupName.toLowerCase().includes(search.toLowerCase())) ||
      (t.category && t.category.toLowerCase().includes(search.toLowerCase())) ||
      (Array.isArray(t.subTypes) && t.subTypes.some(s => s.toLowerCase().includes(search.toLowerCase()))) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = !categoryFilter || t.category === categoryFilter;
    const matchesStatus = !statusFilter || t.status === statusFilter || (statusFilter === 'Active' ? t.isActive !== false : t.isActive === false);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const paginatedTypes = filteredTypes.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div style={{ paddingBottom: '2.5rem', width: '100%' }}>
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
        title="Delete Product Type"
        message={`Are you sure you want to delete Product Type "${confirmState.name}" and its sub-types?`}
        confirmText="Delete"
        confirmVariant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, id: null, name: '' })}
      />

      {/* View Mode 1: Form View (Add / Edit) */}
      {showForm ? (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
              style={{ borderRadius: '8px', padding: '0.45rem 0.85rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <ArrowLeft size={15} />
              <span>Back to Product Types</span>
            </button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {editingId ? 'Edit Product Type & SubTypes' : 'Create New Product Type'}
            </h2>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.75rem', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
            {formError && (
              <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
                {/* Product Category */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Product Category <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ height: '40px', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  >
                    {categoriesList.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Product Type Name */}
                <div>
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                    Product Type Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Water Closet, Wash Basin, Floor Tiles..."
                    value={formData.groupName}
                    onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                    style={{ height: '40px', borderRadius: '8px', fontSize: '0.85rem' }}
                    required
                  />
                </div>
              </div>

              {/* SubTypes Tag Manager */}
              <div style={{ marginBottom: '1.5rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Tag size={16} style={{ color: '#2563eb' }} />
                  Included SubTypes / Variants
                </label>
                <p style={{ fontSize: '0.775rem', color: '#64748b', margin: '0 0 0.85rem 0' }}>
                  Add sub-categories or variants (e.g. Wall Hung WC, Floor Mounted WC, Smart Closet, GVT, PGVT). Enter and click Add.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Type sub-type (e.g. Wall Hung WC or comma separated)"
                    value={subTypeInput}
                    onChange={(e) => setSubTypeInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubType();
                      }
                    }}
                    style={{ height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSubType}
                    className="btn btn-primary btn-sm"
                    style={{ borderRadius: '8px', padding: '0 1rem', fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    + Add SubType
                  </button>
                </div>

                {/* Tags List */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', minHeight: '38px' }}>
                  {formData.subTypes.length === 0 ? (
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                      No sub-types added yet. Add sub-types to enable rich dropdowns in product creation.
                    </span>
                  ) : (
                    formData.subTypes.map((sub, idx) => (
                      <span
                        key={idx}
                        style={{
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe',
                          borderRadius: '20px',
                          padding: '0.25rem 0.75rem',
                          fontSize: '0.775rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        <span>{sub}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubType(sub)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Description & Application Notes
                </label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Optional technical notes, specifications, or material details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              {/* Status */}
              <div style={{ marginBottom: '1.75rem' }}>
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.825rem' }}>
                  Status
                </label>
                <select
                  className="form-control"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  style={{ width: '160px', height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn btn-secondary"
                  style={{ borderRadius: '8px', padding: '0.55rem 1.15rem', fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn btn-primary"
                  style={{ borderRadius: '8px', padding: '0.55rem 1.4rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Save size={16} />
                  <span>{saving ? 'Saving...' : 'Save Product Type'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* View Mode 2: Table List Directory */
        <div>
          {/* Top Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderTree size={24} style={{ color: '#2563eb' }} />
                Product Types & SubTypes Management
              </h1>
              <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
                Manage ceramic product hierarchy, classifications, and sub-types for Sanitaryware, Tiles, Faucets, and Bathware.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
              <Link
                to="/categories"
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
                <Tags size={15} />
                <span>Category Master</span>
              </Link>

              {canCreate && (
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="btn btn-primary"
                  style={{ borderRadius: '9px', padding: '0.55rem 1.15rem', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={16} />
                  <span>Add Product Type</span>
                </button>
              )}
            </div>
          </div>

          {/* Table Card */}
          <div className="table-container" style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto' }}>
            {/* Filter Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
                <Search size={16} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search Type, SubType, Category..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  style={{ width: '160px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
                >
                  <option value="">All Categories</option>
                  {categoriesList.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

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
            </div>

            {/* Data Table */}
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '140px' }}>Category</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '180px' }}>Product Type</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700 }}>Included SubTypes & Variants</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '100px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '0.65rem 1rem', fontWeight: 700, width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                        <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                        <span>Loading product types...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedTypes.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                      No product types found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedTypes.map((pt, idx) => {
                    const id = pt.id || pt._id || idx;
                    const subList = Array.isArray(pt.subTypes) ? pt.subTypes : [];

                    return (
                      <tr key={id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                          <span style={{
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '0.2rem 0.55rem',
                            borderRadius: '6px',
                            fontWeight: 700,
                            fontSize: '0.75rem'
                          }}>
                            {pt.category || 'Sanitaryware'}
                          </span>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.875rem' }}>
                            {pt.groupName}
                          </div>
                          {pt.description && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                              {pt.description}
                            </div>
                          )}
                        </td>

                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {subList.length === 0 ? (
                              <span style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>Standard SubType</span>
                            ) : (
                              subList.map((sub, sIdx) => (
                                <span
                                  key={sIdx}
                                  style={{
                                    backgroundColor: '#eff6ff',
                                    color: '#2563eb',
                                    border: '1px solid #dbeafe',
                                    borderRadius: '12px',
                                    padding: '0.15rem 0.55rem',
                                    fontSize: '0.72rem',
                                    fontWeight: 600
                                  }}
                                >
                                  {sub}
                                </span>
                              ))
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <StatusBadge status={pt.status || (pt.isActive !== false ? 'Active' : 'Inactive')} />
                        </td>

                        <td style={{ padding: '0.75rem 1rem', verticalAlign: 'middle', textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem', justifyContent: 'center' }}>
                            {canEdit && (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleEdit(pt)}
                                data-tooltip="Edit Product Type & SubTypes"
                                style={{ backgroundColor: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}
                              >
                                <Edit3 size={14} />
                              </button>
                            )}

                            {canDelete && (
                              <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleDelete(id, pt.groupName)}
                                data-tooltip="Delete Product Type"
                                style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }}
                              >
                                <Trash2 size={14} />
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

            {/* Pagination */}
            <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid #e2e8f0' }}>
              <Pagination
                currentPage={currentPage}
                totalItems={filteredTypes.length}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
                onPageSizeChange={(sz) => { setPageSize(sz); setCurrentPage(1); }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductGroups;
