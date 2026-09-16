import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getProducts,
  toggleProductStatus,
  deleteProduct,
  getCompanies,
  getProductGroups
} from '../services/productService';
import { formatCurrency } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import {
  Plus, Search, Eye, Edit, ToggleLeft, ToggleRight,
  RefreshCw, X, Trash2, CheckCircle2, FolderTree, Building2, UploadCloud
} from 'lucide-react';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null, name: '' });

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

  const handleDeleteProduct = async (id, name) => {
    setConfirmState({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = confirmState;
    setConfirmState({ isOpen: false, id: null, name: '' });
    try {
      await deleteProduct(id);
      setProducts(prev => prev.filter(p => String(p.id) !== String(id)));
      setSuccessToast(`Product "${name || id}" deleted successfully.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error('Delete product error:', err);
    }
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
          <Link
            to="/product-groups"
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
            <FolderTree size={16} />
            <span>Manage Groups</span>
          </Link>

          <Link
            to="/companies"
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
            <Building2 size={16} />
            <span>Companies / Brands</span>
          </Link>

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
        </div>
      </div>

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
            style={{ width: '140px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          >
            <option value="">All Brands</option>
            {companies.map(c => (
              <option key={c.id || c.companyName} value={c.companyName}>{c.companyName}</option>
            ))}
          </select>

          {/* Dynamic Filter by Product Group */}
          <select
            className="form-control"
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            style={{ width: '150px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          >
            <option value="">All Groups</option>
            {groups.map(g => (
              <option key={g.id || g.groupName} value={g.groupName}>{g.groupName}</option>
            ))}
          </select>

          {/* Filter by Status */}
          <select
            className="form-control"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '115px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
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
        <div style={{ overflowX: 'auto', width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.775rem', minWidth: '1100px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '125px' }}>SKU</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '220px' }}>Product Name</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '110px' }}>Company</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, minWidth: '130px' }}>Group</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '75px' }}>HSN</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '55px' }}>Unit</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right', minWidth: '85px' }}>MRP</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'right', minWidth: '95px' }}>Sale Price</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '90px' }}>Stock Qty</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '80px' }}>Status</th>
                <th style={{ padding: '0.55rem 0.65rem', whiteSpace: 'nowrap', fontWeight: 700, textAlign: 'center', minWidth: '105px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    <RefreshCw size={20} className="spin" style={{ color: '#2563eb', marginBottom: '0.4rem' }} />
                    <div>Loading catalog...</div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                products.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(p => {
                  const isLowStock = p.actualStock <= (p.reorderLevel || 10);
                  const effectiveSalePrice = Number(p.salePrice || 0) > 0 ? Number(p.salePrice) : Number(p.mrp || 0);

                  return (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        whiteSpace: 'nowrap'
                      }}
                    >
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

                      {/* Product Name */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
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
                      </td>

                      {/* Company */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', fontWeight: 500, color: '#475569', fontSize: '0.765rem' }}>
                        {p.company}
                      </td>

                      {/* Group */}
                      <td style={{ padding: '0.55rem 0.65rem', verticalAlign: 'middle', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.765rem' }}>
                        {p.productGroup}
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
                            title="View Details"
                          >
                            <Eye size={14} />
                          </Link>

                          <Link
                            to={`/products/edit/${p.id}`}
                            className="action-btn action-btn-edit"
                            title="Edit Product"
                          >
                            <Edit size={14} />
                          </Link>

                          <button
                            type="button"
                            className="action-btn action-btn-toggle"
                            onClick={() => handleToggleStatus(p.id, p.productName, p.status)}
                            title={p.status === 'Active' ? 'Deactivate' : 'Activate'}
                          >
                            {p.status === 'Active' ? (
                              <ToggleRight size={16} style={{ color: '#16a34a' }} />
                            ) : (
                              <ToggleLeft size={16} style={{ color: '#94a3b8' }} />
                            )}
                          </button>

                          <button
                            type="button"
                            className="action-btn action-btn-delete"
                            onClick={() => handleDeleteProduct(p.id, p.productName)}
                            title="Delete Product"
                            style={{ color: '#dc2626' }}
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
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Delete Product"
        message={`Are you sure you want to permanently delete "${confirmState.name}"? This cannot be undone.`}
        confirmLabel="Delete Product"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, id: null, name: '' })}
        danger
      />
    </div>
  );
};

export default Products;
