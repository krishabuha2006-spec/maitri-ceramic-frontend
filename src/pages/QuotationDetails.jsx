import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getQuotationById,
  confirmQuotation,
  approveConfirmation,
  sendQuotation,
  cancelQuotation,
  updateQuotationStatus,
  renderQuotationFormat,
  exportQuotationDocument
} from '../services/quotationService';
import { getProducts } from '../services/productService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { printQuotationPdf } from '../utils/quotationPdfGenerator';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import {
  ArrowLeft, CheckCircle2, FileText, Printer, Plus, Trash2, ShieldCheck,
  Download, LayoutTemplate, Send, XCircle, FileSpreadsheet, RefreshCw,
  Receipt, Truck, Check, AlertCircle, ChevronDown
} from 'lucide-react';

import ConfirmModal from '../components/ConfirmModal';
import { usePermissions } from '../utils/permissions';

export const QuotationDetails = () => {
  const { id } = useParams();
  const { canEdit, canDelete, canCreate } = usePermissions('quotations');
  const challanPerms = usePermissions('challans');
  const invoicePerms = usePermissions('invoices');
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productsList, setProductsList] = useState([]);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('success');

  const [selectedFormat, setSelectedFormat] = useState('STANDARD');
  const [actionLoading, setActionLoading] = useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const printMenuRef = useRef(null);

  // Status Change Modal state
  const [statusModal, setStatusModal] = useState({
    isOpen: false,
    status: 'Customer Interested',
    remarks: '',
    saving: false
  });

  // Confirmation Modal state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmationItems, setConfirmationItems] = useState([]);
  const [extraItems, setExtraItems] = useState([]);
  const [confirmationRemarks, setConfirmationRemarks] = useState('');

  // General Confirm Modal state for send, cancel, approve
  const [actionModal, setActionModal] = useState({
    isOpen: false,
    type: '', // 'send' | 'cancel' | 'approve'
    title: '',
    message: '',
    confirmLabel: '',
    danger: false
  });

  const showToast = (msg, type = 'success') => {
    setToastType(type);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const FORMAT_OPTIONS = [
    { key: 'STANDARD', label: 'Standard Quotation' },
    { key: 'WITH_GST', label: 'Quotation With GST' },
    { key: 'DISCOUNT', label: 'Discounted Quotation' },
    { key: 'MRP', label: 'MRP Quotation' },
    { key: 'PLUMBER', label: 'Plumber / Dispatch' },
    { key: 'DETAILED', label: 'Detailed Breakdown' },
    { key: 'PENDING', label: 'Pending Items' },
    { key: 'WITHOUT_SKU', label: 'Quotation Without SKU' }
  ];

  useEffect(() => {
    loadData();
    fetchCatalogProducts();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getQuotationById(id);
      setQuotation(data);
      if (data?.formatKey) {
        setSelectedFormat(data.formatKey);
      }

      const mappedItems = (data.items || []).map((item, idx) => ({
        originalQuotationItemId: item.id || item._id || `item_${idx}`,
        sku: item.sku || item.companySku || item.skuCodeSnapshot || '',
        productName: item.productName || item.productNameSnapshot || item.name || '',
        originalQuantity: Number(item.quantity || 0),
        confirmedQuantity: Number(item.confirmedQty ?? item.quantity ?? 0),
        extraQuantity: Number(item.extraQty || 0),
        rate: Number(item.rate || item.quotedRate || item.mrpSnapshot || item.mrp || 0),
        remarks: item.remarks || ''
      }));
      setConfirmationItems(mappedItems);
      setExtraItems([]);
      setConfirmationRemarks(data.remarks || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogProducts = async () => {
    try {
      const res = await getProducts({ limit: 300 });
      setProductsList(Array.isArray(res?.data) ? res.data : []);
    } catch (err) {
      console.warn('Could not fetch catalog products for ad-hoc selection:', err);
    }
  };

  const handleConfirmedQtyChange = (index, val) => {
    const updated = [...confirmationItems];
    updated[index].confirmedQuantity = Math.max(0, Number(val));
    setConfirmationItems(updated);
  };

  const handleExtraQtyChange = (index, val) => {
    const updated = [...confirmationItems];
    updated[index].extraQuantity = Math.max(0, Number(val));
    setConfirmationItems(updated);
  };

  const handleAddExtraAdHocItem = () => {
    setExtraItems(prev => [
      ...prev,
      {
        tempId: Date.now(),
        productId: '',
        adHocName: '',
        adHocMrp: 0,
        quantity: 1,
        gstPct: 18,
        remarks: ''
      }
    ]);
  };

  const handleExtraItemChange = (index, field, value) => {
    setExtraItems(prev => {
      const copy = [...prev];
      if (field === 'productId') {
        const matched = productsList.find(p => p.id === value || p._id === value);
        copy[index] = {
          ...copy[index],
          productId: value,
          adHocName: matched ? matched.productName : copy[index].adHocName,
          adHocMrp: matched ? (matched.salePrice || matched.mrp || 0) : copy[index].adHocMrp
        };
      } else {
        copy[index] = {
          ...copy[index],
          [field]: (field === 'quantity' || field === 'adHocMrp' || field === 'gstPct') ? Number(value) : value
        };
      }
      return copy;
    });
  };

  const handleRemoveExtraItem = (index) => {
    setExtraItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveConfirmation = async (e) => {
    e.preventDefault();
    const confirmedTotal = confirmationItems.reduce((acc, item) => {
      return acc + ((Number(item.confirmedQuantity) + Number(item.extraQuantity)) * Number(item.rate));
    }, 0);

    const extraTotal = extraItems.reduce((acc, item) => {
      return acc + (Number(item.quantity || 0) * Number(item.adHocMrp || 0));
    }, 0);

    try {
      await confirmQuotation(id, {
        finalConfirmedAmount: confirmedTotal + extraTotal,
        items: confirmationItems,
        extraItems,
        remarks: confirmationRemarks
      });
      setIsConfirmModalOpen(false);
      showToast('Quotation confirmed successfully!');
      loadData();
    } catch (err) {
      showToast('Error confirming quotation: ' + err.message);
    }
  };

  const handleConfirmActionModal = async () => {
    const { type } = actionModal;
    setActionModal(prev => ({ ...prev, isOpen: false }));
    setActionLoading(true);

    try {
      if (type === 'send') {
        await sendQuotation(id);
        showToast(`Quotation #${quotation.quotationNumber} marked as SENT!`);
      } else if (type === 'cancel') {
        await cancelQuotation(id);
        showToast(`Quotation #${quotation.quotationNumber} cancelled.`);
      } else if (type === 'approve') {
        await approveConfirmation(quotation.confirmationId || id);
        showToast('Quotation confirmation approved by manager successfully.');
      }
      await loadData();
    } catch (err) {
      showToast(err.message || 'Action failed.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenStatusModal = () => {
    if (!quotation) return;
    const validStatuses = ['Draft', 'Sent', 'Confirmed', 'Cancelled', 'Expired'];
    setStatusModal({
      isOpen: true,
      status: validStatuses.includes(quotation.status) ? quotation.status : 'Sent',
      remarks: quotation.remarks || '',
      saving: false
    });
  };

  const handleSaveStatusChange = async (e) => {
    if (e) e.preventDefault();
    if (!quotation) return;
    const targetId = quotation._id || quotation.id || id;
    const newStatus = statusModal.status;
    const remarks = statusModal.remarks;

    setStatusModal(prev => ({ ...prev, saving: true }));
    try {
      await updateQuotationStatus(targetId, newStatus, remarks);
      showToast(`Quotation #${quotation.quotationNumber} status updated to "${newStatus}" successfully!`);
      setStatusModal({ isOpen: false, status: 'Draft', remarks: '', saving: false });
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update status.', 'error');
      setStatusModal(prev => ({ ...prev, saving: false }));
    }
  };

  const handleSendQuotation = () => {
    setActionModal({
      isOpen: true,
      type: 'send',
      title: 'Send Quotation to Customer',
      message: `Mark quotation #${quotation.quotationNumber} as SENT to customer?`,
      confirmLabel: 'Mark as Sent',
      danger: false
    });
  };

  const handleCancelQuotation = () => {
    setActionModal({
      isOpen: true,
      type: 'cancel',
      title: 'Cancel Quotation',
      message: `Are you sure you want to cancel quotation #${quotation.quotationNumber}?`,
      confirmLabel: 'Cancel Quotation',
      danger: true
    });
  };

  const handleApproveConfirmation = () => {
    setActionModal({
      isOpen: true,
      type: 'approve',
      title: 'Approve Confirmation',
      message: `Approve confirmed order for quotation #${quotation.quotationNumber}?`,
      confirmLabel: 'Approve Confirmation',
      danger: false
    });
  };

  const handleExport = async (format) => {
    if (format === 'pdf') {
      printQuotationPdf(quotation, selectedFormat);
      return;
    }
    try {
      showToast(`Generating ${format.toUpperCase()} export...`);
      await exportQuotationDocument(id, format, quotation.quotationNumber, quotation);
    } catch (err) {
      showToast(`Export as ${format.toUpperCase()} failed: ` + (err.message || 'Error'), 'error');
    }
  };

  const handleFormatSelect = async (formatKey) => {
    setSelectedFormat(formatKey);
    try {
      await renderQuotationFormat(id, formatKey);
      showToast(`Switched view to format '${formatKey}'`);
    } catch (err) {
      console.warn('Render format error:', err);
    }
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
  const originalQuotationAmount = quotation.grandTotal || quotation.totalNetAmount || quotation.quotationAmount || 0;
  const confirmedAmount = quotation.items?.reduce((sum, i) => sum + ((i.confirmedQty ?? i.quantity) * (i.rate || i.quotedRate || i.mrpSnapshot || i.mrp || 0)), 0) || originalQuotationAmount;
  const extraProductAmount = quotation.items?.reduce((sum, i) => sum + ((i.extraQty || 0) * (i.rate || i.quotedRate || i.mrpSnapshot || i.mrp || 0)), 0) || 0;
  const differenceAmount = originalQuotationAmount - confirmedAmount;
  const totalActualAmount = confirmedAmount + extraProductAmount;

  return (
    <div className="quotation-page-container">

      {/* Top: Back to Quotations Button */}
      <div style={{ marginBottom: '0.85rem' }}>
        <Link
          to={quotation.customerId ? `/customers/${quotation.customerId}?tab=quotations` : '/customers'}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, height: '36px', padding: '0 0.9rem', borderRadius: '8px' }}
        >
          <ArrowLeft size={16} />
          <span>Back to Quotations</span>
        </Link>
      </div>

      {/* Action Buttons Toolbar Bar */}
      <div className="quotation-action-toolbar">
        {/* Format Selector Dropdown */}
        <select
          className="quotation-format-select"
          value={selectedFormat}
          onChange={(e) => {
            const newFmt = e.target.value;
            setSelectedFormat(newFmt);
            handleFormatSelect(newFmt);
            printQuotationPdf(quotation, newFmt);
          }}
          title="Select quotation format"
        >
          {FORMAT_OPTIONS.map(fmt => (
            <option key={fmt.key} value={fmt.key}>{fmt.label}</option>
          ))}
        </select>

        {/* Print PDF Button */}
        <button
          type="button"
          className="btn btn-primary btn-sm quotation-action-btn"
          onClick={() => printQuotationPdf(quotation, selectedFormat)}
          title={`Print / Open PDF in ${selectedFormat} format`}
        >
          <Printer size={14} /> Print PDF
        </button>

        {/* PDF Download Button */}
        <button
          type="button"
          className="btn btn-secondary btn-sm quotation-action-btn"
          onClick={() => handleExport('pdf')}
          title="Download PDF"
        >
          <Download size={14} /> PDF
        </button>

        {/* Export Excel */}
        <button
          type="button"
          className="btn btn-secondary btn-sm quotation-action-btn"
          onClick={() => handleExport('xlsx')}
        >
          <FileSpreadsheet size={14} /> Excel
        </button>

        {/* Quick Status Update */}
        {canEdit && (
          <button
            type="button"
            className="btn btn-secondary btn-sm quotation-action-btn"
            onClick={handleOpenStatusModal}
            disabled={actionLoading}
            style={{ backgroundColor: '#f0f9ff', borderColor: '#bae6fd', color: '#0284c7' }}
          >
            <RefreshCw size={13} /> Update Status
          </button>
        )}

        {/* Send to customer */}
        {(canEdit || canCreate) && quotation.status === 'Draft' && (
          <button
            type="button"
            className="btn btn-primary btn-sm quotation-action-btn"
            onClick={handleSendQuotation}
            disabled={actionLoading}
            style={{ backgroundColor: '#0284c7', borderColor: '#0284c7' }}
          >
            <Send size={13} /> Mark Sent
          </button>
        )}

        {/* Confirm Items */}
        {canEdit && quotation.status !== 'Confirmed' && quotation.status !== 'Cancelled' && (
          <button
            type="button"
            className="btn btn-primary btn-sm quotation-action-btn"
            onClick={() => setIsConfirmModalOpen(true)}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            <CheckCircle2 size={14} /> Confirm Items
          </button>
        )}

        {/* Follow up button */}
        <Link
          to={quotation.customerId ? `/customers/${quotation.customerId}?tab=follow-ups` : '/customers'}
          className="btn btn-secondary btn-sm quotation-action-btn"
          style={{ color: '#c2410c', backgroundColor: '#fff7ed', borderColor: '#fed7aa' }}
        >
          <Send size={13} style={{ transform: 'rotate(45deg)' }} /> Follow-Up
        </Link>

        {/* Approve confirmation */}
        {canEdit && quotation.pendingApproval && (
          <button
            type="button"
            className="btn btn-primary btn-sm quotation-action-btn"
            onClick={handleApproveConfirmation}
            style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}
          >
            <ShieldCheck size={14} /> Approve
          </button>
        )}

        {/* Delivery Challan & Generate Invoice when Confirmed */}
        {quotation.status === 'Confirmed' && (
          <>
            {challanPerms.canCreate && (
              <Link
                to={`/challans/create?customerId=${quotation.customerId}&quotationId=${quotation.id || quotation._id}`}
                className="btn btn-secondary btn-sm quotation-action-btn"
                style={{ color: '#16a34a', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}
              >
                <Truck size={14} /> Create Challan
              </Link>
            )}

            {invoicePerms.canCreate && (
              <Link
                to={`/invoices/create?customerId=${quotation.customerId}&quotationId=${quotation.id || quotation._id}`}
                className="btn btn-primary btn-sm quotation-action-btn"
                style={{ backgroundColor: '#059669', borderColor: '#059669' }}
              >
                <Receipt size={14} /> Generate Invoice
              </Link>
            )}
          </>
        )}

        {/* Cancel Quotation */}
        {canDelete && quotation.status !== 'Cancelled' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm quotation-action-btn"
            onClick={handleCancelQuotation}
            disabled={actionLoading}
            style={{ color: '#dc2626', borderColor: '#fecaca' }}
          >
            <XCircle size={14} /> Cancel
          </button>
        )}
      </div>

      {/* Header Info Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Quotation #{quotation.quotationNumber}</h2>
              <button
                type="button"
                onClick={handleOpenStatusModal}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                title="Click to update status"
              >
                <StatusBadge status={quotation.status} />
              </button>
              <span className="badge badge-info">{selectedFormat}</span>
            </div>
            <div style={{ color: '#475569', fontSize: '0.88rem', marginTop: '0.5rem', lineHeight: 1.6 }}>
              <div><strong>Customer Name:</strong> {quotation.customerName || quotation.partyName} ({quotation.customerContact || quotation.mobile || 'N/A'})</div>
              <div><strong>Billing Address:</strong> {quotation.customerAddress || 'N/A'}</div>
              <div><strong>Salesperson:</strong> {quotation.salesperson || 'N/A'}</div>
              <div><strong>Quotation Date:</strong> {formatDate(quotation.date || quotation.quotationDate)} | <strong>Validity:</strong> {quotation.validity || '30 Days'}</div>
              {quotation.reference && <div><strong>Reference:</strong> {quotation.reference}</div>}
              {quotation.remarks && <div><strong>Remarks:</strong> {quotation.remarks}</div>}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="stat-label">ORIGINAL QUOTED AMOUNT</span>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb' }}>
              {formatCurrency(originalQuotationAmount)}
            </div>
            <div style={{ marginTop: '0.4rem', fontSize: '0.85rem', color: '#64748b' }}>
              Confirmed Actual Total: <strong style={{ color: '#16a34a' }}>{formatCurrency(totalActualAmount)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Amount Comparison Summary Card */}
      <div className="card" style={{ background: '#f8fafc', borderLeft: '4px solid #2563eb', marginBottom: '1.25rem' }}>
        <h3 className="card-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Quotation vs Actual Realized Amount Summary</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
          <div>
            <span className="stat-label">ORIGINAL QUOTED TOTAL</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{formatCurrency(originalQuotationAmount)}</div>
          </div>
          <div>
            <span className="stat-label">CONFIRMED ITEMS TOTAL</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a' }}>{formatCurrency(confirmedAmount)}</div>
          </div>
          <div>
            <span className="stat-label">EXTRA PRODUCTS AMOUNT</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706' }}>{formatCurrency(extraProductAmount)}</div>
          </div>
          <div>
            <span className="stat-label">TOTAL ACTUAL MATERIAL</span>
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
              {selectedFormat !== 'WITHOUT_SKU' && <th>COMPANY SKU</th>}
              <th>PRODUCT DETAILS</th>
              <th>BRAND</th>
              {selectedFormat !== 'PLUMBER' && <th>MRP</th>}
              <th>QUOTED QTY</th>
              <th>CONFIRMED QTY</th>
              {selectedFormat === 'PENDING' && <th>PENDING QTY</th>}
              {(selectedFormat === 'STANDARD' || selectedFormat === 'PLUMBER' || selectedFormat === 'PENDING') && <th>EXTRA QTY</th>}
              {selectedFormat === 'DISCOUNT' && <th>TOTAL MRP</th>}
              {selectedFormat === 'DISCOUNT' && <th>DISCOUNT%</th>}
              {selectedFormat === 'DISCOUNT' && <th>DISCOUNT AMT</th>}
              {selectedFormat === 'WITH_GST' && <th>TAXABLE VALUE</th>}
              {selectedFormat === 'WITH_GST' && <th>GST%</th>}
              {selectedFormat === 'WITH_GST' && <th>GST AMT</th>}
              {selectedFormat === 'DETAILED' && <th>DISC%</th>}
              {selectedFormat === 'DETAILED' && <th>TAXABLE</th>}
              {selectedFormat === 'DETAILED' && <th>GST%</th>}
              {selectedFormat === 'PENDING' && <th>RATE (₹)</th>}
              {selectedFormat === 'PENDING' && <th>QUOTED AMT</th>}
              {selectedFormat === 'PENDING' && <th>SUPPLIED AMT</th>}
              {selectedFormat === 'PENDING' && <th>PENDING AMT</th>}
              {selectedFormat === 'PENDING' && <th>STATUS</th>}
              {(selectedFormat === 'MRP' || selectedFormat === 'PLUMBER') && <th>REMARKS</th>}
              {selectedFormat !== 'PLUMBER' && selectedFormat !== 'PENDING' && <th>UNIT RATE</th>}
              {selectedFormat !== 'PLUMBER' && selectedFormat !== 'PENDING' && <th>NET AMOUNT</th>}
            </tr>
          </thead>
          <tbody>
            {quotation.items?.map((item, idx) => {
              const totalCommitted = Number(item.confirmedQty ?? item.quantity) + Number(item.extraQty || 0);
              const quotedQty = Number(item.quantity || 0);
              const confirmedQty = Number(item.confirmedQty ?? quotedQty);
              const extraQty = Number(item.extraQty || 0);
              const pendingQty = Math.max(0, quotedQty - confirmedQty);
              const mrp = Number(item.mrp || item.mrpSnapshot || item.rate || 0);
              const rate = Number(item.rate || item.quotedRate || mrp || 0);
              const discPct = Number(item.discountPercent || item.discountPct || 0);
              const grossAmt = mrp * totalCommitted;
              const discAmt = (grossAmt * discPct) / 100;
              const taxableAmt = grossAmt - discAmt;
              const gstPct = Number(item.gstPercent || item.gstPctSnapshot || 18);
              const gstAmt = (taxableAmt * gstPct) / 100;
              const netAmount = (selectedFormat === 'WITH_GST' || quotation.payWithGst) ? (taxableAmt + gstAmt) : taxableAmt;

              const quotedAmt = quotedQty * rate;
              const suppliedAmt = confirmedQty * rate;
              const pendingAmt = pendingQty * rate;
              const brand = item.company || item.brand || item.companySnapshot || '-';

              return (
                <tr key={idx} style={selectedFormat === 'PENDING' && pendingQty > 0 ? { backgroundColor: '#fffcf0' } : {}}>
                  {selectedFormat !== 'WITHOUT_SKU' && (
                    <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.8rem' }}>
                      {item.sku || item.companySku || item.skuCodeSnapshot || 'No SKU'}
                    </td>
                  )}
                  <td style={{ fontWeight: 600 }}>
                    <div>{item.productName || item.productNameSnapshot || item.name}</div>
                    {item.remarks && <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>{item.remarks}</div>}
                  </td>
                  <td style={{ color: '#475569', fontSize: '0.82rem' }}>{brand}</td>
                  {selectedFormat !== 'PLUMBER' && <td>{formatCurrency(mrp)}</td>}
                  <td style={{ textAlign: 'center' }}>{quotedQty}</td>
                  <td style={{ fontWeight: 700, color: confirmedQty === 0 ? '#dc2626' : '#16a34a', textAlign: 'center' }}>
                    {confirmedQty}
                  </td>
                  {selectedFormat === 'PENDING' && (
                    <td style={{ fontWeight: 800, color: pendingQty > 0 ? '#dc2626' : '#16a34a', textAlign: 'center' }}>
                      {pendingQty}
                    </td>
                  )}
                  {(selectedFormat === 'STANDARD' || selectedFormat === 'PLUMBER' || selectedFormat === 'PENDING') && (
                    <td style={{ color: extraQty ? '#d97706' : '#94a3b8', fontWeight: extraQty ? 600 : 400, textAlign: 'center' }}>{extraQty}</td>
                  )}
                  {selectedFormat === 'DISCOUNT' && <td>{formatCurrency(grossAmt)}</td>}
                  {selectedFormat === 'DISCOUNT' && <td>{discPct}%</td>}
                  {selectedFormat === 'DISCOUNT' && <td style={{ color: '#dc2626' }}>{formatCurrency(discAmt)}</td>}
                  {selectedFormat === 'WITH_GST' && <td>{formatCurrency(taxableAmt)}</td>}
                  {selectedFormat === 'WITH_GST' && <td>{gstPct}%</td>}
                  {selectedFormat === 'WITH_GST' && <td style={{ color: '#2563eb' }}>{formatCurrency(gstAmt)}</td>}
                  {selectedFormat === 'DETAILED' && <td>{discPct}%</td>}
                  {selectedFormat === 'DETAILED' && <td>{formatCurrency(taxableAmt)}</td>}
                  {selectedFormat === 'DETAILED' && <td>{gstPct}%</td>}
                  
                  {selectedFormat === 'PENDING' && <td>{formatCurrency(rate)}</td>}
                  {selectedFormat === 'PENDING' && <td>{formatCurrency(quotedAmt)}</td>}
                  {selectedFormat === 'PENDING' && <td style={{ color: '#16a34a', fontWeight: 600 }}>{formatCurrency(suppliedAmt)}</td>}
                  {selectedFormat === 'PENDING' && (
                    <td style={{ color: pendingQty > 0 ? '#dc2626' : '#16a34a', fontWeight: 800 }}>
                      {formatCurrency(pendingAmt)}
                    </td>
                  )}
                  {selectedFormat === 'PENDING' && (
                    <td>
                      <span className={`badge ${pendingQty === 0 ? 'badge-success' : (confirmedQty > 0 ? 'badge-warning' : 'badge-danger')}`}>
                        {pendingQty === 0 ? 'Complete' : (confirmedQty > 0 ? 'Partial' : 'Pending')}
                      </span>
                    </td>
                  )}
                  {(selectedFormat === 'MRP' || selectedFormat === 'PLUMBER') && (
                    <td style={{ color: '#64748b' }}>{item.remarks || '-'}</td>
                  )}
                  {selectedFormat !== 'PLUMBER' && selectedFormat !== 'PENDING' && <td>{formatCurrency(rate)}</td>}
                  {selectedFormat !== 'PLUMBER' && selectedFormat !== 'PENDING' && (
                    <td style={{ fontWeight: 700 }}>{formatCurrency(netAmount)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pending Items Detailed Supply Summary Box */}
      {selectedFormat === 'PENDING' && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <div className="card" style={{ width: '420px', padding: '0.85rem 1.15rem', background: '#f8fafc', borderLeft: '4px solid #d97706' }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 700, margin: '0 0 0.65rem 0', color: '#0f172a' }}>
              Pending Supply Material & Balance Summary
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Total Quoted Material Value:</span>
              <strong style={{ color: '#0f172a' }}>
                {formatCurrency(quotation.items?.reduce((sum, i) => sum + ((i.rate || i.quotedRate || i.mrp || 0) * (i.quantity || 0)), 0) || 0)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Total Confirmed / Supplied Value:</span>
              <strong style={{ color: '#16a34a' }}>
                {formatCurrency(quotation.items?.reduce((sum, i) => sum + ((i.rate || i.quotedRate || i.mrp || 0) * (i.confirmedQty ?? i.quantity ?? 0)), 0) || 0)}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', paddingTop: '0.5rem', borderTop: '1.5px solid #e2e8f0', marginTop: '0.4rem' }}>
              <strong style={{ color: '#dc2626' }}>Pending Balance to Supply:</strong>
              <strong style={{ color: '#dc2626', fontSize: '1.05rem', fontWeight: 800 }}>
                {formatCurrency(quotation.items?.reduce((sum, i) => {
                  const qty = Number(i.quantity || 0);
                  const conf = Number(i.confirmedQty ?? qty);
                  const pend = Math.max(0, qty - conf);
                  return sum + ((i.rate || i.quotedRate || i.mrp || 0) * pend);
                }, 0) || 0)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* GST Breakdown Summary Box for WITH_GST format */}
      {selectedFormat === 'WITH_GST' && (
        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <div className="card" style={{ width: '340px', padding: '0.75rem 1rem', background: '#f8fafc', borderLeft: '4px solid #0284c7' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#0f172a' }}>GST Tax Summary Breakdown</h4>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>Total Taxable Value:</span>
              <strong style={{ color: '#0f172a' }}>{formatCurrency(quotation.items?.reduce((sum, i) => sum + ((i.rate || i.mrp || 0) * (i.confirmedQty ?? i.quantity) * (1 - (i.discountPercent || 0)/100)), 0) || 0)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>CGST (9%):</span>
              <strong style={{ color: '#2563eb' }}>{formatCurrency((quotation.items?.reduce((sum, i) => sum + ((i.rate || i.mrp || 0) * (i.confirmedQty ?? i.quantity) * (1 - (i.discountPercent || 0)/100) * 0.18), 0) || 0) / 2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.35rem' }}>
              <span style={{ color: '#64748b' }}>SGST (9%):</span>
              <strong style={{ color: '#2563eb' }}>{formatCurrency((quotation.items?.reduce((sum, i) => sum + ((i.rate || i.mrp || 0) * (i.confirmedQty ?? i.quantity) * (1 - (i.discountPercent || 0)/100) * 0.18), 0) || 0) / 2)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', paddingTop: '0.4rem', borderTop: '1px solid #e2e8f0' }}>
              <strong style={{ color: '#0f172a' }}>Grand Total (With GST):</strong>
              <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{formatCurrency((quotation.items?.reduce((sum, i) => sum + ((i.rate || i.mrp || 0) * (i.confirmedQty ?? i.quantity) * (1 - (i.discountPercent || 0)/100) * 1.18), 0) || 0))}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Quotation Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title={`Confirm Quotation #${quotation.quotationNumber}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsConfirmModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSaveConfirmation}>Confirm & Save Material Requirement</button>
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
                const totalCommitted = Number(item.confirmedQuantity || 0) + Number(item.extraQuantity || 0);

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.productName}</td>
                    <td>{item.originalQuantity}</td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={item.confirmedQuantity}
                        onChange={(e) => handleConfirmedQtyChange(idx, e.target.value)}
                        style={{ padding: '0.25rem 0.4rem', width: '80px', fontWeight: 600 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control"
                        value={item.extraQuantity}
                        onChange={(e) => handleExtraQtyChange(idx, e.target.value)}
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
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddExtraAdHocItem}>
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
              <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRemoveExtraItem(idx)}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={actionModal.isOpen}
        title={actionModal.title}
        message={actionModal.message}
        confirmLabel={actionModal.confirmLabel}
        danger={actionModal.danger}
        onConfirm={handleConfirmActionModal}
        onCancel={() => setActionModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Status Update Modal */}
      {statusModal.isOpen && quotation && (
        <Modal
          isOpen={statusModal.isOpen}
          onClose={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
          title={`Update Quotation Status — #${quotation.quotationNumber}`}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStatusModal(prev => ({ ...prev, isOpen: false }))}
                style={{ borderRadius: '8px', fontSize: '0.825rem' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveStatusChange}
                disabled={statusModal.saving}
                style={{ borderRadius: '8px', fontSize: '0.825rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Check size={15} />
                <span>{statusModal.saving ? 'Updating...' : 'Save New Status'}</span>
              </button>
            </div>
          }
        >
          <form onSubmit={handleSaveStatusChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CURRENT STATUS</span>
                <div><StatusBadge status={quotation.status} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>CUSTOMER</span>
                <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                  {quotation.customerName}
                </div>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                Select New Quotation Status <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={statusModal.status}
                onChange={e => setStatusModal(prev => ({ ...prev, status: e.target.value }))}
                style={{ fontSize: '0.85rem', height: '38px', borderRadius: '8px' }}
                required
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent (Delivered to Customer)</option>
                <option value="Confirmed">Confirmed (Realized Sale)</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Expired">Expired</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem', display: 'block' }}>
                Status Remarks / Customer Notes
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={statusModal.remarks}
                onChange={e => setStatusModal(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Add notes about customer response, discussion, agreed price or feedback..."
                style={{ fontSize: '0.825rem', borderRadius: '8px' }}
              />
            </div>
          </form>
        </Modal>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="floating-toast-container">
          <div className={`floating-toast ${toastType === 'error' ? 'danger' : 'success'}`}>
            {toastType === 'error' ? (
              <AlertCircle size={16} style={{ color: '#dc2626' }} />
            ) : (
              <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
            )}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default QuotationDetails;

