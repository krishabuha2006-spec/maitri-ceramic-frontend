import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  getChallans, 
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
  AlertCircle 
} from 'lucide-react';

export const Challans = () => {
  const [challans, setChallans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'DRAFT', 'FINALIZED', 'CANCELLED'
  const [loading, setLoading] = useState(true);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadChallans = async () => {
    setLoading(true);
    try {
      const params = { search };
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }
      const res = await getChallans(params);
      setChallans(res.data || []);
    } catch (err) {
      console.error('Error loading challans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallans();
  }, [search, statusFilter]);

  const handleOpenPrintModal = async (challan) => {
    try {
      const printData = await getChallanPrintData(challan._id || challan.id);
      setSelectedChallan(printData || challan);
    } catch (e) {
      setSelectedChallan(challan);
    }
  };

  const handleFinalize = async (challan) => {
    if (!window.confirm(`Finalize delivery challan ${challan.challanNumber}? This will execute ATOMIC DUAL-WRITE stock deduction and lock the document.`)) {
      return;
    }
    const id = challan._id || challan.id;
    setActionLoadingId(id);
    try {
      await finalizeChallan(id);
      showToast(`Challan ${challan.challanNumber} finalized successfully! Physical stock deducted.`);
      loadChallans();
    } catch (err) {
      showToast(`Error finalizing challan: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancel = async (challan) => {
    if (!window.confirm(`Are you sure you want to cancel DRAFT challan ${challan.challanNumber}?`)) {
      return;
    }
    const id = challan._id || challan.id;
    setActionLoadingId(id);
    try {
      await cancelChallan(id);
      showToast(`Challan ${challan.challanNumber} cancelled.`);
      loadChallans();
    } catch (err) {
      showToast(`Error cancelling challan: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      await exportChallans(params);
      showToast('Delivery challans exported to Excel successfully!');
    } catch (e) {
      showToast('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

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
        (c.refQuotationNo && c.refQuotationNo.toLowerCase().includes(q))
      );
    });
  }, [challans, search, statusFilter]);

  return (
    <div style={{ fontFamily: 'var(--font-family)', paddingBottom: '2.5rem' }}>
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
          backgroundColor: '#16a34a',
          color: '#ffffff',
          padding: '1rem 1.5rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(22, 163, 74, 0.3)',
          fontWeight: 600
        }}>
          <CheckCircle2 size={22} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Delivery Challans Management</h1>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Module 9: Multi-challan dispatch, stock deduction dual-write, and delivery notes</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            disabled={exporting}
            style={{ borderRadius: '8px', padding: '0.5rem 0.95rem', fontWeight: 600, fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
          >
            <FileSpreadsheet size={15} style={{ color: '#16a34a' }} />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          <Link to="/challans/create" className="btn btn-primary" style={{ borderRadius: '8px', padding: '0.525rem 1.15rem', fontWeight: 700, fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Create Delivery Challan</span>
          </Link>
        </div>
      </div>

      {/* Tabs / Filters Header */}
      <div className="tabs-header" style={{ marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${statusFilter === 'ALL' ? 'active' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          All Challans ({challans.length})
        </button>
        <button
          className={`tab-btn ${statusFilter === 'DRAFT' ? 'active' : ''}`}
          onClick={() => setStatusFilter('DRAFT')}
        >
          Draft Dispatches ({challans.filter(c => (c.status || '').toUpperCase() === 'DRAFT').length})
        </button>
        <button
          className={`tab-btn ${statusFilter === 'FINALIZED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('FINALIZED')}
        >
          Finalized / Delivered ({challans.filter(c => (c.status || '').toUpperCase() === 'FINALIZED' || (c.status || '').toUpperCase() === 'DELIVERED').length})
        </button>
        <button
          className={`tab-btn ${statusFilter === 'CANCELLED' ? 'active' : ''}`}
          onClick={() => setStatusFilter('CANCELLED')}
        >
          Cancelled ({challans.filter(c => (c.status || '').toUpperCase() === 'CANCELLED').length})
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
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', width: '360px' }}>
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
      </div>

      {/* Challans Table */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto', backgroundColor: '#ffffff' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '980px', fontSize: '0.785rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Challan No.</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '100px' }}>Date</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '180px' }}>Customer Name</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Ref Quotation</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '220px' }}>Vehicle / Delivery Details</th>
              <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '90px' }}>Total Qty</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', minWidth: '110px' }}>Status</th>
              <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', minWidth: '160px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} className="spin-animation" style={{ color: '#2563eb' }} />
                    <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#475569' }}>Loading delivery challans...</span>
                  </div>
                </td>
              </tr>
            ) : filteredChallans.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No delivery challans found.</td></tr>
            ) : (
              filteredChallans.map(c => {
                const totalQty = c.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
                const isDraft = (c.status || '').toUpperCase() === 'DRAFT';
                const isActionRunning = actionLoadingId === (c._id || c.id);

                return (
                  <tr key={c.id || c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {c.challanNumber}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatDate(c.date)}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>
                      {c.customerName}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {c.refQuotationNo || 'N/A'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                      {c.deliveryDetails || c.vehicleNo || '-'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {totalQty}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={c.status} />
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        {isDraft && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleFinalize(c)}
                              disabled={isActionRunning}
                              title="Finalize Challan (Deducts Stock via Atomic Dual-Write)"
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.725rem',
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
                              <Check size={12} />
                              <span>Finalize</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(c)}
                              disabled={isActionRunning}
                              title="Cancel DRAFT Challan"
                              style={{
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.725rem',
                                fontWeight: 600,
                                borderRadius: '6px',
                                border: '1px solid #fecaca',
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                            >
                              <X size={12} />
                              <span>Cancel</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenPrintModal(c)}
                          title="View & Print Delivery Note"
                          style={{
                            padding: '0.25rem 0.55rem',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#f8fafc',
                            color: '#334155',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}
                        >
                          <Printer size={12} />
                          <span>Print</span>
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

      {/* Printable Delivery Note Modal */}
      {selectedChallan && (
        <Modal
          isOpen={Boolean(selectedChallan)}
          onClose={() => setSelectedChallan(null)}
          title={`Delivery Note: ${selectedChallan.challanNumber}`}
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
                  <strong>Challan No:</strong> {selectedChallan.challanNumber}<br />
                  <strong>Date:</strong> {formatDate(selectedChallan.date)}<br />
                  <strong>Ref Quotation:</strong> {selectedQuotationNo(selectedChallan)}
                </div>
              </div>
            </div>

            {/* Consignee & Transport Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem', fontSize: '0.825rem' }}>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Consignee / Deliver To:
                </div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>{selectedChallan.customerName}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem' }}>{selectedChallan.customerAddress || 'Direct Site Delivery'}</div>
                <div style={{ color: '#475569', marginTop: '0.2rem' }}><strong>Contact:</strong> {selectedChallan.customerContact || 'N/A'}</div>
              </div>

              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                  Transport & Dispatch Details:
                </div>
                <div style={{ color: '#334155' }}><strong>Vehicle / Driver:</strong> {selectedChallan.deliveryDetails || selectedChallan.vehicleNo || 'Self Pick / Transport'}</div>
                <div style={{ color: '#334155', marginTop: '0.2rem' }}><strong>Driver Contact:</strong> {selectedChallan.driverName || 'N/A'}</div>
                <div style={{ color: '#334155', marginTop: '0.2rem' }}><strong>Dispatch Status:</strong> {selectedChallan.status}</div>
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
                {selectedChallan.items?.map((item, idx) => (
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

function selectedQuotationNo(ch) {
  return ch.refQuotationNo || ch.quotationNumber || 'N/A';
}

export default Challans;
