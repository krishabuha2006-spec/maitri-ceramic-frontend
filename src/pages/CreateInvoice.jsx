import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getQuotations } from '../services/quotationService';
import { getProducts } from '../services/productService';
import { createInvoice } from '../services/invoiceService';
import { formatCurrency, numberToWords } from '../utils/formatters';
import { ArrowLeft, Plus, Trash2, FileText, CheckCircle2, AlertCircle, Save, RefreshCw } from 'lucide-react';

export const CreateInvoice = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    invoiceNumber: `INV-2026-00${Math.floor(Math.random() * 900) + 100}`,
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    customerMobile: '',
    buyerBillTo: '',
    consigneeShipTo: '',
    refNumber: '',
    buyersOrderNo: '',
    dispatchDocNo: '',
    deliveryNote: '',
    termsOfPayment: '30% Advance, 70% against delivery',
    termsOfDelivery: 'FOR Site Ahmedabad'
  });

  const [items, setItems] = useState([
    {
      sku: 'VT-60120-GL',
      productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
      hsnCode: '69072100',
      quantity: 1150,
      unit: 'Sq.Ft',
      rate: 72.00,
      discount: 5.0,
      gstPercent: 18
    }
  ]);

  useEffect(() => {
    Promise.all([getCustomers(), getQuotations(), getProducts()]).then(([cRes, qRes, pRes]) => {
      setCustomers(cRes.data || []);
      setQuotations(qRes.data || []);
      setProducts(pRes.data || []);
    });
  }, []);

  const handleCustomerSelect = (e) => {
    const custId = e.target.value;
    setFormError('');
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setFormData(prev => ({
        ...prev,
        customerId: cust.id,
        customerName: cust.name,
        customerMobile: cust.mobile,
        buyerBillTo: `${cust.name}, ${cust.billingAddress || ''}, ${cust.city}. GSTIN: ${cust.gstNumber || 'N/A'}`,
        consigneeShipTo: cust.shippingAddress || cust.billingAddress || cust.city
      }));
    } else {
      setFormData(prev => ({ ...prev, customerId: '', customerName: '', buyerBillTo: '', consigneeShipTo: '' }));
    }
  };

  const handleQuotationSelect = (e) => {
    const qNo = e.target.value;
    setFormError('');
    const qt = quotations.find(q => q.quotationNumber === qNo);
    if (qt) {
      setFormData(prev => ({
        ...prev,
        refNumber: qt.quotationNumber,
        buyersOrderNo: `ORD-${qt.quotationNumber.replace('QT-', '')}`,
        customerId: qt.customerId || prev.customerId,
        customerName: qt.customerName || prev.customerName,
        buyerBillTo: prev.buyerBillTo || (qt.customerName ? `${qt.customerName}, ${qt.customerAddress || ''}` : '')
      }));
      if (Array.isArray(qt.items) && qt.items.length > 0) {
        setItems(qt.items.map(i => ({
          sku: i.sku || 'CUSTOM',
          productName: i.productName,
          hsnCode: i.hsnCode || '69072100',
          quantity: i.actualIssuedQty || i.confirmedQty || i.quantity || 1,
          unit: i.unit || 'Sq.Ft',
          rate: i.rate || 0,
          discount: i.discountPercent || 0,
          gstPercent: i.gstPercent || 18
        })));
      }
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' || field === 'rate' || field === 'discount' || field === 'gstPercent' ? Number(value) : value;
    setItems(updated);
    if (formError) setFormError('');
  };

  const addItem = () => {
    setItems([...items, { sku: '', productName: '', hsnCode: '69072100', quantity: 1, unit: 'Sq.Ft', rate: 0, discount: 0, gstPercent: 18 }]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  // Computations
  const computedItems = items.map(item => {
    const gross = ((item.rate || 0) * (item.quantity || 0));
    const discAmt = (gross * (item.discount || 0)) / 100;
    const taxable = gross - discAmt;
    const gstAmt = (taxable * (item.gstPercent || 0)) / 100;
    const net = taxable + gstAmt;
    return {
      ...item,
      taxableAmount: Number(taxable.toFixed(2)),
      gstAmount: Number(gstAmt.toFixed(2)),
      amount: Number(net.toFixed(2))
    };
  });

  const taxableTotal = computedItems.reduce((sum, i) => sum + i.taxableAmount, 0);
  const totalGst = computedItems.reduce((sum, i) => sum + i.gstAmount, 0);
  const finalTotal = taxableTotal + totalGst;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.customerName.trim()) {
      setFormError('Please select a customer or choose a quotation reference.');
      return;
    }

    if (items.length === 0) {
      setFormError('Please add at least one line item to the invoice.');
      return;
    }

    setSaving(true);
    try {
      await createInvoice({
        ...formData,
        items: computedItems,
        taxableTotal,
        cgstAmount: totalGst / 2,
        sgstAmount: totalGst / 2,
        totalGst,
        finalTotal,
        amountInWords: numberToWords(finalTotal)
      });
      setSuccessToast(`Tax Invoice ${formData.invoiceNumber} created successfully!`);
      setTimeout(() => {
        navigate('/invoices');
      }, 900);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error creating sales invoice.');
    } finally {
      setSaving(false);
    }
  };

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
        <Link 
          to="/invoices" 
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
          <span>Back to Invoices</span>
        </Link>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Create Sales Invoice
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            GST Compliant Tax Billing & Sales Revenue Entry
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
        {/* Card 1: Buyer, Consignee & Dispatch Information */}
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
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Buyer, Consignee & Dispatch Information
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Invoice number, customer GST details, billing & shipping address, and delivery terms
              </p>
            </div>
          </div>

          {/* Quotation Auto-fill Banner */}
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem'
          }}>
            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0369a1', display: 'block', marginBottom: '0.4rem' }}>
              Link Quotation (Auto-fills Customer Details & Products)
            </label>
            <select
              className="form-control"
              value={formData.refNumber}
              onChange={handleQuotationSelect}
              style={{ height: '42px', borderRadius: '8px', borderColor: '#7dd3fc', backgroundColor: '#ffffff', fontSize: '0.875rem' }}
            >
              <option value="">-- Optional Quotation Reference --</option>
              {quotations.map(q => (
                <option key={q.id || q._id} value={q.quotationNumber}>
                  {q.quotationNumber} - {q.customerName} (₹{q.quotationAmount?.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Invoice Number */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Invoice Number
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.invoiceNumber}
                readOnly
                style={{ height: '44px', borderRadius: '8px', backgroundColor: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
              />
            </div>

            {/* Invoice Date */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Invoice Date
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

            {/* Select Customer */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Select Customer <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.customerId}
                onChange={handleCustomerSelect}
                required
                style={{ height: '44px', borderRadius: '8px' }}
              >
                <option value="">-- Choose Customer --</option>
                {customers.map(c => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name} ({c.mobile || c.phone || 'No Mobile'})
                  </option>
                ))}
              </select>
            </div>

            {/* Buyer's Order Number */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Buyer's Order Number
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.buyersOrderNo}
                onChange={(e) => setFormData({ ...formData, buyersOrderNo: e.target.value })}
                placeholder="e.g. ORD-2026-001"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Buyer / Bill To Address & GSTIN */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Buyer / Bill To Address & GSTIN
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.buyerBillTo}
                onChange={(e) => setFormData({ ...formData, buyerBillTo: e.target.value })}
                placeholder="Enter buyer billing address & GSTIN number"
                required
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Consignee / Ship To Site Address */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Consignee / Ship To Site Address
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.consigneeShipTo}
                onChange={(e) => setFormData({ ...formData, consigneeShipTo: e.target.value })}
                placeholder="Enter consignee shipping site address"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Dispatch Document Number */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Dispatch Doc No. (Challan)
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.dispatchDocNo}
                onChange={(e) => setFormData({ ...formData, dispatchDocNo: e.target.value })}
                placeholder="e.g. CH-2026-001"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Terms of Payment */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Terms of Payment
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.termsOfPayment}
                onChange={(e) => setFormData({ ...formData, termsOfPayment: e.target.value })}
                placeholder="e.g. 30% Advance, 70% delivery"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Terms of Delivery */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Terms of Delivery
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.termsOfDelivery}
                onChange={(e) => setFormData({ ...formData, termsOfDelivery: e.target.value })}
                placeholder="e.g. FOR Site Ahmedabad"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Line Items Table Section */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
          padding: '1.75rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Invoice Line Items
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                Product details, HSN codes, rates, discounts, and GST calculation
              </p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={addItem}
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
              <Plus size={14} /> Add Item
            </button>
          </div>

          <div style={{ overflowX: 'hidden', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ width: '32%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Product Description</th>
                  <th style={{ width: '12%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>HSN</th>
                  <th style={{ width: '9%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Qty</th>
                  <th style={{ width: '8%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Unit</th>
                  <th style={{ width: '11%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Rate (₹)</th>
                  <th style={{ width: '7%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Disc%</th>
                  <th style={{ width: '7%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>GST%</th>
                  <th style={{ width: '10%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Net Amount</th>
                  <th style={{ width: '4%', padding: '0.65rem 0.25rem', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {computedItems.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="text"
                        className="table-input"
                        value={item.productName}
                        onChange={(e) => handleItemChange(idx, 'productName', e.target.value)}
                        placeholder="Product name"
                        required
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="text"
                        className="table-input"
                        value={item.hsnCode}
                        onChange={(e) => handleItemChange(idx, 'hsnCode', e.target.value)}
                        placeholder="HSN"
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        className="table-input"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="text"
                        className="table-input"
                        value={item.unit}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        step="0.01"
                        className="table-input"
                        value={item.rate}
                        onChange={(e) => handleItemChange(idx, 'rate', e.target.value)}
                        required
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        step="0.1"
                        className="table-input"
                        value={item.discount}
                        onChange={(e) => handleItemChange(idx, 'discount', e.target.value)}
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="number"
                        className="table-input"
                        value={item.gstPercent}
                        onChange={(e) => handleItemChange(idx, 'gstPercent', e.target.value)}
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top', textAlign: 'right', fontWeight: 700, color: '#0f172a', fontSize: '0.85rem' }}>
                      {formatCurrency(item.amount)}
                    </td>
                    <td style={{ padding: '0.5rem 0.25rem', verticalAlign: 'top', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{
                          border: 'none',
                          background: '#fef2f2',
                          color: '#dc2626',
                          borderRadius: '6px',
                          width: '30px',
                          height: '34px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card 3: Summary Breakdown */}
        <div style={{
          backgroundColor: '#f8fafc',
          borderRadius: '14px',
          border: '1px solid #e2e8f0',
          padding: '1.5rem 1.75rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Taxable Amount
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginTop: '0.2rem' }}>
                {formatCurrency(taxableTotal)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total GST Tax (18%)
              </span>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0284c7', marginTop: '0.2rem' }}>
                {formatCurrency(totalGst)}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Grand Total Invoice
              </span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '0.2rem' }}>
                {formatCurrency(finalTotal)}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', color: '#475569', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
            <strong>Amount in Words:</strong> <span style={{ fontStyle: 'italic', color: '#1e293b' }}>{numberToWords(finalTotal)}</span>
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
          <Link 
            to="/invoices" 
            className="btn btn-secondary"
            style={{ borderRadius: '10px', height: '44px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
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
              fontSize: '0.9rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Creating Invoice...</span>
              </>
            ) : (
              <>
                <FileText size={18} />
                <span>Generate Tax Invoice</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateInvoice;
