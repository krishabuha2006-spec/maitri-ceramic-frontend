import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  getChallans, 
  getChallanById,
  updateChallan,
  finalizeChallan, 
  cancelChallan, 
  exportChallans, 
  getChallanPrintData 
} from '../services/challanService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { 
  Plus, 
  Search, 
  Eye, 
  Printer, 
  Truck, 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  Check, 
  CheckCircle2, 
  AlertCircle,
  Edit3,
  Save,
  Clock,
  ShieldCheck,
  FileCheck,
  Calendar,
  Building2,
  Package
} from 'lucide-react';

export const Challans = () => {
  const [challans, setChallans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'DRAFT', 'FINALIZED', 'CANCELLED'
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  // Modals
  const [printChallan, setPrintChallan] = useState(null);
  const [viewChallan, setViewChallan] = useState(null);
  const [editChallan, setEditChallan] = useState(null);
  const [editFormData, setEditFormData] = useState({ deliveryDetails: '', remarks: '', items: [] });
  const [savingEdit, setSavingEdit] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const loadChallans = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      if (search.trim()) {
        params.search = search.trim();
      }
      const res = await getChallans(params);
      setChallans(res.data || []);
    } catch (err) {
      console.error('Error loading challans:', err);
      showToast('Failed to fetch challans from server', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallans();
  }, [statusFilter]);

  // Open formatted print modal (GET /challans/{id}/print)
  const handleOpenPrintModal = async (challan) => {
    const id = challan._id || challan.id;
    try {
      const printData = await getChallanPrintData(id);
      setPrintChallan(printData || challan);
    } catch (e) {
      setPrintChallan(challan);
    }
  };

  // Open details view modal (GET /challans/{id})
  const handleOpenViewModal = async (challan) => {
    const id = challan._id || challan.id;
    try {
      const details = await getChallanById(id);
      setViewChallan(details || challan);
    } catch (e) {
      setViewChallan(challan);
    }
  };

  // Open edit modal for DRAFT challans (PUT /challans/{id})
  const handleOpenEditModal = (challan) => {
    setEditChallan(challan);
    setEditFormData({
      deliveryDetails: challan.deliveryDetails || '',
      remarks: challan.remarks || '',
      items: (challan.items || []).map(i => ({
        confirmedItemId: i.confirmedItemId || i._id,
        sku: i.sku,
        productName: i.productName,
        unit: i.unit,
        quantityToIssue: i.quantity || 0,
        remarks: i.remarks || ''
      }))
    });
  };

  const handleSaveEdit = async () => {
    if (!editChallan) return;
    const id = editChallan._id || editChallan.id;
    setSavingEdit(true);
    try {
      await updateChallan(id, editFormData);
      showToast(`DRAFT Challan ${editChallan.challanNumber} updated successfully.`);
      setEditChallan(null);
      loadChallans();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error updating challan', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Finalize Challan (PUT /challans/{id}/finalize)
  const handleFinalize = async (challan) => {
    if (!window.confirm(`Finalize Delivery Challan ${challan.challanNumber}?\n\nThis executes an ATOMIC DUAL-WRITE transaction:\n1. Deducts physical warehouse stock\n2. Locks challan to immutable FINALIZED status.`)) {
      return;
    }
    const id = challan._id || challan.id;
    setActionLoadingId(id);
    try {
      const res = await finalizeChallan(id);
      showToast(res.message || `Challan ${challan.challanNumber} finalized successfully! Physical stock deducted.`);
      loadChallans();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error finalizing challan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Cancel DRAFT Challan (PUT /challans/{id}/cancel)
  const handleCancel = async (challan) => {
    if (!window.confirm(`Are you sure you want to cancel DRAFT Challan ${challan.challanNumber}?`)) {
      return;
    }
    const id = challan._id || challan.id;
    setActionLoadingId(id);
    try {
      const res = await cancelChallan(id);
      showToast(res.message || `Challan ${challan.challanNumber} cancelled.`);
      loadChallans();
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Error cancelling challan', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Export Excel (GET /challans/export)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      await exportChallans(params);
      showToast('Delivery challans exported to Excel successfully!');
    } catch (e) {
      showToast('Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  // Instant client-side search filtering
  const filteredChallans = useMemo(() => {
    return challans.filter(c => {
      if (statusFilter !== 'ALL' && (c.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (c.challanNumber && c.challanNumber.toLowerCase().includes(q)) ||
        (c.customerName && c.customerName.toLowerCase().includes(q)) ||
        (c.deliveryDetails && c.deliveryDetails.toLowerCase().includes(q)) ||
        (c.refQuotationNo && c.refQuotationNo.toLowerCase().includes(q)) ||
        (c.driverName && c.driverName.toLowerCase().includes(q)) ||
        (c.vehicleNo && c.vehicleNo.toLowerCase().includes(q))
      );
    });
  }, [challans, search, statusFilter]);

  const counts = useMemo(() => {
    return {
      all: challans.length,
      draft: challans.filter(c => (c.status || '').toUpperCase() === 'DRAFT').length,
      finalized: challans.filter(c => (c.status || '').toUpperCase() === 'FINALIZED' || (c.status || '').toUpperCase() === 'DELIVERED').length,
      cancelled: challans.filter(c => (c.status || '').toUpperCase() === 'CANCELLED').length
    };
  }, [challans]);

  return (
    <div style={{ fontFamily: 'var(--font-family)', paddingBottom: '3rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          backgroundColor: toastType === 'error' ? '#ef4444' : '#16a34a',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          fontWeight: 600,
          fontSize: '0.9rem'
        }}>
          {toastType === 'error' ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span>Delivery Challans Management</span>
            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 700 }}>
              Module 9
            </span>
          </h1>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
            Multi-challan material dispatches, atomic dual-write stock deduction & printable delivery notes
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadChallans}
            disabled={loading}
            title="Reload from backend"
            style={{ borderRadius: '8px', padding: '0.525rem 0.75rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
          >
            <RefreshCw size={15} className={loading ? 'spin-animation' : ''} style={{ color: '#475569' }} />
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={exporting}
            style={{ borderRadius: '8px', padding: '0.525rem 0.95rem', fontWeight: 600, fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
          >
            <FileSpreadsheet size={15} style={{ color: '#16a34a' }} />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <Link 
            to="/challans/create" 
            className="btn btn-primary" 
            style={{ borderRadius: '8px', padding: '0.525rem 1.15rem', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Plus size={16} />
            <span>Create Delivery Challan</span>
          </Link>
        </div>
      </div>

      {/* Tabs / Filters Header */}
      <div className="tabs-header" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
        <button
          className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: statusFilter === 'ALL' ? '#2563eb' : '#f1f5f9',
            color: statusFilter === 'ALL' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          All Challans ({counts.all})
        </button>
        <button
          className={`tab-btn ${statusFilter === 'DRAFT' ? 'active' : ''}`}
          onClick={() => setStatusFilter('DRAFT')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: statusFilter === 'DRAFT' ? '#f59e0b' : '#f1f5f9',
            color: statusFilter === 'DRAFT' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          Draft Dispatches ({counts.draft})
        </button>
        <button
          className={`tab-btn ${statusFilter === 'FINALIZED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('FINALIZED')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: statusFilter === 'FINALIZED' ? '#16a34a' : '#f1f5f9',
            color: statusFilter === 'FINALIZED' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          Finalized / Delivered ({counts.finalized})
        </button>
        <button
          className={`tab-btn ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('CANCELLED')}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: 'none',
            background: statusFilter === 'CANCELLED' ? '#ef4444' : '#f1f5f9',
            color: statusFilter === 'CANCELLED' ? '#ffffff' : '#475569',
            fontWeight: 600,
            fontSize: '0.825rem',
            cursor: 'pointer'
          }}
        >
          Cancelled ({counts.cancelled})
        </button>
      </div>

      {/* Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '0.7rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem'
      }}>
        <div style={{ position: 'relative', width: '380px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search Challan No., Customer, Quotation or Vehicle..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '38px', fontSize: '0.85rem', borderRadius: '8px' }}
          />
        </div>

        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
          Showing <strong>{filteredChallans.length}</strong> {filteredChallans.length === 1 ? 'challan' : 'challans'}
        </div>
      </div>

      {/* Challans Table */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto', backgroundColor: '#ffffff' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1020px', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', minWidth: '140px' }}>Challan No.</th>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', minWidth: '105px' }}>Date</th>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', minWidth: '190px' }}>Customer Name</th>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Ref Quotation</th>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', minWidth: '220px' }}>Vehicle / Delivery Details</th>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '85px' }}>Items</th>
              <th style={{ padding: '0.75rem 0.85rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '95px' }}>Total Qty</th>
              <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', minWidth: '110px' }}>Status</th>
              <th style={{ padding: '0.75rem 0.85rem', textAlign: 'center', minWidth: '190px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={24} className="spin-animation" style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>Loading delivery challans from server...</span>
                  </div>
                </td>
              </tr>
            ) : filteredChallans.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <Truck size={32} style={{ color: '#94a3b8', opacity: 0.6 }} />
                    <p style={{ margin: 0, fontWeight: 600 }}>No delivery challans found</p>
                    <Link to="/challans/create" style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, textDecoration: 'underline' }}>
                      Create your first delivery challan
                    </Link>
                  </div>
                </td>
              </tr>
            ) : (
              filteredChallans.map(c => {
                const totalQty = c.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
                const isDraft = (c.status || '').toUpperCase() === 'DRAFT';
                const isActionRunning = actionLoadingId === (c._id || c.id);

                return (
                  <tr key={c.id || c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.825rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Truck size={14} style={{ color: isDraft ? '#f59e0b' : '#16a34a' }} />
                        <span>{c.challanNumber}</span>
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatDate(c.date)}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{c.customerName}</div>
                      {c.customerContact && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.customerContact}</div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {c.refQuotationNo || '—'}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.8rem', color: '#475569', maxWidth: '240px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.deliveryDetails || c.vehicleNo || 'Direct Transport'}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', color: '#475569', fontWeight: 600 }}>
                      {c.items?.length || 0}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, color: '#2563eb', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {totalQty}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={c.status} />
                      {c.invoiced && (
                        <span style={{ display: 'block', fontSize: '0.685rem', color: '#059669', fontWeight: 700, marginTop: '2px' }}>
                          ✓ Invoiced
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.85rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {/* View Details Modal button */}
                        <button
                          type="button"
                          onClick={() => handleOpenViewModal(c)}
                          title="View Challan Details"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </button>

                        {/* Print Delivery Note button */}
                        <button
                          type="button"
                          onClick={() => handleOpenPrintModal(c)}
                          title="Print Formatted Delivery Note"
                          style={{
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#0f172a',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.2rem'
                          }}
                        >
                          <Printer size={13} />
                          <span>Print</span>
                        </button>

                        {/* DRAFT Actions: Edit, Finalize, Cancel */}
                        {isDraft && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(c)}
                              title="Edit DRAFT Challan Details & Items"
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid #fed7aa',
                                backgroundColor: '#fffbeb',
                                color: '#b45309',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <Edit3 size={13} />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleFinalize(c)}
                              disabled={isActionRunning}
                              title="Finalize Challan (ATOMIC DUAL-WRITE: stock deduction + delivery recording)"
                              style={{
                                padding: '0.25rem 0.55rem',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                borderRadius: '6px',
                                border: '1px solid #bbf7d0',
                                backgroundColor: '#f0fdf4',
                                color: '#16a34a',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              {isActionRunning ? <RefreshCw size={13} className="spin-animation" /> : <ShieldCheck size={13} />}
                              <span>Finalize</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCancel(c)}
                              disabled={isActionRunning}
                              title="Cancel DRAFT Challan"
                              style={{
                                padding: '0.25rem 0.45rem',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.15rem'
                              }}
                            >
                              <X size={13} />
                              <span>Cancel</span>
                            </button>
                          </>
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

      {/* 1. Modal: View Challan Details */}
      {viewChallan && (
        <Modal
          isOpen={Boolean(viewChallan)}
          onClose={() => setViewChallan(null)}
          title={`Delivery Challan Details: ${viewChallan.challanNumber}`}
          size="lg"
        >
          <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
            {/* Header info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '1.25rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Challan Number</span>
                <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{viewChallan.challanNumber}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Dispatch Date</span>
                <strong>{formatDate(viewChallan.date)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Status</span>
                <div style={{ marginTop: '2px' }}><StatusBadge status={viewChallan.status} /></div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Ref Quotation</span>
                <strong style={{ color: '#2563eb' }}>{viewChallan.refQuotationNo || '—'}</strong>
              </div>
            </div>

            {/* Customer & Transport details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building2 size={16} style={{ color: '#2563eb' }} />
                  <span>Customer Destination</span>
                </h4>
                <div style={{ fontWeight: 700 }}>{viewChallan.customerName}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem' }}>{viewChallan.customerAddress || 'Direct site delivery'}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem' }}>Contact: {viewChallan.customerContact || 'N/A'}</div>
              </div>

              <div style={{ padding: '1rem', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Truck size={16} style={{ color: '#16a34a' }} />
                  <span>Logistics & Transporter</span>
                </h4>
                <div><strong>Delivery Details:</strong> {viewChallan.deliveryDetails || 'N/A'}</div>
                <div style={{ marginTop: '0.25rem' }}><strong>Salesperson:</strong> {viewChallan.salesperson}</div>
                {viewChallan.remarks && (
                  <div style={{ marginTop: '0.25rem', color: '#64748b' }}><strong>Remarks:</strong> {viewChallan.remarks}</div>
                )}
              </div>
            </div>

            {/* Items List */}
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Package size={16} style={{ color: '#d97706' }} />
              <span>Dispatched Items ({viewChallan.items?.length || 0})</span>
            </h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.25rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Product Description</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Quantity</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>Unit</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {viewChallan.items?.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.55rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>{item.sku}</td>
                      <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', fontWeight: 700, color: '#2563eb' }}>{item.quantity}</td>
                      <td style={{ padding: '0.55rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{item.unit}</td>
                      <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>{item.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Audit Status */}
            {viewChallan.finalizedAt && (
              <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', fontSize: '0.8rem', color: '#166534', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} />
                <span>
                  Finalized & physical stock deducted on <strong>{formatDate(viewChallan.finalizedAt)}</strong> by {viewChallan.finalizedBy || 'System'}.
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* 2. Modal: Edit DRAFT Challan */}
      {editChallan && (
        <Modal
          isOpen={Boolean(editChallan)}
          onClose={() => setEditChallan(null)}
          title={`Edit DRAFT Delivery Challan: ${editChallan.challanNumber}`}
          size="lg"
        >
          <div style={{ fontSize: '0.85rem' }}>
            <p style={{ color: '#64748b', margin: '0 0 1rem 0' }}>
              Edits are strictly allowed while the Challan status is <strong>DRAFT</strong>.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Delivery Details / Vehicle Info
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.deliveryDetails}
                  onChange={(e) => setEditFormData({ ...editFormData, deliveryDetails: e.target.value })}
                  placeholder="Driver, vehicle, and site instructions"
                  style={{ height: '38px', borderRadius: '6px' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Remarks
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={editFormData.remarks}
                  onChange={(e) => setEditFormData({ ...editFormData, remarks: e.target.value })}
                  placeholder="Dispatch remarks"
                  style={{ height: '38px', borderRadius: '6px' }}
                />
              </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>
              Items to Dispatch
            </h4>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Product Name</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'center', width: '120px' }}>Qty to Issue</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Item Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {editFormData.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>{item.sku}</td>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{item.productName}</td>
                      <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          value={item.quantityToIssue}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].quantityToIssue = Number(e.target.value);
                            setEditFormData({ ...editFormData, items: newItems });
                          }}
                          style={{ height: '32px', textAlign: 'center', fontWeight: 700, borderRadius: '6px' }}
                        />
                      </td>
                      <td style={{ padding: '0.5rem 0.75rem' }}>
                        <input
                          type="text"
                          className="form-control"
                          value={item.remarks}
                          onChange={(e) => {
                            const newItems = [...editFormData.items];
                            newItems[idx].remarks = e.target.value;
                            setEditFormData({ ...editFormData, items: newItems });
                          }}
                          style={{ height: '32px', borderRadius: '6px' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditChallan(null)}
                style={{ borderRadius: '6px', padding: '0.5rem 1rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                style={{ borderRadius: '6px', padding: '0.5rem 1.25rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                {savingEdit ? <RefreshCw size={15} className="spin-animation" /> : <Save size={15} />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3. Modal: Formatted Printable Delivery Note (GET /challans/{id}/print) */}
      {printChallan && (
        <Modal
          isOpen={Boolean(printChallan)}
          onClose={() => setPrintChallan(null)}
          title={`Delivery Note: ${printChallan.challanNumber}`}
          size="lg"
        >
          <div className="printable-document" style={{ padding: '0.5rem', color: '#0f172a' }}>
            {/* Action Bar */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={triggerPrint}
                style={{
                  height: '36px',
                  padding: '0 1rem',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)'
                }}
              >
                <Printer size={15} />
                <span>Print Document</span>
              </button>
            </div>

            {/* Document Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: 0, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  Maitri Ceramic
                </h1>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: '#475569', lineHeight: 1.4 }}>
                  Premium Vitrified Tiles & Designer Sanitaryware<br />
                  88-90, Royal Arcade, SG Highway, Ahmedabad - 380054<br />
                  Phone: +91 98250 12345 | GSTIN: 24AAECM1234F1Z8
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ display: 'inline-block', backgroundColor: '#0f172a', color: '#ffffff', padding: '0.25rem 0.75rem', fontWeight: 800, fontSize: '0.875rem', borderRadius: '4px', letterSpacing: '0.05em' }}>
                  DELIVERY CHALLAN
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.825rem', color: '#334155' }}>
                  <strong>Challan No:</strong> {printChallan.challanNumber}<br />
                  <strong>Date:</strong> {formatDate(printChallan.challanDate || printChallan.date)}<br />
                  <strong>Ref Quotation:</strong> {printChallan.refQuotationNo || printChallan.quotationNumber || 'N/A'}<br />
                  <strong>Status:</strong> {printChallan.status}
                </div>
              </div>
            </div>

            {/* Consignee & Transport Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem', fontSize: '0.825rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Consignee / Deliver To:
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{printChallan.customerName}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem' }}>{printChallan.customerAddress || 'Direct Site Delivery'}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem' }}><strong>Contact:</strong> {printChallan.customerContact || 'N/A'}</div>
                {printChallan.customerGst && printChallan.customerGst !== 'N/A' && (
                  <div style={{ color: '#475569', marginTop: '0.2rem' }}><strong>GSTIN:</strong> {printChallan.customerGst}</div>
                )}
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Transport & Dispatch Details:
                </div>
                <div style={{ color: '#334155' }}>
                  <strong>Vehicle / Driver:</strong> {printChallan.deliveryDetails || 'Self Pick / Direct Transport'}
                </div>
                <div style={{ color: '#334155', marginTop: '0.2rem' }}>
                  <strong>Salesperson:</strong> {printChallan.salesperson || 'Maitri Ceramic'}
                </div>
                {printChallan.remarks && (
                  <div style={{ color: '#334155', marginTop: '0.2rem' }}>
                    <strong>Remarks:</strong> {printChallan.remarks}
                  </div>
                )}
              </div>
            </div>

            {/* Items Table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ padding: '0.5rem', textAlign: 'center', width: '8%', fontWeight: 800, color: '#0f172a' }}>#</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', width: '22%', fontWeight: 800, color: '#0f172a' }}>SKU Code</th>
                  <th style={{ padding: '0.5rem', textAlign: 'left', width: '45%', fontWeight: 800, color: '#0f172a' }}>Description of Goods</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', width: '15%', fontWeight: 800, color: '#0f172a' }}>Dispatched Qty</th>
                  <th style={{ padding: '0.5rem', textAlign: 'center', width: '10%', fontWeight: 800, color: '#0f172a' }}>Unit</th>
                </tr>
              </thead>
              <tbody>
                {printChallan.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                    <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>{item.sku}</td>
                    <td style={{ padding: '0.6rem 0.5rem', color: '#1e293b' }}>
                      <div style={{ fontWeight: 600 }}>{item.productName}</div>
                      {item.description && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.description}</div>}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', fontWeight: 800, fontSize: '0.875rem', color: '#0f172a' }}>
                      {item.quantity}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', color: '#475569' }}>{item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signature Block */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginTop: '2.5rem', textAlign: 'center', fontSize: '0.8rem' }}>
              <div>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.35rem', color: '#475569', fontWeight: 600 }}>
                  Prepared / Checked By
                </div>
              </div>
              <div>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.35rem', color: '#475569', fontWeight: 600 }}>
                  Driver / Transporter Signature
                </div>
              </div>
              <div>
                <div style={{ height: '50px' }}></div>
                <div style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.35rem', color: '#475569', fontWeight: 600 }}>
                  Receiver's Stamp & Signature
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Challans;
