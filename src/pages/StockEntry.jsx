import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getProducts } from '../services/productService';
import stockService, { createStockEntry } from '../services/stockService';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Save, Layers } from 'lucide-react';

export const StockEntry = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    entryNumber: `SE-2026-00${Math.floor(Math.random() * 900) + 100}`,
    date: new Date().toISOString().split('T')[0],
    productId: '',
    sku: '',
    productName: '',
    quantity: 100,
    unit: 'Sq.Ft',
    type: 'Stock In',
    direction: 'IN',
    reason: 'PURCHASE_ENTRY',
    referenceDocNote: '',
    remarks: ''
  });

  useEffect(() => {
    getProducts({ limit: 500 }).then(res => {
      const pList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setProducts(pList);
    });
  }, []);

  const handleSkuChange = (e) => {
    const selectedSku = e.target.value;
    setFormError('');
    const prd = products.find(p => p.sku === selectedSku);
    if (prd) {
      setFormData(prev => ({
        ...prev,
        productId: prd._id || prd.id || '',
        sku: prd.sku,
        productName: prd.productName || '',
        unit: prd.unit || 'Sq.Ft'
      }));
    } else {
      setFormData(prev => ({ ...prev, productId: '', sku: selectedSku, productName: '', unit: 'Sq.Ft' }));
    }
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    const isOut = newType === 'Stock Out';
    setFormData(prev => ({
      ...prev,
      type: newType,
      direction: isOut ? 'OUT' : 'IN',
      reason: isOut ? 'MANUAL_DEDUCTION' : 'PURCHASE_ENTRY'
    }));
  };

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
    if (formError) setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.productId && !formData.sku) {
      setFormError('Please select a valid product SKU.');
      return;
    }
    if (Number(formData.quantity) <= 0) {
      setFormError('Quantity must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await createStockEntry(formData);
      setSuccessToast('Stock transaction saved successfully to backend ledger!');
      setTimeout(() => {
        navigate('/stock');
      }, 900);
    } catch (err) {
      console.error('Save stock entry error:', err);
      setFormError(err.response?.data?.message || err.message || 'Failed to save stock entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', paddingBottom: '3rem', fontFamily: 'var(--font-family)' }}>
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
          to="/stock" 
          className="btn btn-secondary"
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
          <span>Back to Stock</span>
        </Link>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Record Stock Ledger Entry
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Log physical inventory adjustments directly to the immutable backend stock ledger
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
        {/* Main Card */}
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
              backgroundColor: formData.type === 'Stock In' ? '#f0fdf4' : '#fef2f2',
              color: formData.type === 'Stock In' ? '#16a34a' : '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Stock Entry Details
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Select product SKU, specify quantity, ledger reason and reference document
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Transaction Type */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Entry Direction <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.type}
                onChange={handleTypeChange}
                style={{ height: '42px', borderRadius: '8px', fontWeight: 600 }}
              >
                <option value="Stock In">Stock In (+ Increases Actual Stock)</option>
                <option value="Stock Out">Stock Out (- Decreases Actual Stock)</option>
              </select>
            </div>

            {/* Transaction Date */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Entry Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                name="date"
                className="form-control"
                value={formData.date}
                onChange={handleChange}
                required
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Select Product SKU */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Select Product SKU <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.sku}
                onChange={handleSkuChange}
                required
                style={{ height: '42px', borderRadius: '8px', borderColor: formError && !formData.sku ? '#f87171' : '#cbd5e1' }}
              >
                <option value="">-- Select Product / SKU --</option>
                {products.map(p => (
                  <option key={p._id || p.id} value={p.sku}>
                    {p.sku} - {p.productName}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name (Auto Populated) */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Product Description
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.productName}
                readOnly
                placeholder="Product name will auto-populate"
                style={{ height: '42px', borderRadius: '8px', backgroundColor: '#f8fafc', fontWeight: 600, color: '#334155' }}
              />
            </div>

            {/* Quantity */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Quantity <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                name="quantity"
                className="form-control"
                value={formData.quantity}
                onChange={handleChange}
                required
                min="1"
                style={{ height: '42px', borderRadius: '8px', fontWeight: 700 }}
              />
            </div>

            {/* Measurement Unit */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Unit
              </label>
              <input
                type="text"
                name="unit"
                className="form-control"
                value={formData.unit}
                onChange={handleChange}
                placeholder="Sq.Ft / Pcs / Box"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Reason for Entry (Matches Swagger Enum) */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Ledger Reason <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                name="reason"
                className="form-control"
                value={formData.reason}
                onChange={handleChange}
                style={{ height: '42px', borderRadius: '8px', fontWeight: 600 }}
              >
                {formData.type === 'Stock In' ? (
                  <>
                    <option value="PURCHASE_ENTRY">PURCHASE_ENTRY (Purchase Consignment Received)</option>
                    <option value="OPENING_STOCK">OPENING_STOCK (Opening Warehouse Stock)</option>
                    <option value="MANUAL_ADDITION">MANUAL_ADDITION (Manual Stock Addition / Correction)</option>
                    <option value="OTHER">OTHER (Other Inflow)</option>
                  </>
                ) : (
                  <>
                    <option value="MANUAL_DEDUCTION">MANUAL_DEDUCTION (Manual Deduction / Breakage / Scrap)</option>
                    <option value="OTHER">OTHER (Other Outflow)</option>
                  </>
                )}
              </select>
            </div>

            {/* Reference Document Note */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Reference Document Note
              </label>
              <input
                type="text"
                name="referenceDocNote"
                className="form-control"
                value={formData.referenceDocNote}
                onChange={handleChange}
                placeholder="e.g. PO-2026-8812 / Vendor Bill 441"
                style={{ height: '42px', borderRadius: '8px' }}
              />
            </div>

            {/* Remarks / Warehouse Notes */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Warehouse Remarks
              </label>
              <textarea
                name="remarks"
                className="form-control"
                rows="2"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Enter internal warehouse notes or remarks..."
                style={{ borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <Link 
            to="/stock" 
            className="btn btn-secondary"
            style={{ borderRadius: '8px', height: '42px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              borderRadius: '8px',
              height: '42px',
              padding: '0 1.5rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={16} className="spin-animation" />
                <span>Posting to Ledger...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Post Stock Entry</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockEntry;
