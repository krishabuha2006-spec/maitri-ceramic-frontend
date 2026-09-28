import React, { useState, useEffect, useMemo } from 'react';
import { 
  getReturns, 
  createPurchaseReturn, 
  createSalesReturn, 
  confirmReturn, 
  cancelReturn, 
  exportReturns 
} from '../services/returnService';
import { getCompanies, getProducts } from '../services/productService';
import { getVendors } from '../services/masterService';
import { getCustomers } from '../services/customerService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
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

  // Dropdown master data
  const [companies, setCompanies] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '', // 'confirm' | 'cancel'
    item: null,
    title: '',
    message: '',
    confirmLabel: '',
    danger: false
  });

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
  const [validationErrors, setValidationErrors] = useState({});

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Load masters for cascading dropdowns
  useEffect(() => {
    Promise.all([
      getCompanies().catch(() => []),
      getCustomers().catch(() => []),
      getProducts({ limit: 500 }).catch(() => []),
      getVendors().catch(() => ({ data: [] }))
    ]).then(([compList, custList, prodRes, vendRes]) => {
      setCompanies(Array.isArray(compList) ? compList : []);
      const cData = Array.isArray(custList?.data) ? custList.data : (Array.isArray(custList) ? custList : []);
      setCustomers(cData);
      const pData = Array.isArray(prodRes?.data) ? prodRes.data : (Array.isArray(prodRes) ? prodRes : []);
      setProducts(pData);
      const vData = Array.isArray(vendRes?.data) ? vendRes.data : (Array.isArray(vendRes) ? vendRes : []);
      setVendors(vData);
    });
  }, []);

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

  // Filter external vendors purely from /vendors API
  const vendorList = useMemo(() => {
    const seen = new Set();
    const unique = [];
    vendors.forEach(v => {
      const name = (v.vendorName || v.name || v.supplierName || '').trim();
      const id = v._id || v.id;
      if (name && id && !seen.has(String(id).toLowerCase())) {
        seen.add(String(id).toLowerCase());
        unique.push({
          id: String(id),
          name,
          mobile: v.mobile || '',
          city: v.city || ''
        });
      }
    });
    return unique;
  }, [vendors]);

  // Unique Customer list
  const customerList = useMemo(() => {
    const seen = new Set();
    const uniqueCustomers = [];
    customers.forEach(c => {
      const name = (c.customerName || c.name || '').trim();
      const id = c._id || c.id;
      if (name && id && !seen.has(String(id).toLowerCase())) {
        seen.add(String(id).toLowerCase());
        uniqueCustomers.push({
          id: String(id),
          name,
          mobile: c.mobile || ''
        });
      }
    });
    return uniqueCustomers;
  }, [customers]);

  // Filter products matching selected vendor
  const availableProducts = useMemo(() => {
    if (activeTab === 'purchase') {
      if (!formData.vendorId) return [];
      const selectedVId = String(formData.vendorId).toLowerCase();
      const selectedVName = String(formData.vendor || '').toLowerCase().trim();

      return products.filter(p => {
        const pVendId = String(p.vendorId || p.vendor?._id || (typeof p.vendor === 'string' && /^[0-9a-fA-F]{24}$/.test(p.vendor) ? p.vendor : '') || '').toLowerCase();
        const pVendName = String(p.vendor?.vendorName || (typeof p.vendor === 'string' ? p.vendor : '') || '').toLowerCase().trim();

        const matchById = selectedVId && pVendId && pVendId === selectedVId;
        const matchByName = selectedVName && pVendName && (pVendName === selectedVName || pVendName.includes(selectedVName));

        return matchById || matchByName;
      });
    }
    return products;
  }, [products, activeTab, formData.vendorId, formData.vendor]);

  const handleVendorChange = (e) => {
    const vId = e.target.value;
    const selectedV = vendorList.find(v => String(v.id) === String(vId));
    setFormData(prev => ({
      ...prev,
      vendorId: vId,
      vendor: selectedV?.name || '',
      productId: '',
      sku: '',
      productName: '',
      unit: 'Sq.Ft'
    }));
    setSelectedProductId('');
    if (validationErrors.vendorId) setValidationErrors(prev => ({ ...prev, vendorId: '' }));
  };

  const handleCustomerChange = (e) => {
    const cId = e.target.value;
    const selectedC = customerList.find(c => String(c.id) === String(cId));
    setFormData(prev => ({
      ...prev,
      customerId: cId,
      customerName: selectedC?.name || ''
    }));
    if (validationErrors.customerId) setValidationErrors(prev => ({ ...prev, customerId: '' }));
  };

  const handleProductSelect = (e) => {
    const pId = e.target.value;
    setSelectedProductId(pId);
    const prd = products.find(p => String(p._id || p.id) === String(pId));
    if (prd) {
      setFormData(prev => ({
        ...prev,
        productId: prd._id || prd.id,
        sku: prd.sku || '',
        productName: prd.productName || '',
        unit: prd.unit || 'Sq.Ft'
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        productId: '',
        sku: '',
        productName: '',
        unit: 'Sq.Ft'
      }));
    }
    if (validationErrors.productId || validationErrors.sku || validationErrors.productName) {
      setValidationErrors(prev => ({ ...prev, productId: '', sku: '', productName: '' }));
    }
  };

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
    setValidationErrors({});
    setSelectedProductId('');

    setFormData({
      returnNoteNumber: tabType === 'purchase' ? `PRN-${Date.now().toString().slice(-6)}` : `SRN-${Date.now().toString().slice(-6)}`,
      date: new Date().toISOString().split('T')[0],
      vendorId: '',
      vendor: '',
      customerId: '',
      customerName: '',
      purchaseRef: '',
      invoiceNumber: '',
      challanNumber: '',
      productId: '',
      sku: '',
      productName: '',
      quantity: 1,
      unit: 'Sq.Ft',
      returnReason: 'Quality inspection rejection / Damage',
      remarks: ''
    });

    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const errors = {};
    if (activeTab === 'purchase' && !formData.vendorId) {
      errors.vendorId = 'Vendor / Supplier selection is required.';
    }

    if (activeTab === 'sales' && !formData.customerId) {
      errors.customerId = 'Customer selection is required.';
    }

    if (!formData.sku || !formData.sku.trim()) {
      errors.sku = 'Product SKU is required.';
    }

    if (!formData.productName || !formData.productName.trim()) {
      errors.productName = 'Product description is required.';
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      errors.quantity = 'Valid quantity greater than 0 is required.';
    }

    if (!formData.returnReason || !formData.returnReason.trim()) {
      errors.returnReason = 'Reason for return is required.';
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});

    const returnPayload = {
      vendorId: formData.vendorId,
      customerId: formData.customerId,
      productId: formData.productId,
      quantity: Number(formData.quantity),
      purchaseReferenceNote: formData.purchaseRef,
      invoiceNumber: formData.invoiceNumber,
      challanNumber: formData.challanNumber,
      returnReason: formData.returnReason,
      remarks: formData.remarks,
      returnDate: formData.date
    };

    setSaving(true);
    try {
      if (activeTab === 'purchase') {
        const saved = await createPurchaseReturn(returnPayload);
        showToast(`Purchase Return #${saved?.returnNoteNumber || formData.returnNoteNumber} recorded successfully!`);
      } else {
        const saved = await createSalesReturn(returnPayload);
        showToast(`Sales Return #${saved?.returnNoteNumber || formData.returnNoteNumber} recorded successfully!`);
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

  const handleConfirm = (item) => {
    setConfirmModal({
      isOpen: true,
      type: 'confirm',
      item,
      title: 'Confirm Goods Return',
      message: `Confirm Return Note #${item.returnNoteNumber}?\n\nThis will adjust inventory physical stock ledger automatically.`,
      confirmLabel: 'Yes, Confirm Return',
      danger: false
    });
  };

  const handleCancel = (item) => {
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      item,
      title: 'Cancel Return Note',
      message: `Are you sure you want to cancel return #${item.returnNoteNumber}? This action cannot be undone.`,
      confirmLabel: 'Yes, Cancel Return',
      danger: true
    });
  };

  const handleConfirmAction = async () => {
    const { type, item } = confirmModal;
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    if (!item) return;

    const id = item.id || item._id;
    try {
      if (type === 'confirm') {
        await confirmReturn(id);
        showToast(`Return ${item.returnNoteNumber} confirmed! Physical stock updated.`);
      } else if (type === 'cancel') {
        await cancelReturn(id, 'Cancelled by user');
        showToast(`Return ${item.returnNoteNumber} cancelled.`);
      }
      loadData();
    } catch (err) {
      showToast(`Error processing return: ${err.message}`);
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

        <form onSubmit={handleSubmit} noValidate>
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
                  style={{ height: '42px', borderRadius: '8px' }}
                />
              </div>

              {activeTab === 'purchase' ? (
                <>
                  <div style={{ gridColumn: 'span 6' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                      Vendor / Supplier <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <select
                      className="form-control"
                      value={formData.vendorId}
                      onChange={handleVendorChange}
                      style={{
                        height: '42px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        borderColor: validationErrors.vendorId ? '#dc2626' : '#cbd5e1',
                        backgroundColor: validationErrors.vendorId ? '#fef2f2' : '#ffffff'
                      }}
                    >
                      <option value="">-- Select Vendor / Supplier --</option>
                      {vendorList.map(v => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    {validationErrors.vendorId && (
                      <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                        {validationErrors.vendorId}
                      </div>
                    )}
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
                    <select
                      className="form-control"
                      value={formData.customerId}
                      onChange={handleCustomerChange}
                      style={{
                        height: '42px',
                        borderRadius: '8px',
                        fontWeight: 600,
                        borderColor: validationErrors.customerId ? '#dc2626' : '#cbd5e1',
                        backgroundColor: validationErrors.customerId ? '#fef2f2' : '#ffffff'
                      }}
                    >
                      <option value="">-- Select Customer --</option>
                      {customerList.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.mobile ? `(${c.mobile})` : ''}
                        </option>
                      ))}
                    </select>
                    {validationErrors.customerId && (
                      <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                        {validationErrors.customerId}
                      </div>
                    )}
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

              {/* Cascading Product Selector */}
              <div style={{ gridColumn: 'span 12' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Select Product to Return (Cascading from {activeTab === 'purchase' ? 'Vendor' : 'Catalog'}) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  className="form-control"
                  value={selectedProductId}
                  onChange={handleProductSelect}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    borderColor: validationErrors.productId ? '#dc2626' : '#cbd5e1',
                    backgroundColor: validationErrors.productId ? '#fef2f2' : '#f8fafc'
                  }}
                >
                  {activeTab === 'purchase' && !formData.vendorId ? (
                    <option value="">-- Please select a Vendor first to see their products --</option>
                  ) : availableProducts.length === 0 ? (
                    <option value="">-- No products linked to this vendor --</option>
                  ) : (
                    <option value="">-- Choose Product (Auto-fills SKU, Name & Unit) --</option>
                  )}
                  {availableProducts.map(p => (
                    <option key={p._id || p.id || p.sku} value={p._id || p.id}>
                      [{p.sku}] {p.productName} ({p.unit || 'Sq.Ft'})
                    </option>
                  ))}
                </select>
                {validationErrors.productId && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.productId}
                  </div>
                )}
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {activeTab === 'purchase' ? (
                    formData.vendorId ? (
                      availableProducts.length > 0
                        ? `Showing ${availableProducts.length} product(s) belonging to "${formData.vendor || 'selected vendor'}"`
                        : `No products found for "${formData.vendor}".`
                    ) : (
                      `Select a Vendor above to view and filter their specific products.`
                    )
                  ) : (
                    `Showing ${availableProducts.length} product(s) available in catalog.`
                  )}
                </div>
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Product SKU <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.sku}
                  onChange={(e) => {
                    setFormData({ ...formData, sku: e.target.value });
                    if (validationErrors.sku) setValidationErrors(prev => ({ ...prev, sku: '' }));
                  }}
                  placeholder="e.g. VT-60120-GL"
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    borderColor: validationErrors.sku ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.sku ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.sku && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.sku}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Product Description <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.productName}
                  onChange={(e) => {
                    setFormData({ ...formData, productName: e.target.value });
                    if (validationErrors.productName) setValidationErrors(prev => ({ ...prev, productName: '' }));
                  }}
                  placeholder="e.g. Glazed Vitrified Tile Statuario"
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    borderColor: validationErrors.productName ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.productName ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.productName && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.productName}
                  </div>
                )}
              </div>

              <div style={{ gridColumn: 'span 6' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Quantity Returned <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="form-control"
                  value={formData.quantity}
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => {
                    if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault();
                  }}
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^0-9.]/g, '');
                    const parts = val.split('.');
                    if (parts.length > 2) val = parts[0] + '.' + parts.slice(1).join('');
                    val = val.replace(/^0+(?=\d)/, '');
                    setFormData({ ...formData, quantity: val === '' ? '' : val });
                    if (validationErrors.quantity) setValidationErrors(prev => ({ ...prev, quantity: '' }));
                  }}
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    borderColor: validationErrors.quantity ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.quantity ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.quantity && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.quantity}
                  </div>
                )}
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
                  onChange={(e) => {
                    setFormData({ ...formData, returnReason: e.target.value });
                    if (validationErrors.returnReason) setValidationErrors(prev => ({ ...prev, returnReason: '' }));
                  }}
                  placeholder="e.g. Broken tiles / Excess stock from construction site"
                  style={{
                    height: '42px',
                    borderRadius: '8px',
                    borderColor: validationErrors.returnReason ? '#dc2626' : undefined,
                    backgroundColor: validationErrors.returnReason ? '#fef2f2' : undefined
                  }}
                />
                {validationErrors.returnReason && (
                  <div style={{ color: '#dc2626', fontSize: '0.78rem', marginTop: '0.3rem', fontWeight: 500 }}>
                    {validationErrors.returnReason}
                  </div>
                )}
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
        <table className="data-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Return Note</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Date</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569' }}>{activeTab === 'purchase' ? 'Vendor' : 'Customer'}</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>{activeTab === 'purchase' ? 'PO Ref' : 'Invoice / Challan'}</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>SKU</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569' }}>Product Description</th>
              <th style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Qty</th>
              <th style={{ padding: '0.6rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
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

      {/* Custom Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmLabel={confirmModal.confirmLabel}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        danger={confirmModal.danger}
      />
    </div>
  );
};

export default Returns;
