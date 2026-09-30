import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getProducts,
  toggleProductStatus,
  deleteProduct,
  bulkDeleteProducts,
  deleteAllProducts,
  getCompanies,
  getProductGroups
} from '../services/productService';
import { formatCurrency } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import {
  Plus, Search, Eye, Edit, ToggleLeft, ToggleRight,
  RefreshCw, X, Trash2, CheckCircle2, UploadCloud,
  Boxes, AlertTriangle, Building2, Package, CheckSquare, Square,
  MinusSquare, AlertOctagon
} from 'lucide-react';
import { usePermissions } from '../utils/permissions';

export const Products = () => {
  const { canCreate, canEdit, canDelete } = usePermissions('products');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Confirm modal state: { isOpen: boolean, type: 'single'|'bulk'|'all', id?: string, name?: string, count?: number }
  const [confirmState, setConfirmState] = useState({ isOpen: false, type: 'single', id: null, name: '', count: 0 });

  // Dynamic filter options
  const [companies, setCompanies] = useState([]);
  const [groups, setGroups] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    getCompanies()
      .then(res => {
        if (Array.isArray(res)) setCompanies(res);
      })
      .catch(console.error);

    getProductGroups()
      .then(res => {
        if (Array.isArray(res)) setGroups(res);
      })
      .catch(console.error);
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await getProducts({ search, company: companyFilter, productGroup: groupFilter, status: statusFilter });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setProducts(list);
      // Prune selectedIds that no longer exist
      setSelectedIds(prev => prev.filter(id => list.some(p => String(p.id) === String(id))));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadProducts();
  }, [search, companyFilter, groupFilter, statusFilter]);

  const handleToggleStatus = async (id, name, currentStatus) => {
    try {
      await toggleProductStatus(id);
      const newStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
      setProducts(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
      setSuccessToast(`Product "${name || id}" status changed to ${newStatus}.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // 1. Single delete trigger
  const handleDeleteProduct = (id, name) => {
    setConfirmState({ isOpen: true, type: 'single', id, name, count: 1 });
  };

  // 2. Bulk delete selected trigger
  const handleBulkDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    setConfirmState({
      isOpen: true,
      type: 'bulk',
      id: null,
      name: '',
      count: selectedIds.length
    });
  };

  // 3. Delete ALL products trigger
  const handleDeleteAllProducts = () => {
    if (products.length === 0) return;
    setConfirmState({
      isOpen: true,
      type: 'all',
      id: null,
      name: '',
      count: products.length
    });
  };

  // Unified confirm delete execution
  const handleConfirmDelete = async () => {
    const { type, id, name, count } = confirmState;
    setConfirmState({ isOpen: false, type: 'single', id: null, name: '', count: 0 });
    setActionLoading(true);

    try {
      if (type === 'single') {
        await deleteProduct(id);
        setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
        setSelectedIds(prev => prev.filter(item => String(item) !== String(id)));
        setSuccessToast(`Product "${name || id}" deleted successfully.`);
      } else if (type === 'bulk') {
        const res = await bulkDeleteProducts(selectedIds);
        const deletedCount = res?.data?.deletedCount || res?.deletedCount || count;
        setProducts(prev => prev.filter(p => !selectedIds.includes(String(p.id))));
        setSelectedIds([]);
        setSuccessToast(`Successfully deleted ${deletedCount} selected products.`);
      } else if (type === 'all') {
        const res = await deleteAllProducts();
        const deletedCount = res?.data?.deletedCount || res?.deletedCount || products.length;
        setProducts([]);
        setSelectedIds([]);
        setSuccessToast(`Successfully purged all ${deletedCount} products from database.`);
      }
      setTimeout(() => setSuccessToast(''), 3500);
    } catch (err) {
      console.error('Delete execution error:', err);
      alert(err.message || 'Failed to delete products.');
    } finally {
      setActionLoading(false);
    }
  };

  // Selection handlers
  const currentPageItems = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const isAllCurrentPageSelected = currentPageItems.length > 0 && currentPageItems.every(p => selectedIds.includes(String(p.id)));
  const isSomeCurrentPageSelected = currentPageItems.some(p => selectedIds.includes(String(p.id))) && !isAllCurrentPageSelected;

  const handleToggleSelectPage = () => {
    if (isAllCurrentPageSelected) {
      const pageIds = new Set(currentPageItems.map(p => String(p.id)));
      setSelectedIds(prev => prev.filter(id => !pageIds.has(id)));
    } else {
      const newIds = new Set([...selectedIds, ...currentPageItems.map(p => String(p.id))]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map(p => String(p.id)));
    }
  };

  const handleToggleSelectOne = (id) => {
    const strId = String(id);
    setSelectedIds(prev =>
      prev.includes(strId) ? prev.filter(item => item !== strId) : [...prev, strId]
    );
  };

  const handleResetFilters = () => {
    setSearch('');
    setCompanyFilter('');
    setGroupFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = Boolean(search || companyFilter || groupFilter || statusFilter);

  return (
    <div style={{ paddingBottom: '2.5rem' }}>
      {/* Toast Notification */}
      {successToast && (
        <div className="app-toast">
          <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1.25rem',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#0f172a',
            margin: 0
          }}>
            Product
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Catalog listing of products, prices, GST & stock quantities
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {canDelete && products.length > 0 && (
            <button
              type="button"
              onClick={handleDeleteAllProducts}
              disabled={actionLoading}
              style={{
                borderRadius: '9px',
                padding: '0.5rem 0.85rem',
                fontWeight: 600,
                fontSize: '0.825rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: '#fff',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
              title="Delete all products from database"
            >
              <AlertOctagon size={15} />
              <span>Delete All ({products.length})</span>
            </button>
          )}

          {canCreate && (
            <Link
              to="/imports"
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
              <UploadCloud size={16} />
              <span>Product Import</span>
            </Link>
          )}

          {canCreate && (
            <Link
              to="/products/new"
              className="btn btn-primary"
              style={{
                borderRadius: '9px',
                padding: '0.5rem 1rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Plus size={16} />
              <span>Add Product</span>
            </Link>
          )}
        </div>
      </div>

      {/* Product Catalog Stats Cards */}
      {(() => {
        const total = products.length;
        const active = products.filter(p => p.status === 'Active').length;
        const lowCount = products.filter(p => Number(p.currentStock !== undefined ? p.currentStock : (p.openingStock || 0)) <= Number(p.reorderAlertQty || p.alertStockQty || 10)).length;
        return (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.25rem'
          }}>
            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Boxes size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total Products</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{total}</div>
              </div>
            </div>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Catalog</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#15803d' }}>{active}</div>
              </div>
            </div>

            <Link 
              to="/stock" 
              style={{ 
                textDecoration: 'none',
                backgroundColor: lowCount > 0 ? '#fef2f2' : '#ffffff', 
                borderRadius: '12px', 
                border: lowCount > 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0', 
                padding: '1rem 1.15rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.85rem', 
                boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: lowCount > 0 ? '#fee2e2' : '#f8fafc', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: lowCount > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span>Low Stock Alert</span>
                  {lowCount > 0 && (
                    <span style={{ minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {lowCount}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: lowCount > 0 ? '#dc2626' : '#0f172a' }}>{lowCount}</div>
              </div>
            </Link>

            <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '0.85rem', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Building2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Brands / Companies</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a' }}>{companies.length}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating / Sticky Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <div style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '0.75rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.25)',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <span style={{
              backgroundColor: '#3b82f6',
              color: '#fff',
              fontSize: '0.75rem',
              fontWeight: 800,
              padding: '0.2rem 0.6rem',
              borderRadius: '20px'
            }}>
              {selectedIds.length} Selected
            </span>
            <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
              {selectedIds.length === products.length ? 'All products in catalog selected' : `Selected from current view`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            {selectedIds.length < products.length && (
              <button
                type="button"
                onClick={handleToggleSelectAll}
                style={{
                  background: 'none',
                  border: '1px solid #475569',
                  color: '#e2e8f0',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '7px',
                  fontSize: '0.775rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Select All ({products.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              style={{
                background: 'none',
                border: '1px solid #475569',
                color: '#94a3b8',
                padding: '0.35rem 0.75rem',
                borderRadius: '7px',
                fontSize: '0.775rem',
                cursor: 'pointer'
              }}
            >
              Clear Selection
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={handleBulkDeleteSelected}
                disabled={actionLoading}
                style={{
                  backgroundColor: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  padding: '0.4rem 0.95rem',
                  borderRadius: '7px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
                }}
              >
                <Trash2 size={15} />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Table Container (No Horizontal Scrollbar) */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden'
      }}>

        {/* Filters Bar */}
        <div style={{
          padding: '0.85rem 1.15rem',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '340px' }}>
            <Search size={15} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search Product Name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                paddingLeft: '2.25rem',
                height: '38px',
                borderRadius: '8px',
                fontSize: '0.825rem'
              }}
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

          {/* Dynamic Filter by Company */}
          <select
            className="form-control"
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            style={{ minWidth: '180px', width: 'auto', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          >
            <option value="">All Brands</option>
            {companies.map(c => (
              <option key={c.id || c.companyName} value={c.companyName}>{c.companyName}</option>
            ))}
          </select>

          {/* Dynamic Filter by Product Type */}
          <select
            className="form-control"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            style={{ minWidth: '220px', width: 'auto', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          >
            <option value="">All Product Types</option>
            {groups.map(g => (
              <option key={g.id || g.groupName} value={g.groupName}>{g.groupName}</option>
            ))}
          </select>

          {/* Filter by Status */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ minWidth: '120px', width: 'auto', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                border: 'none',
                background: 'none',
                color: '#2563eb',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem'
              }}
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Responsive Clean Product Table */}
        <div style={{ overflowX: 'auto', width: '100%', WebkitOverflowScrolling: 'touch', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '0.775rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ width: '40px', padding: '0.55rem 0.65rem', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isAllCurrentPageSelected}
                    ref={el => { if (el) el.indeterminate = isSomeCurrentPageSelected; }}
                    onChange={handleToggleSelectPage}
                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                    title={isAllCurrentPageSelected ? 'Deselect page' : 'Select all on page'}
                  />
                </th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700 }}>SKU</th>
                <th style={{ padding: '0.55rem 0.65rem', fontWeight: 700 }}>Product Name</th>
                <th style={{ padding: '0.55rem 0.65rem', fontWeight: 700 }}>Company</th>
                <th style={{ padding: '0.55rem 0.65rem', fontWeight: 700 }}>Product Type</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>HSN</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>Unit</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right' }}>MRP</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right' }}>Sale Price</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>Stock Qty</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    <RefreshCw size={20} className="spin" style={{ color: '#2563eb', marginBottom: '0.4rem' }} />
                    <div>Loading catalog...</div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                currentPageItems.map(p => {
                  const isLowStock = p.actualStock <= (p.reorderLevel || 10);
                  const effectiveSalePrice = Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.mrp || 0);
                  const isSelected = selectedIds.includes(String(p.id));

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        whiteSpace: 'nowrap',
                        backgroundColor: isSelected ? '#f8fafc' : 'transparent'
                      }}
                    >
                      {/* Checkbox Column */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(p.id)}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                      </td>

                      {/* SKU */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          backgroundColor: '#eff6ff',
                          color: '#1d4ed8',
                          padding: '0.15rem 0.45rem',
                          borderRadius: '5px',
                          border: '1px solid #bfdbfe',
                          whiteSpace: 'nowrap',
                          display: 'inline-block'
                        }}>
                          {p.sku}
                        </span>
                      </td>

                      {/* Product Name & Thumbnail */}
                      <td style={{ padding: '0.45rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            backgroundColor: '#f8fafc',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            overflow: 'hidden'
                          }}>
                            {p.image ? (
                              <img
                                src={p.image}
                                alt={p.productName}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                onError={(e) => { e.target.style.display = 'none'; }}
                              />
                            ) : (
                              <Package size={16} style={{ color: '#94a3b8' }} />
                            )}
                          </div>
                          <Link
                            to={`/products/${p.id}`}
                            style={{
                              fontWeight: 600,
                              color: '#0f172a',
                              textDecoration: 'none',
                              fontSize: '0.785rem'
                            }}
                            title={p.productName}
                          >
                            {p.productName}
                          </Link>
                        </div>
                      </td>

                      {/* Company */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', fontWeight: 500, color: '#475569', fontSize: '0.765rem' }}>
                        {p.company}
                      </td>

                      {/* Product Type */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.765rem' }}>
                        {p.productType || p.productGroup || '-'}
                      </td>

                      {/* HSN */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center', fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                        {p.hsnCode || '-'}
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center', color: '#475569', fontWeight: 500, fontSize: '0.765rem' }}>
                        {p.unit}
                      </td>

                      {/* MRP */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'right', color: '#64748b', fontSize: '0.765rem' }}>
                        {formatCurrency(p.mrp)}
                      </td>

                      {/* Sale Price */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'right', fontWeight: 700, color: '#2563eb', fontSize: '0.8rem' }}>
                        {formatCurrency(effectiveSalePrice)}
                      </td>

                      {/* Stock Quantity */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: '0.7rem',
                          color: isLowStock ? '#dc2626' : '#16a34a',
                          backgroundColor: isLowStock ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${isLowStock ? '#fecaca' : '#bbf7d0'}`,
                          padding: '0.12rem 0.45rem',
                          borderRadius: '10px',
                          display: 'inline-block'
                        }}>
                          {p.actualStock} {p.unit}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <StatusBadge status={p.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div className="action-btn-group">
                          <Link
                            to={`/products/${p.id}`}
                            className="action-btn action-btn-view"
                            data-tooltip="View Details"
                            aria-label="View Product Details"
                          >
                            <Eye size={14} />
                          </Link>

                          {canEdit && (
                            <Link
                              to={`/products/edit/${p.id}`}
                              className="action-btn action-btn-edit"
                              data-tooltip="Edit Product"
                              aria-label="Edit Product"
                            >
                              <Edit size={14} />
                            </Link>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              className="action-btn action-btn-toggle"
                              onClick={() => handleToggleStatus(p.id, p.productName, p.status)}
                              data-tooltip={p.status === 'Active' ? 'Deactivate' : 'Activate'}
                              aria-label={p.status === 'Active' ? 'Deactivate Product' : 'Activate Product'}
                            >
                              {p.status === 'Active' ? (
                                <ToggleRight size={16} style={{ color: '#16a34a' }} />
                              ) : (
                                <ToggleLeft size={16} style={{ color: '#94a3b8' }} />
                              )}
                            </button>
                          )}

                          {canDelete && (
                            <button
                              type="button"
                              className="action-btn action-btn-delete"
                              onClick={() => handleDeleteProduct(p.id, p.productName)}
                              data-tooltip="Delete Product"
                              aria-label="Delete Product"
                              style={{ color: '#dc2626' }}
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
        </div>

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={products.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />

      </div>

      {/* Dynamic Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={
          confirmState.type === 'all'
            ? 'Purge All Products'
            : confirmState.type === 'bulk'
            ? `Delete ${confirmState.count} Products`
            : 'Delete Product'
        }
        message={
          confirmState.type === 'all'
            ? `⚠️ WARNING: You are about to permanently delete ALL ${confirmState.count} products from the database.\n\nThis will remove all products and unlink them from references. This action CANNOT be undone.`
            : confirmState.type === 'bulk'
            ? `Are you sure you want to permanently delete ${confirmState.count} selected products from the database? This cannot be undone.`
            : `Are you sure you want to permanently delete "${confirmState.name}"? This cannot be undone.`
        }
        confirmLabel={
          confirmState.type === 'all'
            ? 'Yes, Delete Everything'
            : confirmState.type === 'bulk'
            ? `Delete (${confirmState.count}) Products`
            : 'Delete Product'
        }
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, type: 'single', id: null, name: '', count: 0 })}
        danger
      />
    </div>
  );
};

export default Products;
