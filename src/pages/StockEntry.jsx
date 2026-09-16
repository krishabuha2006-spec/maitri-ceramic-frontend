import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getProducts } from '../services/productService';
import { createStockEntry } from '../services/stockService';
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
    sku: '',
    productName: '',
    quantity: 100,
    unit: 'Sq.Ft',
    type: 'Stock In',
    reason: 'New Goods Purchase / Consignment Received',
    referenceDoc: '',
    remarks: ''
  });

  useEffect(() => {
    getProducts().then(res => {
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
        sku: prd.sku,
        productName: prd.productName || '',
        unit: prd.unit || 'Sq.Ft'
      }));
    } else {
      setFormData(prev => ({ ...prev, sku: selectedSku, productName: '', unit: 'Sq.Ft' }));
    }
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

    if (!formData.sku) {
      setFormError('Please select a product SKU.');
      return;
    }
    if (Number(formData.quantity) <= 0) {
      setFormError('Quantity must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      await createStockEntry(formData);
      setSuccessToast('Stock transaction saved successfully!');
      setTimeout(() => {
        navigate('/stock');
      }, 800);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Failed to save stock entry.');
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
          to="/stock" 
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
          <span>Back to Stock</span>
        </Link>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Record Stock Transaction Entry
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.15rem 0 0 0' }}>
            Log physical inventory stock in/out adjustments and warehouse consignment movements.
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
        {/* Main Card */}
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
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Stock Transaction Information
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Entry number, product SKU selection, quantity, transaction type and document references
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Stock Entry Number */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Stock Entry Number
              </label>
              <input
                type="text"
                name="entryNumber"
                className="form-control"
                value={formData.entryNumber}
                onChange={handleChange}
                required
                style={{ height: '46px', borderRadius: '10px', fontWeight: 700, color: '#0f172a' }}
              />
            </div>

            {/* Transaction Date */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Transaction Date
              </label>
              <input
                type="date"
                name="date"
                className="form-control"
                value={formData.date}
                onChange={handleChange}
                required
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Select Product SKU */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Select Product SKU <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.sku}
                onChange={handleSkuChange}
                required
                style={{ height: '46px', borderRadius: '10px', borderColor: formError && !formData.sku ? '#f87171' : '#cbd5e1' }}
              >
                <option value="">-- Choose SKU --</option>
                {products.map(p => (
                  <option key={p.id || p._id} value={p.sku}>
                    {p.sku} - {p.productName}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Name (Auto Populated) */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Product Name (Auto Populated)
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.productName}
                readOnly
                placeholder="Product name will auto-populate"
                style={{ height: '46px', borderRadius: '10px', backgroundColor: '#f8fafc', fontWeight: 600, color: '#334155' }}
              />
            </div>

            {/* Transaction Type */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Transaction Type <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                name="type"
                className="form-control"
                value={formData.type}
                onChange={handleChange}
                style={{ height: '46px', borderRadius: '10px' }}
              >
                <option value="Stock In">Stock In (+ Increases Actual Stock)</option>
                <option value="Stock Out">Stock Out (- Decreases Actual Stock)</option>
              </select>
            </div>

            {/* Quantity */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Quantity <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                name="quantity"
                className="form-control"
                value={formData.quantity}
                onChange={handleChange}
                required
                style={{ height: '46px', borderRadius: '10px', fontWeight: 600 }}
              />
            </div>

            {/* Measurement Unit */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Measurement Unit
              </label>
              <input
                type="text"
                name="unit"
                className="form-control"
                value={formData.unit}
                onChange={handleChange}
                placeholder="Sq.Ft / Pcs / Box"
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Reason for Entry */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Reason for Entry
              </label>
              <input
                type="text"
                name="reason"
                className="form-control"
                value={formData.reason}
                onChange={handleChange}
                placeholder="Enter purchase or adjustment reason"
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Reference Document No. */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Reference Document Number
              </label>
              <input
                type="text"
                name="referenceDoc"
                className="form-control"
                value={formData.referenceDoc}
                onChange={handleChange}
                placeholder="Enter reference PO or invoice number"
                style={{ height: '46px', borderRadius: '10px' }}
              />
            </div>

            {/* Remarks / Warehouse Notes */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.875rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Remarks / Warehouse Notes
              </label>
              <textarea
                name="remarks"
                className="form-control"
                rows="3"
                value={formData.remarks}
                onChange={handleChange}
                placeholder="Enter internal warehouse notes or remarks..."
                style={{ borderRadius: '10px' }}
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
          <Link 
            to="/stock" 
            className="btn btn-secondary"
            style={{ borderRadius: '10px', height: '46px', padding: '0 1.25rem', fontWeight: 600, fontSize: '0.9rem' }}
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{
              borderRadius: '10px',
              height: '46px',
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
              <>
                <Save size={18} />
                <span>Save Stock Entry</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default StockEntry;
