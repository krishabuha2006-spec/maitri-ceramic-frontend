import React, { useState, useEffect } from 'react';
import { getPurchaseReturns, createPurchaseReturn, getSalesReturns, createSalesReturn } from '../services/returnService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { Plus, RotateCcw, ArrowLeft, Save, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

export const Returns = () => {
  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase' or 'sales'
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [salesReturns, setSalesReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    returnNoteNumber: `PRN-2026-00${Math.floor(Math.random() * 900) + 100}`,
    date: new Date().toISOString().split('T')[0],
    vendor: 'Kajaria Ceramics Ltd',
    customerName: 'Rajesh Sharma Construction',
    purchaseRef: 'PO-KJ-8821',
    invoiceNumber: 'INV-2026-001',
    challanNumber: 'CH-2026-001',
    sku: 'VT-60120-GL',
    productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
    quantity: 10,
    unit: 'Sq.Ft',
    returnReason: 'Quality inspection rejection / Damage',
    remarks: 'Approved by warehouse manager',
    status: 'Confirmed'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prRes, srRes] = await Promise.all([getPurchaseReturns(), getSalesReturns()]);
      setPurchaseReturns(prRes.data || []);
      setSalesReturns(srRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenForm = (tabType) => {
    setActiveTab(tabType);
    setFormError('');
    setFormData(prev => ({
      ...prev,
      returnNoteNumber: tabType === 'purchase' 
        ? `PRN-2026-00${Math.floor(Math.random() * 900) + 100}` 
        : `SRN-2026-00${Math.floor(Math.random() * 900) + 100}`
    }));
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.productName.trim() || !formData.sku.trim()) {
      setFormError('Please fill product SKU and product name.');
      return;
    }

    if (!formData.quantity || formData.quantity <= 0) {
      setFormError('Please enter a valid return quantity greater than zero.');
      return;
    }

    setSaving(true);
    try {
      if (activeTab === 'purchase') {
        await createPurchaseReturn(formData);
        setSuccessToast(`Purchase Return ${formData.returnNoteNumber} confirmed! Warehouse stock decreased.`);
      } else {
        await createSalesReturn(formData);
        setSuccessToast(`Sales Return ${formData.returnNoteNumber} confirmed! Warehouse stock increased.`);
      }
      setTimeout(() => {
        setShowForm(false);
        loadData();
      }, 900);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error recording return.');
    } finally {
      setSaving(false);
    }
  };

  if (showForm) {
    return (
      <div style={{ maxWidth: '1020px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
        {/* Toast Notification */}
        {successToast && (
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
            <span>{successToast}</span>
          </div>
        )}

        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowForm(false)}
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
            <span>Back to Returns</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {activeTab === 'purchase' ? 'Create Purchase Return (Vendor)' : 'Create Sales Return (Customer)'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              {activeTab === 'purchase' 
                ? 'Return damaged/rejected goods to vendor and auto-deduct warehouse physical stock.' 
                : 'Receive customer returned materials and auto-increase warehouse physical stock.'}
            </p>
          </div>
        </div>

        {formError && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1rem 1.25rem',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            color: '#991b1b',
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          {/* Card: Return Details */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            padding: '1.75rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              paddingBottom: '1rem',
              marginBottom: '1.5rem',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: activeTab === 'purchase' ? '#fef2f2' : '#f0fdf4',
                color: activeTab === 'purchase' ? '#dc2626' : '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  {activeTab === 'purchase' ? 'Purchase Return Details (Vendor Debit Note)' : 'Sales Return Details (Customer Credit Note)'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Enter return voucher number, party name, product SKU, returned quantity, and reason
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
              {/* Return Note Number */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Return Note Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.returnNoteNumber}
                  readOnly
                  style={{ height: '44px', borderRadius: '8px', backgroundColor: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
                />
              </div>

              {/* Return Date */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Return Date
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {activeTab === 'purchase' ? (
                <>
                  {/* Vendor Name */}
                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Vendor Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.vendor}
                      onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                      placeholder="e.g. Kajaria Ceramics Ltd"
                      required
                      style={{ height: '44px', borderRadius: '8px' }}
                    />
                  </div>

                  {/* Purchase Ref / PO */}
                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Purchase Ref / PO Number
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.purchaseRef}
                      onChange={(e) => setFormData({ ...formData, purchaseRef: e.target.value })}
                      placeholder="e.g. PO-KJ-8821"
                      style={{ height: '44px', borderRadius: '8px' }}
                    />
                  </div>
                </>
              ) : (
                <>
                  {/* Customer Name */}
                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Customer Name <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      placeholder="e.g. Rajesh Sharma Construction"
                      required
                      style={{ height: '44px', borderRadius: '8px' }}
                    />
                  </div>

                  {/* Invoice / Challan Number */}
                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Invoice / Delivery Challan Ref
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      placeholder="e.g. INV-2026-001 / CH-2026-001"
                      style={{ height: '44px', borderRadius: '8px' }}
                    />
                  </div>
                </>
              )}

              {/* Product SKU */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Product SKU <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g. VT-60120-GL"
                  required
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Product Name */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Product Description <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  placeholder="e.g. Glazed Vitrified Tile Statuario"
                  required
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Quantity Returned */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Quantity Returned <span style={{ color: '#dc2626' }}>*</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '0.5rem', color: activeTab === 'purchase' ? '#dc2626' : '#16a34a' }}>
                    ({activeTab === 'purchase' ? '- Stock Will Decrease' : '+ Stock Will Increase'})
                  </span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  required
                  placeholder="0"
                  style={{ height: '44px', borderRadius: '8px', fontWeight: 700 }}
                />
              </div>

              {/* Unit */}
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Unit
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g. Sq.Ft / Pcs / Boxes"
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Return Reason */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Return Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.returnReason}
                  onChange={(e) => setFormData({ ...formData, returnReason: e.target.value })}
                  placeholder="e.g. Quality inspection rejection / Corner breakage in transit"
                  required
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>

              {/* Remarks */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Warehouse Remarks / Notes
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Approved by warehouse manager for stock credit"
                  style={{ height: '44px', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            padding: '1.25rem 1.75rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.85rem'
          }}>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowForm(false)}
              style={{ borderRadius: '10px', height: '44px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                borderRadius: '10px',
                height: '44px',
                padding: '0 1.75rem',
                fontWeight: 700,
                fontSize: '0.9rem',
                backgroundColor: activeTab === 'purchase' ? '#2563eb' : '#16a34a',
                borderColor: activeTab === 'purchase' ? '#2563eb' : '#16a34a',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <RotateCcw size={18} />
                  <span>Confirm Return & Update Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Returns Management</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
            {activeTab === 'purchase' ? 'Purchase Return to Vendor (Stock Decreases)' : 'Sales Return from Customer (Stock Increases)'}
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          onClick={() => handleOpenForm(activeTab)}
          style={{ borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Plus size={16} />
          <span>Create {activeTab === 'purchase' ? 'Purchase Return' : 'Sales Return'}</span>
        </button>
      </div>

      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'purchase' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchase')}
        >
          Purchase Returns (To Vendor)
        </button>
        <button
          className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales Returns (From Customer)
        </button>
      </div>

      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto', backgroundColor: '#ffffff', width: '100%' }}>
        {activeTab === 'purchase' ? (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Return Note</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '100px' }}>Date</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '160px' }}>Vendor</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>Purchase Ref</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '200px' }}>Product Name</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '90px' }}>Qty</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', minWidth: '90px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading purchase returns...</td></tr>
              ) : purchaseReturns.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No purchase returns.</td></tr>
              ) : (
                purchaseReturns.map(r => (
                  <tr key={r.id || r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{r.returnNoteNumber}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDate(r.date)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.vendor}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{r.purchaseRef}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.sku}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#334155', whiteSpace: 'nowrap' }}>{r.productName}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#dc2626', textAlign: 'center', whiteSpace: 'nowrap' }}>{r.quantity} {r.unit}</td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Return Note</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '100px' }}>Date</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '160px' }}>Customer</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '140px' }}>Inv / Challan</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '200px' }}>Product Name</th>
                <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '90px' }}>Qty</th>
                <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', minWidth: '90px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading sales returns...</td></tr>
              ) : salesReturns.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No sales returns.</td></tr>
              ) : (
                salesReturns.map(r => (
                  <tr key={r.id || r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{r.returnNoteNumber}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>{formatDate(r.date)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>{r.customerName}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{r.invoiceNumber || r.challanNumber}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.sku}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#334155', whiteSpace: 'nowrap' }}>{r.productName}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#dc2626', textAlign: 'center', whiteSpace: 'nowrap' }}>{r.quantity} {r.unit}</td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Returns;
