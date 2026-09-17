import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  getCustomers, 
  deleteCustomer, 
  deactivateCustomer, 
  reactivateCustomer, 
  exportCustomerList 
} from '../services/customerService';
import { formatCurrency } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Pagination from '../components/Pagination';
import ConfirmModal from '../components/ConfirmModal';
import { 
  Plus, Search, Eye, Edit, Trash2, ToggleLeft, ToggleRight, 
  Download, RefreshCw, CheckCircle2, Users, IndianRupee, AlertCircle, X 
} from 'lucide-react';
import { usePermissions } from '../utils/permissions';

export const Customers = () => {
  const { canCreate, canEdit, canDelete } = usePermissions('customers');
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [successToast, setSuccessToast] = useState('');
  const [exporting, setExporting] = useState(false);

  // Confirm modal state
  const [confirmState, setConfirmState] = useState({ isOpen: false, id: null, name: '' });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await getCustomers({ search, customerType: typeFilter, status: statusFilter });
      setCustomers(res.data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadCustomers();
  }, [search, typeFilter, statusFilter]);

  const handleDelete = async (id, name) => {
    setConfirmState({ isOpen: true, id, name });
  };

  const handleConfirmDelete = async () => {
    const { id, name } = confirmState;
    setConfirmState({ isOpen: false, id: null, name: '' });
    try {
      await deleteCustomer(id);
      setCustomers(prev => prev.filter(c => String(c.id) !== String(id)));
      setSuccessToast(`Customer "${name}" deleted successfully.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error('Delete customer error:', err);
    }
  };

  const handleToggleStatus = async (id, name, currentIsActive) => {
    try {
      if (currentIsActive) {
        await deactivateCustomer(id);
      } else {
        await reactivateCustomer(id);
      }
      const newStatus = currentIsActive ? 'Inactive' : 'Active';
      setCustomers(prev => prev.map(c => String(c.id) === String(id) ? { ...c, isActive: !currentIsActive, status: newStatus } : c));
      setSuccessToast(`Customer "${name}" status set to ${newStatus}.`);
      setTimeout(() => setSuccessToast(''), 3000);
    } catch (err) {
      console.error('Toggle customer status error:', err);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportCustomerList({ search, customerType: typeFilter, status: statusFilter });
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Customers_Export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setSuccessToast('Customer directory exported successfully.');
        setTimeout(() => setSuccessToast(''), 3000);
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  };

  // Summary Metrics
  const totalCustomers = customers.length;
  const totalOutstandingSum = customers.reduce((sum, c) => sum + Number(c.totalOutstanding || 0), 0);
  const totalSalesSum = customers.reduce((sum, c) => sum + Number(c.totalSales || 0), 0);
  const activeCount = customers.filter(c => c.isActive !== false).length;

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
            <Users size={24} style={{ color: '#2563eb' }} />
            Customer Directory
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Customer Profiles, 360° Journey History & Financial Outstandings
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
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
            <Download size={15} />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          {canCreate && (
            <Link
              to="/customers/new"
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
              <span>Add Customer</span>
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.25rem'
      }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#eff6ff', padding: '0.6rem', borderRadius: '8px', color: '#2563eb' }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Customers</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>{totalCustomers}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#f0fdf4', padding: '0.6rem', borderRadius: '8px', color: '#16a34a' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Active Profiles</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a' }}>{activeCount}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#fdf2f8', padding: '0.6rem', borderRadius: '8px', color: '#db2777' }}>
            <IndianRupee size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Sales Volume</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{formatCurrency(totalSalesSum)}</div>
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ backgroundColor: '#fef2f2', padding: '0.6rem', borderRadius: '8px', color: '#dc2626' }}>
            <AlertCircle size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Outstanding</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>{formatCurrency(totalOutstandingSum)}</div>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="table-container">
        {/* Filter Bar */}
        <div className="table-header-bar" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px', flex: 1, maxWidth: '360px' }}>
            <Search size={16} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by Name, Mobile, City, GST..."
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
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{ width: '160px', height: '38px', borderRadius: '8px', fontSize: '0.825rem' }}
          >
            <option value="">All Types</option>
            <option value="RETAIL">Retail</option>
            <option value="CONTRACTOR">Contractor</option>
            <option value="BUILDER">Builder</option>
            <option value="ARCHITECT">Architect</option>
            <option value="WHOLESALER">Wholesaler</option>
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

        {/* Data Table */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Customer Name</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Type</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>Mobile</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>City / State</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700 }}>GST Number</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Total Sales</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'right' }}>Outstanding</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'center' }}>Status</th>
                <th style={{ padding: '0.65rem 0.85rem', fontWeight: 700, textAlign: 'center', width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                    No customers found matching search filters.
                  </td>
                </tr>
              ) : (
                customers
                  .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                  .map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', fontWeight: 700, color: '#0f172a' }}>
                      <Link to={`/customers/${c.id}`} style={{ textDecoration: 'none', color: '#0f172a' }}>
                        {c.name}
                      </Link>
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle' }}>
                      <span style={{
                        fontSize: '0.725rem',
                        fontWeight: 600,
                        backgroundColor: '#f1f5f9',
                        color: '#475569',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1'
                      }}>
                        {c.customerType || 'RETAIL'}
                      </span>
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', color: '#334155', fontWeight: 500 }}>
                      {c.mobile}
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', color: '#64748b' }}>
                      {c.city}, {c.state}
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', fontFamily: 'monospace', color: '#64748b', fontSize: '0.75rem' }}>
                      {c.gstNumber || '-'}
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', textAlign: 'right', fontWeight: 600, color: '#334155' }}>
                      {formatCurrency(c.totalSales)}
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, color: c.totalOutstanding > 0 ? '#dc2626' : '#16a34a' }}>
                      {formatCurrency(c.totalOutstanding)}
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      <StatusBadge status={c.status} />
                    </td>

                    <td style={{ padding: '0.65rem 0.85rem', verticalAlign: 'middle', textAlign: 'center' }}>
                      <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                        <Link 
                          to={`/customers/${c.id}`} 
                          className="action-btn action-btn-view" 
                          title="View 360° Journey History"
                        >
                          <Eye size={14} />
                        </Link>

                        {canEdit && (
                          <Link 
                            to={`/customers/edit/${c.id}`} 
                            className="action-btn action-btn-edit" 
                            title="Edit Customer Profile"
                          >
                            <Edit size={14} />
                          </Link>
                        )}

                        {canEdit && (
                          <button
                            type="button"
                            className="action-btn action-btn-toggle"
                            onClick={() => handleToggleStatus(c.id, c.name, c.isActive !== false)}
                            title={c.isActive !== false ? 'Deactivate' : 'Activate'}
                          >
                            {c.isActive !== false ? (
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
                            onClick={() => handleDelete(c.id, c.name)}
                            title="Delete Customer"
                            style={{ color: '#dc2626' }}
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

        {/* Pagination Controls */}
        <Pagination
          currentPage={currentPage}
          totalItems={customers.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title="Delete Customer"
        message={`Are you sure you want to permanently delete "${confirmState.name}"? This action cannot be undone.`}
        confirmLabel="Delete Customer"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState({ isOpen: false, id: null, name: '' })}
        danger
      />
    </div>
  );
};

export default Customers;
