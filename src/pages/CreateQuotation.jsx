import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getProducts, getCompanies } from '../services/productService';
import { getQuotationById, createQuotation, updateQuotation } from '../services/quotationService';
import { getQuotationFormats } from '../services/quotationFormatService';
import { calculateQuotationItem, calculateQuotationTotals } from '../utils/calculations';
import { formatCurrency } from '../utils/formatters';
import { 
  Plus, Trash2, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, 
  Building, User, Calendar, FileText, Tag, MapPin, Layers, Sparkles
} from 'lucide-react';

const COMMON_AREAS = ['Living Room', 'Master Bed', 'Kitchen', 'Bathroom', 'Balcony', 'Parking', 'Hall', 'Elevation'];

export const CreateQuotation = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const customerIdParam = searchParams.get('customerId') || '';
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [headerData, setHeaderData] = useState({
    quotationNumber: `QT-2026-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    customerContact: '',
    customerAddress: '',
    companyId: '',
    salesperson: '',
    formatKey: 'STANDARD',
    quotationType: 'Standard Quotation',
    validity: '15 Days',
    reference: '',
    remarks: '',
    status: 'Draft'
  });

  // Items starts empty for new quotations - NO prefilled dummy data
  const [items, setItems] = useState([]);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [cRes, pRes, fRes, compRes] = await Promise.all([
          getCustomers(), 
          getProducts(),
          getQuotationFormats(),
          getCompanies()
        ]);
        const cList = Array.isArray(cRes?.data) ? cRes.data : (Array.isArray(cRes) ? cRes : []);
        const pList = Array.isArray(pRes?.data) ? pRes.data : (Array.isArray(pRes) ? pRes : []);
        const fList = Array.isArray(fRes?.data) ? fRes.data : (Array.isArray(fRes) ? fRes : []);
        const compList = Array.isArray(compRes) ? compRes : [];
        
        setCustomers(cList);
        setAvailableProducts(pList);
        setAvailableFormats(fList);
        setCompanies(compList);

        if (isEdit) {
          const qtData = await getQuotationById(id);
          setHeaderData(prev => ({ ...prev, ...qtData }));
          if (Array.isArray(qtData.items) && qtData.items.length > 0) {
            setItems(qtData.items);
          }
        } else if (customerIdParam) {
          const matched = cList.find(c => String(c.id) === String(customerIdParam) || String(c._id) === String(customerIdParam));
          if (matched) {
            setHeaderData(prev => ({
              ...prev,
              customerId: matched._id || matched.id,
              customerName: matched.name || matched.customerName || '',
              customerContact: matched.mobile || matched.customerContact || '',
              customerAddress: `${matched.billingAddress || ''}${matched.city ? ', ' + matched.city : ''}`
            }));
          }
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setFormError('Failed to load initial form data from server.');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [id, isEdit, customerIdParam]);

  const handleCustomerChange = (e) => {
    const custId = e.target.value;
    setFormError('');
    if (!custId) {
      setHeaderData(prev => ({
        ...prev,
        customerId: '',
        customerName: '',
        customerContact: '',
        customerAddress: ''
      }));
      return;
    }

    const selected = customers.find(c => String(c.id) === String(custId) || String(c._id) === String(custId));
    if (selected) {
      setHeaderData(prev => ({
        ...prev,
        customerId: selected._id || selected.id,
        customerName: selected.name || selected.customerName || '',
        customerContact: selected.mobile || selected.customerContact || '',
        customerAddress: `${selected.billingAddress || ''}${selected.city ? ', ' + selected.city : ''}`
      }));
    }
  };

  const handleHeaderChange = (e) => {
    const { name, value } = e.target;
    setHeaderData(prev => ({ ...prev, [name]: value }));
    if (formError) setFormError('');
  };

  const handleNumberKeyDown = (e) => {
    if (e.key === '-' || e.key === 'e' || e.key === 'E' || e.key === '+') {
      e.preventDefault();
    }
  };

  const handleNumberFocus = (e) => {
    if (e.target) e.target.select();
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    const textFields = ['area', 'productName', 'company', 'companySku', 'description', 'sku', 'productId'];
    
    if (textFields.includes(field)) {
      updated[index][field] = value;
    } else {
      // Disallow minus sign and non-numeric characters, allow single dot
      let clean = String(value).replace(/[^0-9.]/g, '');
      const parts = clean.split('.');
      if (parts.length > 2) {
        clean = parts[0] + '.' + parts.slice(1).join('');
      }
      if (/^0[0-9]/.test(clean)) {
        clean = clean.replace(/^0+/, '');
        if (clean === '' || clean.startsWith('.')) clean = '0' + clean;
      }
      updated[index][field] = clean === '' ? '' : clean;
    }

    // Auto-populate product details when product or SKU is selected
    if (field === 'productId' || field === 'sku') {
      const prd = availableProducts.find(p => String(p.id || p._id) === String(value) || p.sku === value || p.companySkuCode === value);
      if (prd) {
        const prodMrp = Number(prd.mrp || prd.salePrice || prd.purchaseRate || 0);
        const prodRate = Number(prd.salePrice || prd.mrp || prd.purchaseRate || 0);
        updated[index].productId = prd._id || prd.id;
        updated[index].sku = prd.sku || prd.companySkuCode || '';
        updated[index].productName = prd.productName || '';
        updated[index].company = prd.company || prd.companyName || '';
        updated[index].companySku = prd.companySku || prd.companySkuCode || prd.sku || '';
        updated[index].mrp = prodMrp;
        updated[index].rate = prodRate;
        updated[index].gstPercent = Number(prd.gstPercent || prd.gstPct || 18);
      }
    }

    setItems(updated);
    if (formError) setFormError('');
  };

  const addItemWithSku = (preselectedProduct = null) => {
    setFormError('');
    const prd = preselectedProduct || availableProducts[0] || {};
    const prodMrp = Number(prd.mrp || prd.salePrice || prd.purchaseRate || 0);
    const prodRate = Number(prd.salePrice || prd.mrp || prd.purchaseRate || 0);
    setItems([
      ...items,
      {
        id: Date.now(),
        productId: prd._id || prd.id || '',
        area: 'Living Room',
        sku: prd.sku || prd.companySkuCode || '',
        productName: prd.productName || '',
        company: prd.company || prd.companyName || '',
        companySku: prd.companySku || prd.companySkuCode || prd.sku || '',
        description: '',
        mrp: prodMrp,
        quantity: 1,
        rate: prodRate,
        discountPercent: 0,
        gstPercent: Number(prd.gstPercent || prd.gstPct || 18)
      }
    ]);
  };

  const addItemWithoutSku = () => {
    setFormError('');
    setItems([
      ...items,
      {
        id: Date.now(),
        productId: '',
        area: 'General Area',
        sku: '',
        productName: '',
        company: '',
        companySku: 'NO-SKU',
        description: '',
        mrp: 0,
        quantity: 1,
        rate: 0,
        discountPercent: 0,
        gstPercent: 18
      }
    ]);
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
    if (formError) setFormError('');
  };

  // Calculations
  const calculatedItems = items.map(item => calculateQuotationItem(item));
  const totals = calculateQuotationTotals(items);

  const selectedCustomerObj = customers.find(c => String(c.id) === String(headerData.customerId) || String(c._id) === String(headerData.customerId));

  // Filtered products list based on header or row brand filter
  const filteredProducts = selectedBrandFilter 
    ? availableProducts.filter(p => (p.company || '').toLowerCase() === selectedBrandFilter.toLowerCase() || p.companyId === selectedBrandFilter)
    : availableProducts;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!headerData.customerId && !headerData.customerName) {
      setFormError('Please select a customer.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (items.length === 0) {
      setFormError('Please add at least one product item to the quotation.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      if (!itm.productName && !itm.sku) {
        setFormError(`Item #${i + 1} requires a product name or SKU selection.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (Number(itm.quantity) <= 0) {
        setFormError(`Item #${i + 1} ("${itm.productName || 'Product'}") quantity must be greater than 0.`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setSaving(true);
    const payload = {
      ...headerData,
      formatKey: headerData.formatKey || 'STANDARD',
      customerId: headerData.customerId,
      items: calculatedItems,
      grossTotal: totals.grossTotal,
      discountTotal: totals.discountTotal,
      taxableTotal: totals.taxableTotal,
      gstTotal: totals.gstTotal,
      quotationAmount: totals.finalTotal,
      grandTotal: totals.finalTotal,
      confirmedAmount: headerData.confirmedAmount || totals.finalTotal
    };

    try {
      if (isEdit) {
        if (String(headerData.status || '').toLowerCase().includes('confirm')) {
          setFormError("Quotation is already in 'CONFIRMED' status and cannot be modified directly. Adjustments must be made in Quotation Confirmation.");
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setSaving(false);
          return;
        }
        await updateQuotation(id, payload);
        setSuccessToast('Quotation updated successfully!');
      } else {
        await createQuotation(payload);
        setSuccessToast('Quotation created successfully!');
      }
      const targetCustId = headerData.customerId || customerIdParam;
      setTimeout(() => {
        navigate(targetCustId ? `/customers/${targetCustId}?tab=quotations` : '/customers');
      }, 900);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error saving quotation to server.');
    } finally {
      setSaving(false);
    }
  };

  const backLink = (headerData.customerId || customerIdParam)
    ? `/customers/${headerData.customerId || customerIdParam}?tab=quotations`
    : '/customers';

  if (loading) {
    return (
      <div style={{
        maxWidth: '1160px',
        margin: '2rem auto',
        padding: '3rem',
        textAlign: 'center',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0'
      }}>
        <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb', marginBottom: '1rem' }} />
        <h3 style={{ color: '#0f172a', fontWeight: 600 }}>Loading backend quotation data...</h3>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to={backLink} 
            className="btn btn-secondary"
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
            <span>Back</span>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={24} style={{ color: '#2563eb' }} />
              <span>{isEdit ? `Edit Quotation #${headerData.quotationNumber}` : 'Create New Quotation'}</span>
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
              Configure client details, item specifications, discounts and dynamic format rendering
            </p>
          </div>
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

      {isEdit && String(headerData.status || '').toLowerCase().includes('confirm') && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.9rem 1.25rem',
          backgroundColor: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '12px',
          color: '#166534',
          fontSize: '0.875rem',
          marginBottom: '1.5rem'
        }}>
          <CheckCircle2 size={20} style={{ color: '#16a34a', flexShrink: 0 }} />
          <div>
            <strong>Notice:</strong> This quotation is in <strong>CONFIRMED</strong> status. Direct edits to header or items are locked by the backend engine. Please make adjustments through the Quotation Confirmation module.
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Card 1: Quotation Details & Customer Header */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Building size={18} style={{ color: '#2563eb' }} />
              <span>Quotation Details & Customer Header</span>
            </h3>
            {selectedCustomerObj && (
              <span style={{ fontSize: '0.78rem', backgroundColor: '#eff6ff', color: '#2563eb', padding: '0.2rem 0.6rem', borderRadius: '6px', fontWeight: 600 }}>
                Customer Active: {selectedCustomerObj.name || selectedCustomerObj.customerName}
              </span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1rem' }}>
            {/* Quotation Number */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Quotation Number
              </label>
              <input
                type="text"
                name="quotationNumber"
                className="form-control"
                value={headerData.quotationNumber}
                onChange={handleHeaderChange}
                required
                style={{ height: '42px', borderRadius: '8px', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}
              />
            </div>

            {/* Quotation Date */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Quotation Date
              </label>
              <input
                type="date"
                name="date"
                className="form-control"
                value={headerData.date}
                onChange={handleHeaderChange}
                required
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Select Customer */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Select Customer <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={headerData.customerId}
                onChange={handleCustomerChange}
                required
                style={{ height: '42px', borderRadius: '8px', borderColor: formError && !headerData.customerId ? '#f87171' : '#cbd5e1' }}
              >
                <option value="">-- Choose Customer --</option>
                {customers.map(c => (
                  <option key={c.id || c._id} value={c.id || c._id}>{c.name || c.customerName} ({c.mobile || c.customerContact})</option>
                ))}
              </select>
            </div>

            {/* Customer Contact */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Customer Contact
              </label>
              <input
                type="text"
                name="customerContact"
                className="form-control"
                value={headerData.customerContact}
                onChange={handleHeaderChange}
                placeholder="Contact number"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Customer Address */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Customer Address / Site Location
              </label>
              <input
                type="text"
                name="customerAddress"
                className="form-control"
                value={headerData.customerAddress}
                onChange={handleHeaderChange}
                placeholder="Billing address & delivery site"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Associated Brand / Company Filter */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Company / Brand
              </label>
              <select
                name="companyId"
                className="form-control"
                value={headerData.companyId || ''}
                onChange={(e) => {
                  handleHeaderChange(e);
                  setSelectedBrandFilter(e.target.value ? (companies.find(c => (c._id || c.id) === e.target.value)?.companyName || '') : '');
                }}
                style={{ height: '42px', borderRadius: '8px' }}
              >
                <option value="">All Brands / General</option>
                {companies.map(c => (
                  <option key={c._id || c.id} value={c._id || c.id}>{c.companyName}</option>
                ))}
              </select>
            </div>

            {/* Salesperson */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Salesperson
              </label>
              <input
                type="text"
                name="salesperson"
                className="form-control"
                value={headerData.salesperson}
                onChange={handleHeaderChange}
                placeholder="Enter salesperson name"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Quotation Format */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Presentation Format (8 Layouts)
              </label>
              <select
                name="formatKey"
                className="form-control"
                value={headerData.formatKey || 'STANDARD'}
                onChange={(e) => {
                  const key = e.target.value;
                  const matched = availableFormats.find(f => f.formatKey === key || f.name === key);
                  setHeaderData(prev => ({
                    ...prev,
                    formatKey: key,
                    quotationType: matched?.name || key
                  }));
                }}
                style={{ height: '42px', borderRadius: '8px', fontWeight: 600, color: '#2563eb' }}
              >
                <option value="STANDARD">1. Standard Customer Quotation (STANDARD)</option>
                <option value="WITH_GST">2. Quotation With GST Breakdown (WITH_GST)</option>
                <option value="DISCOUNT">3. Discounted Quotation (DISCOUNT)</option>
                <option value="MRP">4. MRP Quotation (MRP)</option>
                <option value="PLUMBER">5. Plumber Quotation (PLUMBER)</option>
                <option value="DETAILED">6. Detailed Breakdown Quotation (DETAILED)</option>
                <option value="PENDING">7. Pending Items Quotation (PENDING)</option>
                <option value="WITHOUT_SKU">8. Quotation Without SKU Code (WITHOUT_SKU)</option>
              </select>
            </div>

            {/* Validity Period */}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Validity Period
              </label>
              <input
                type="text"
                name="validity"
                className="form-control"
                value={headerData.validity}
                onChange={handleHeaderChange}
                placeholder="15 Days"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Reference */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Reference / Architect
              </label>
              <input
                type="text"
                name="reference"
                className="form-control"
                value={headerData.reference}
                onChange={handleHeaderChange}
                placeholder="e.g. Architect Manish / Site Visit"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Remarks / Special Notes */}
            <div style={{ gridColumn: 'span 3' }}>
              <label style={{ fontWeight: 600, fontSize: '0.825rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Remarks / Notes
              </label>
              <input
                type="text"
                name="remarks"
                className="form-control"
                value={headerData.remarks}
                onChange={handleHeaderChange}
                placeholder="e.g. Free delivery on ground floor"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Product Items Table Section */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Layers size={18} style={{ color: '#2563eb' }} />
                <span>Product Items</span>
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '20px', fontWeight: 600 }}>
                {items.length} {items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Brand Filter for Item Selection */}
              {companies.length > 0 && (
                <select
                  className="form-control"
                  value={selectedBrandFilter}
                  onChange={(e) => setSelectedBrandFilter(e.target.value)}
                  style={{ height: '36px', fontSize: '0.8rem', borderRadius: '8px', minWidth: '150px' }}
                >
                  <option value="">Filter Brand: All</option>
                  {companies.map(c => (
                    <option key={c._id || c.id} value={c.companyName}>{c.companyName}</option>
                  ))}
                </select>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => addItemWithSku()}
                style={{
                  height: '36px',
                  padding: '0 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  backgroundColor: '#eff6ff',
                  color: '#2563eb',
                  border: '1px solid #bfdbfe'
                }}
              >
                <Plus size={14} /> Add Product
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addItemWithoutSku}
                style={{
                  height: '36px',
                  padding: '0 0.85rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Plus size={14} /> Add Ad-hoc / SKU-less
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              backgroundColor: '#f8fafc',
              borderRadius: '10px',
              border: '1.5px dashed #cbd5e1'
            }}>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1rem 0' }}>
                No product items added yet. Click an option below to add products to this quotation.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => addItemWithSku()}
                  style={{ height: '38px', padding: '0 1rem', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  <Plus size={15} /> Add Product
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={addItemWithoutSku}
                  style={{ height: '38px', padding: '0 1rem', fontSize: '0.85rem', borderRadius: '8px', fontWeight: 600 }}
                >
                  <Plus size={15} /> Add Custom Item Without SKU
                </button>
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'hidden', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '13%' }}>Area / Room</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '28%' }}>Product / SKU Code</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '10%' }}>Brand</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '8%', textAlign: 'right' }}>MRP (₹)</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '7%', textAlign: 'center' }}>Qty</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '8%', textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '6%', textAlign: 'center' }}>Disc %</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '6%', textAlign: 'center' }}>GST %</th>
                    <th style={{ padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '10%', textAlign: 'right' }}>Net Amount</th>
                    <th style={{ padding: '0.65rem 0.25rem', width: '4%', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedItems.map((item, idx) => (
                    <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {/* Area */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <input
                            type="text"
                            className="table-input"
                            value={item.area}
                            onChange={(e) => handleItemChange(idx, 'area', e.target.value)}
                            placeholder="Area name"
                            style={{ height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                          />
                          {/* Quick Area Chips */}
                          <div style={{ display: 'flex', gap: '0.2rem', flexWrap: 'wrap' }}>
                            {COMMON_AREAS.slice(0, 3).map(areaChip => (
                              <button
                                key={areaChip}
                                type="button"
                                onClick={() => handleItemChange(idx, 'area', areaChip)}
                                style={{
                                  border: 'none',
                                  background: item.area === areaChip ? '#eff6ff' : '#f1f5f9',
                                  color: item.area === areaChip ? '#2563eb' : '#64748b',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  padding: '1px 4px',
                                  cursor: 'pointer'
                                }}
                              >
                                {areaChip}
                              </button>
                            ))}
                          </div>
                        </div>
                      </td>

                      {/* Product Selector */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        {availableProducts.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <select
                              className="table-select"
                              value={item.productId || item.sku}
                              onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                              style={{ height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                            >
                              <option value="">-- Custom / Manual Item --</option>
                              {filteredProducts.map(p => (
                                <option key={p.id || p._id} value={p.id || p._id}>
                                  [{p.company || 'Gen'}] {p.sku || p.companySku} - {p.productName}
                                </option>
                              ))}
                            </select>
                            {!item.productId && (
                              <input
                                type="text"
                                className="table-input"
                                placeholder="Type item name / description..."
                                value={item.productName}
                                onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                                style={{ height: '32px', borderRadius: '6px', fontSize: '0.825rem' }}
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="table-input"
                            placeholder="Type product description..."
                            value={item.productName}
                            onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                            style={{ height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                          />
                        )}
                      </td>

                      {/* Brand */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          className="table-input"
                          value={item.company}
                          onChange={(e) => handleItemChange(idx, 'company', e.target.value)}
                          placeholder="Brand"
                          style={{ height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                        />
                      </td>

                      {/* MRP */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="table-input"
                          value={item.mrp}
                          onChange={(e) => handleItemChange(idx, 'mrp', e.target.value)}
                          onKeyDown={handleNumberKeyDown}
                          onFocus={handleNumberFocus}
                          style={{ textAlign: 'right', height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                        />
                      </td>

                      {/* Qty */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="table-input"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          onKeyDown={handleNumberKeyDown}
                          onFocus={handleNumberFocus}
                          style={{ textAlign: 'center', height: '36px', borderRadius: '6px', fontWeight: 700, fontSize: '0.825rem' }}
                        />
                      </td>

                      {/* Rate */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="table-input"
                          value={item.rate}
                          onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                          onKeyDown={handleNumberKeyDown}
                          onFocus={handleNumberFocus}
                          style={{ textAlign: 'right', height: '36px', borderRadius: '6px', fontWeight: 600, fontSize: '0.825rem' }}
                        />
                      </td>

                      {/* Discount % */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="table-input"
                          value={item.discountPercent}
                          onChange={(e) => handleItemChange(idx, 'discountPercent', e.target.value)}
                          onKeyDown={handleNumberKeyDown}
                          onFocus={handleNumberFocus}
                          style={{ textAlign: 'center', height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                        />
                      </td>

                      {/* GST % */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top' }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          className="table-input"
                          value={item.gstPercent}
                          onChange={(e) => handleItemChange(idx, 'gstPercent', e.target.value)}
                          onKeyDown={handleNumberKeyDown}
                          onFocus={handleNumberFocus}
                          style={{ textAlign: 'center', height: '36px', borderRadius: '6px', fontSize: '0.825rem' }}
                        />
                      </td>

                      {/* Net Amount */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: '#2563eb', fontSize: '0.875rem', height: '36px', lineHeight: '36px' }}>
                        {formatCurrency(item.netAmount)}
                      </td>

                      {/* Delete button */}
                      <td style={{ padding: '0.65rem 0.5rem', verticalAlign: 'top', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          style={{
                            border: 'none',
                            background: '#fef2f2',
                            color: '#dc2626',
                            borderRadius: '6px',
                            width: '32px',
                            height: '36px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Card 3: Quotation Summary Calculations */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            Financial Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Gross Total</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{formatCurrency(totals.grossTotal)}</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: '#fefce8', border: '1px solid #fef9c3' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#a16207', display: 'block', textTransform: 'uppercase' }}>Total Discount</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#854d0e', marginTop: '0.2rem' }}>- {formatCurrency(totals.discountTotal)}</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', display: 'block', textTransform: 'uppercase' }}>Taxable Amount</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>{formatCurrency(totals.taxableTotal)}</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#0284c7', display: 'block', textTransform: 'uppercase' }}>GST Tax Amount</span>
              <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0369a1', marginTop: '0.2rem' }}>+ {formatCurrency(totals.gstTotal)}</div>
            </div>
            <div style={{ padding: '0.85rem', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2563eb', display: 'block', textTransform: 'uppercase' }}>Final Quotation Amount</span>
              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>{formatCurrency(totals.finalTotal)}</div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '0.85rem'
        }}>
          <Link 
            to={backLink} 
            className="btn btn-secondary"
            style={{ borderRadius: '10px', height: '44px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.9rem' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              borderRadius: '10px',
              height: '44px',
              padding: '0 1.75rem',
              fontWeight: 700,
              fontSize: '0.925rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Saving...</span>
              </>
            ) : (
              <span>{isEdit ? 'Save Quotation' : 'Generate Quotation'}</span>
            )}
          </button>
        </div>

      </form>
    </div>
  );
};

export default CreateQuotation;
