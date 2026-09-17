import React, { useState, useEffect, useMemo } from 'react';
import { 
  getReturns, 
  createPurchaseReturn, 
  createSalesReturn, 
  confirmReturn, 
  cancelReturn, 
  exportReturns 
} from '../services/returnService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  RotateCcw, 
  ArrowLeft, 
  Search, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Check, 
  X,
  FileText
} from 'lucide-react';

export const Returns = () => {
  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase' or 'sales'
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const [formData, setFormData] = useState({
    returnNoteNumber: '',
    date: new Date().toISOString().split('T')[0],
    vendor: '',
    customerName: '',
    purchaseRef: '',
    invoiceNumber: '',
    challanNumber: '',
    sku: '',
    productName: '',
    quantity: 1,
    unit: 'Sq.Ft',
    returnReason: 'Quality inspection rejection / Damage',
    remarks: 'Approved by warehouse manager'
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const typeParam = activeTab === 'purchase' ? 'PURCHASE_RETURN' : 'SALES_RETURN';
      const res = await getReturns({ returnType: typeParam, search: searchQuery });
      setReturnsList(res.data || []);
    } catch (err) {
      console.error('Error loading returns:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const filteredReturns = useMemo(() => {
    if (!searchQuery.trim()) return returnsList;
    const q = searchQuery.toLowerCase();
    return returnsList.filter(r => 
      (r.returnNoteNumber || '').toLowerCase().includes(q) ||
      (r.vendor || '').toLowerCase().includes(q) ||
      (r.customerName || '').toLowerCase().includes(q) ||
      (r.sku || '').toLowerCase().includes(q) ||
      (r.productName || '').toLowerCase().includes(q) ||
      (r.purchaseRef || '').toLowerCase().includes(q) ||
      (r.invoiceNumber || '').toLowerCase().includes(q)
    );
  }, [returnsList, searchQuery]);

  const handleOpenForm = (tabType) => {
    setActiveTab(tabType);
    setFormError('');
    const randomNum = Math.floor(Math.random() * 900) + 100;
    setFormData({
      returnNoteNumber: tabType === 'purchase' ? `PRN-2026-${randomNum}` : `SRN-2026-${randomNum}`,
      date: new Date().toISOString().split('T')[0],
      vendor: tabType === 'purchase' ? 'Kajaria Ceramics Ltd' : '',
      customerName: tabType === 'sales' ? 'Rajesh Sharma Construction' : '',
      purchaseRef: tabType === 'purchase' ? 'PO-KJ-8821' : '',
      invoiceNumber: tabType === 'sales' ? 'INV-2026-001' : '',
      challanNumber: tabType === 'sales' ? 'CH-2026-001' : '',
      sku: 'VT-60120-GL',
      productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
      quantity: 10,
      unit: 'Sq.Ft',
      returnReason: 'Quality inspection rejection / Damage',
      remarks: 'Approved by warehouse manager'
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.productName.trim() || !formData.sku.trim()) {
      setFormError('Please fill in product SKU and product name.');
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
        showToast(`Purchase Return ${formData.returnNoteNumber} recorded successfully!`);
      } else {
        await createSalesReturn(formData);
        showToast(`Sales Return ${formData.returnNoteNumber} recorded successfully!`);
      }
      setShowForm(false);
      loadData();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error recording return.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (item) => {
    const id = item.id || item._id;
    try {
      await confirmReturn(id);
      showToast(`Return ${item.returnNoteNumber} confirmed! Physical stock updated.`);
      loadData();
    } catch (err) {
      showToast(`Error confirming return: ${err.message}`);
    }
  };

  const handleCancel = async (item) => {
    if (!window.confirm(`Are you sure you want to cancel return ${item.returnNoteNumber}?`)) return;
    const id = item.id || item._id;
    try {
      await cancelReturn(id, 'Cancelled by user');
      showToast(`Return ${item.returnNoteNumber} cancelled.`);
      loadData();
    } catch (err) {
      showToast(`Error cancelling return: ${err.message}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const typeParam = activeTab === 'purchase' ? 'PURCHASE_RETURN' : 'SALES_RETURN';
      const blob = await exportReturns({ returnType: typeParam });
      if (blob && blob.size > 0) {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeTab}_returns_${new Date().toISOString().split('T')[0]}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);
        showToast('Returns exported successfully!');
        return;
      }
    } catch (e) {
      console.warn('Backend export blob failed, generating local XLSX');
    }

    // Client-side XLSX generation
    const exportData = filteredReturns.map(r => ({
      'Return Note': r.returnNoteNumber,
      'Date': formatDate(r.date || r.returnDate),
      'Party Name': activeTab === 'purchase' ? (r.vendor || '-') : (r.customerName || '-'),
      'Reference Doc': activeTab === 'purchase' ? (r.purchaseRef || '-') : (r.invoiceNumber || r.challanNumber || '-'),
      'SKU': r.sku,
      'Product Description': r.productName,
      'Quantity': r.quantity,
      'Unit': r.unit || 'Sq.Ft',
      'Reason': r.returnReason || '-',
      'Status': r.status || 'CONFIRMED'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab === 'purchase' ? 'Purchase Returns' : 'Sales Returns');
    XLSX.writeFile(wb, `${activeTab}_returns_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast('Returns exported to Excel successfully!');
  };

  if (showForm) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3rem' }}>
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
              borderRadius: '8px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.875rem'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Returns</span>
          </button>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              {activeTab === 'purchase' ? 'Create Purchase Return (Vendor Debit Note)' : 'Create Sales Return (Customer Credit Note)'}
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
              {activeTab === 'purchase' 
                ? 'Return damaged or surplus items to vendor and deduct physical stock.' 
                : 'Accept returned items from customer and re-add to warehouse stock.'}
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
            borderRadius: '10px',
            color: '#991b1b',
            fontSize: '0.9rem',
            marginBottom: '1.5rem'
          }}>
            <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
            <div>{formError}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
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
                  {activeTab === 'purchase' ? 'Purchase Return Details' : 'Sales Return Details'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Fill in return note number, party details, SKU, returned quantity, and reason
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Return Note Number
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.returnNoteNumber}
                  onChange={(e) => setFormData({ ...formData, returnNoteNumber: e.target.value })}
                  style={{ height: '42px', borderRadius: '8px', fontWeight: 700 }}
                  required
                />
              </div>

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
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {activeTab === 'purchase' ? (
                <>
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
                      style={{ height: '42px', borderRadius: '8px' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Purchase Order / Ref
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.purchaseRef}
                      onChange={(e) => setFormData({ ...formData, purchaseRef: e.target.value })}
                      placeholder="e.g. PO-KJ-8821"
                      style={{ height: '42px', borderRadius: '8px' }}
                    />
                  </div>
                </>
              ) : (
                <>
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
                      style={{ height: '42px', borderRadius: '8px' }}
                    />
                  </div>

                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Invoice / Challan Reference
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      placeholder="e.g. INV-2026-001"
                      style={{ height: '42px', borderRadius: '8px' }}
                    />
                  </div>
                </>
              )}

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
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

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
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Quantity Returned <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  required
                  min="1"
                  style={{ height: '42px', borderRadius: '8px', fontWeight: 700 }}
                />
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Unit
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  placeholder="e.g. Sq.Ft / Boxes"
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Return Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.returnReason}
                  onChange={(e) => setFormData({ ...formData, returnReason: e.target.value })}
                  placeholder="e.g. Broken tiles / Excess stock from construction site"
                  required
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Warehouse Remarks
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="e.g. Approved and inspected"
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={() => setShowForm(false)}
              style={{ borderRadius: '8px', height: '42px', padding: '0 1.25rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{
                borderRadius: '8px',
                height: '42px',
                padding: '0 1.5rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={16} className="spin-animation" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Save Return Note</span>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Return Notes Management</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
            {activeTab === 'purchase' ? 'Purchase Returns to Vendors (Deducts Stock)' : 'Sales Returns from Customers (Restocks Warehouse)'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button"
            className="btn btn-secondary"
            onClick={handleExportExcel}
            style={{
              height: '38px',
              padding: '0 1rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderColor: '#cbd5e1'
            }}
          >
            <Download size={15} />
            <span>Export Excel</span>
          </button>
          <button 
            type="button"
            className="btn btn-primary" 
            onClick={() => handleOpenForm(activeTab)}
            style={{
              height: '38px',
              padding: '0 1.1rem',
              fontSize: '0.825rem',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)'
            }}
          >
            <Plus size={16} />
            <span>Create {activeTab === 'purchase' ? 'Purchase Return' : 'Sales Return'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-header" style={{ marginBottom: '1rem' }}>
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

      {/* Search Bar */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search return note, party, SKU..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto', backgroundColor: '#ffffff' }}>
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Return Note</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '100px' }}>Date</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '160px' }}>{activeTab === 'purchase' ? 'Vendor' : 'Customer'}</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>{activeTab === 'purchase' ? 'PO Ref' : 'Invoice / Challan'}</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '200px' }}>Product Description</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '90px' }}>Qty</th>
              <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', minWidth: '100px' }}>Status</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', minWidth: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>Loading return records...</td></tr>
            ) : filteredReturns.length === 0 ? (
              <tr><td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No return records found.</td></tr>
            ) : (
              filteredReturns.map(r => {
                const isDraft = (r.status || '').toUpperCase() === 'DRAFT';
                return (
                  <tr key={r.id || r._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                      {r.returnNoteNumber}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {formatDate(r.date || r.returnDate)}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                      {activeTab === 'purchase' ? (r.vendor || '-') : (r.customerName || '-')}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {activeTab === 'purchase' ? (r.purchaseRef || '-') : (r.invoiceNumber || r.challanNumber || '-')}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.sku}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#334155', whiteSpace: 'nowrap' }}>
                      {r.productName}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#dc2626', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {r.quantity} {r.unit || 'Sq.Ft'}
                    </td>
                    <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <StatusBadge status={r.status || 'CONFIRMED'} />
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {isDraft ? (
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleConfirm(r)}
                            title="Confirm return & apply stock movement"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
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
                            <span>Confirm</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancel(r)}
                            title="Cancel return"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
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
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>Completed</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Returns;
