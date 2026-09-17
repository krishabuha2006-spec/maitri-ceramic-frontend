import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  getQuotationById, 
  confirmQuotation, 
  approveConfirmation, 
  sendQuotation, 
  cancelQuotation, 
  renderQuotationFormat, 
  exportQuotationDocument 
} from '../services/quotationService';
import { getProducts } from '../services/productService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { 
  ArrowLeft, CheckCircle2, FileText, Printer, Plus, Trash2, ShieldCheck, 
  Download, LayoutTemplate, Send, XCircle, FileSpreadsheet, RefreshCw 
} from 'lucide-react';

export const QuotationDetails = () => {
  const { id } = useParams();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState([]);

  // Active Presentation Format Layout (Module 5 Spec: 8 Formats)
  const [selectedFormat, setSelectedFormat] = useState('STANDARD');
  const [actionLoading, setActionLoading] = useState(false);

  // Confirmation Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmationItems, setConfirmationItems] = useState([]);
  const [extraItems, setExtraItems] = useState([]);
  const [confirmationRemarks, setConfirmationRemarks] = useState('');

  const FORMAT_OPTIONS = [
    { key: 'STANDARD', label: '1. Standard Customer Quotation (STANDARD)' },
    { key: 'WITH_GST', label: '2. Quotation With GST Breakdown (WITH_GST)' },
    { key: 'DISCOUNT', label: '3. Discounted Quotation (DISCOUNT)' },
    { key: 'MRP', label: '4. MRP Quotation (MRP)' },
    { key: 'PLUMBER', label: '5. Plumber Quotation (PLUMBER)' },
    { key: 'DETAILED', label: '6. Detailed Breakdown Quotation (DETAILED)' },
    { key: 'PENDING', label: '7. Pending Items Quotation (PENDING)' },
    { key: 'WITHOUT_SKU', label: '8. Quotation Without SKU Code (WITHOUT_SKU)' }
  ];

  useEffect(() => {
    loadData();
    fetchCatalogProducts();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const qt = await getQuotationById(id);
      setQuotation(qt);
      if (qt.items) {
        setConfirmationItems(qt.items.map(item => ({
          ...item,
          quotedQty: item.quantity,
          confirmedQty: item.confirmedQty ?? item.quantity,
          extraQty: item.extraQty ?? 0,
          deliveredQty: item.deliveredQty ?? 0,
          pendingDeliveryQty: Math.max(0, ((item.confirmedQty ?? item.quantity) + (item.extraQty ?? 0)) - (item.deliveredQty ?? 0))
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogProducts = async () => {
    try {
      const res = await getProducts();
      setProductsList(res.data || []);
    } catch (err) {
      console.error('Failed to load catalog products', err);
    }
  };

  const handleQtyChange = (index, field, val) => {
    const updated = [...confirmationItems];
    updated[index][field] = Number(val);
    const totalCommitted = Number(updated[index].confirmedQty || 0) + Number(updated[index].extraQty || 0);
    const delivered = Number(updated[index].deliveredQty || 0);
    updated[index].pendingDeliveryQty = Math.max(0, totalCommitted - delivered);
    setConfirmationItems(updated);
  };

  const addExtraItemRow = () => {
    setExtraItems(prev => [
      ...prev,
      { productId: '', adHocName: '', adHocMrp: 0, quantity: 1, remarks: '' }
    ]);
  };

  const removeExtraItemRow = (idx) => {
    setExtraItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleExtraItemChange = (idx, field, val) => {
    const updated = [...extraItems];
    updated[idx][field] = val;
    setExtraItems(updated);
  };

  const handleConfirmSubmit = async () => {
    const confirmedTotal = confirmationItems.reduce((sum, item) => {
      const totalQty = Number(item.confirmedQty || 0) + Number(item.extraQty || 0);
      const net = (item.rate * totalQty) * (1 - (item.discountPercent || 0) / 100);
      return sum + net;
    }, 0);

    const extraTotal = extraItems.reduce((sum, item) => {
      const price = Number(item.adHocMrp || 0);
      return sum + (price * Number(item.quantity || 1));
    }, 0);

    try {
      await confirmQuotation(id, {
        finalConfirmedAmount: confirmedTotal + extraTotal,
        items: confirmationItems,
        extraItems,
        remarks: confirmationRemarks
      });
      setIsConfirmModalOpen(false);
      loadData();
    } catch (err) {
      alert('Error confirming quotation: ' + err.message);
    }
  };

  const handleApproveConfirmation = async () => {
    try {
      await approveConfirmation(quotation.confirmationId || id);
      alert('Quotation confirmation approved by manager successfully.');
      loadData();
    } catch (err) {
      alert('Error approving confirmation: ' + err.message);
    }
  };

  const handleSendQuotation = async () => {
    if (!window.confirm(`Mark quotation #${quotation.quotationNumber} as SENT to customer?`)) return;
    setActionLoading(true);
    try {
      await sendQuotation(id);
      await loadData();
    } catch (err) {
      alert('Failed to mark as sent: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelQuotation = async () => {
    if (!window.confirm(`Are you sure you want to cancel quotation #${quotation.quotationNumber}?`)) return;
    setActionLoading(true);
    try {
      await cancelQuotation(id);
      await loadData();
    } catch (err) {
      alert('Failed to cancel quotation: ' + (err.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      await exportQuotationDocument(id, format, quotation.quotationNumber);
    } catch (err) {
      alert(`Export as ${format.toUpperCase()} failed: ` + (err.message || 'Error'));
    }
  };

  const handleFormatSelect = async (formatKey) => {
    setSelectedFormat(formatKey);
    try {
      await renderQuotationFormat(id, formatKey);
    } catch (err) {}
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="spinner-circle" />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Loading quotation details...</div>
      </div>
    );
  }
  if (!quotation) return <div style={{ padding: '2rem', color: '#dc2626' }}>Quotation not found.</div>;

  // Financial Calculations
  const originalQuotationAmount = quotation.quotationAmount || 0;
  const confirmedAmount = quotation.items?.reduce((sum, i) => sum + ((i.confirmedQty ?? i.quantity) * (i.rate || i.mrp || 0)), 0) || originalQuotationAmount;
  const extraProductAmount = quotation.items?.reduce((sum, i) => sum + ((i.extraQty || 0) * (i.rate || i.mrp || 0)), 0) || 0;
  const differenceAmount = originalQuotationAmount - confirmedAmount;
  const totalActualAmount = confirmedAmount + extraProductAmount;

  return (
    <div style={{ maxWidth: '1050px' }}>
      
      {/* Top Action Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <Link to="/quotations" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back to Quotation Directory</span>
        </Link>
        
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Send to customer */}
          {quotation.status === 'Draft' && (
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={handleSendQuotation}
              disabled={actionLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#0284c7', borderColor: '#0284c7' }}
            >
              <Send size={15} /> Mark as Sent
            </button>
          )}

          {/* Export PDF */}
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleExport('pdf')}
            title="Download PDF"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Download size={15} /> PDF
          </button>

          {/* Export Excel */}
          <button 
            type="button" 
            className="btn btn-secondary btn-sm" 
            onClick={() => handleExport('xlsx')}
            title="Download Excel Spreadsheet"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileSpreadsheet size={15} /> Excel
          </button>

          {/* Print */}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Printer size={15} /> Print
          </button>

          {/* Approve confirmation */}
          {quotation.pendingApproval && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleApproveConfirmation} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
              <ShieldCheck size={16} /> Approve Confirmation
            </button>
          )}

          {/* Confirm */}
          {quotation.status !== 'Confirmed' && quotation.status !== 'Cancelled' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsConfirmModalOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle2 size={15} /> Confirm Items
            </button>
          )}

          {/* Cancel Quotation */}
          {quotation.status !== 'Cancelled' && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={handleCancelQuotation}
              disabled={actionLoading}
              title="Cancel Quotation"
              style={{ color: '#dc2626', borderColor: '#fecaca', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <XCircle size={15} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Header Info Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Quotation #{quotation.quotationNumber}</h2>
              <StatusBadge status={quotation.status} />
              <span className="badge badge-info">{selectedFormat}</span>
            </div>
            <div style={{ color: '#475569', fontSize: '0.88rem', marginTop: '0.5rem', lineHeight: 1.6 }}>
              <div><strong>Customer Name:</strong> {quotation.customerName} ({quotation.customerContact})</div>
              <div><strong>Billing Address:</strong> {quotation.customerAddress || 'N/A'}</div>
              <div><strong>Salesperson:</strong> {quotation.salesperson}</div>
              <div><strong>Quotation Date:</strong> {formatDate(quotation.date)} | <strong>Validity:</strong> {quotation.validity}</div>
              {quotation.reference && <div><strong>Reference:</strong> {quotation.reference}</div>}
              {quotation.remarks && <div><strong>Remarks:</strong> {quotation.remarks}</div>}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="stat-label">Original Quoted Amount</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
              {formatCurrency(originalQuotationAmount)}
            </div>
            <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#64748b' }}>
              Confirmed Actual Total: <strong style={{ color: '#16a34a' }}>{formatCurrency(totalActualAmount)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Presentation Format Switcher Bar (Module 5 Spec: 8 Formats) */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1.25rem', backgroundColor: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <LayoutTemplate size={16} style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Multi-Format Presentation Rendering Engine (8 Formats)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
          {FORMAT_OPTIONS.map(fmt => (
            <button 
              key={fmt.key}
              type="button"
              onClick={() => handleFormatSelect(fmt.key)}
              className={`btn ${selectedFormat === fmt.key ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.78rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              {fmt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount Comparison Summary Card */}
      <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid #2563eb', marginBottom: '1.25rem' }}>
        <h3 className="card-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Quotation vs Actual Realized Amount Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div>
            <span className="stat-label">Original Quoted Total</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(originalQuotationAmount)}</div>
          </div>
          <div>
            <span className="stat-label">Confirmed Items Total</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>{formatCurrency(confirmedAmount)}</div>
          </div>
          <div>
            <span className="stat-label">Extra Products Amount</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706' }}>{formatCurrency(extraProductAmount)}</div>
          </div>
          <div>
            <span className="stat-label">Total Actual Material</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#2563eb' }}>{formatCurrency(totalActualAmount)}</div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="table-container">
        <div className="table-header-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Quotation Line Items ({selectedFormat})</h3>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Showing {quotation.items?.length || 0} line items</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Area</th>
              {selectedFormat !== 'WITHOUT_SKU' && <th>Company SKU</th>}
              <th>Product Details</th>
              <th>MRP</th>
              <th>Quoted Qty</th>
              <th>Confirmed Qty</th>
              <th>Extra Qty</th>
              <th>Unit Rate</th>
              <th>Net Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items?.map((item, idx) => {
              const totalCommitted = Number(item.confirmedQty ?? item.quantity) + Number(item.extraQty || 0);
              const confirmedNet = (item.rate * totalCommitted) * (1 - (item.discountPercent || 0) / 100);

              return (
                <tr key={idx}>
                  <td>{item.area || 'General'}</td>
                  {selectedFormat !== 'WITHOUT_SKU' && (
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.sku || item.companySku || 'No SKU'}</td>
                  )}
                  <td style={{ fontWeight: 600 }}>{item.productName}</td>
                  <td>{formatCurrency(item.mrp)}</td>
                  <td>{item.quantity}</td>
                  <td style={{ fontWeight: 700, color: item.confirmedQty === 0 ? '#dc2626' : '#16a34a' }}>
                    {item.confirmedQty ?? item.quantity}
                  </td>
                  <td style={{ color: '#d97706' }}>{item.extraQty || 0}</td>
                  <td>{formatCurrency(item.rate)}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(confirmedNet)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Quotation Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`Confirm Quotation #${quotation.quotationNumber}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleConfirmSubmit}>Confirm & Save Material Requirement</button>
          </>
        }
      >
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Enter customer-confirmed quantities and extra products below:
        </p>

        <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
          <table className="data-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Quoted Qty</th>
                <th>Confirmed Qty</th>
                <th>Extra Qty</th>
                <th>Total Committed</th>
              </tr>
            </thead>
            <tbody>
              {confirmationItems.map((item, idx) => {
                const totalCommitted = Number(item.confirmedQty || 0) + Number(item.extraQty || 0);

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.productName}</td>
                    <td>{item.quotedQty}</td>
                    <td>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={item.confirmedQty} 
                        onChange={(e) => handleQtyChange(idx, 'confirmedQty', e.target.value)}
                        style={{ padding: '0.25rem 0.4rem', width: '80px', fontWeight: 600 }}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        className="form-control" 
                        value={item.extraQty} 
                        onChange={(e) => handleQtyChange(idx, 'extraQty', e.target.value)}
                        style={{ padding: '0.25rem 0.4rem', width: '80px', color: '#d97706' }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: '#2563eb' }}>
                      {totalCommitted}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Extra items addition */}
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Extra Products / Accessories</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addExtraItemRow}>
              <Plus size={14} /> Add Item
            </button>
          </div>

          {extraItems.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input 
                type="text"
                className="form-control"
                placeholder="Product name / accessory"
                value={item.adHocName}
                onChange={(e) => handleExtraItemChange(idx, 'adHocName', e.target.value)}
                style={{ flex: 2, fontSize: '0.8rem' }}
              />
              <input 
                type="number"
                className="form-control"
                placeholder="MRP (₹)"
                value={item.adHocMrp}
                onChange={(e) => handleExtraItemChange(idx, 'adHocMrp', e.target.value)}
                style={{ width: '90px', fontSize: '0.8rem' }}
              />
              <input 
                type="number"
                className="form-control"
                placeholder="Qty"
                value={item.quantity}
                onChange={(e) => handleExtraItemChange(idx, 'quantity', e.target.value)}
                style={{ width: '70px', fontSize: '0.8rem' }}
              />
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeExtraItemRow(idx)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Modal>

    </div>
  );
};

export default QuotationDetails;
