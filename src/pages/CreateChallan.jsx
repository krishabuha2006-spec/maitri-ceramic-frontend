import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getQuotations } from '../services/quotationService';
import { createChallan } from '../services/challanService';
import { ArrowLeft, Truck, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Save } from 'lucide-react';

export const CreateChallan = () => {
  const navigate = useNavigate();
  const [confirmedQuotations, setConfirmedQuotations] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    challanNumber: `CH-2026-00${Math.floor(Math.random() * 900) + 100}`,
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    customerContact: '',
    customerAddress: '',
    refQuotationNo: '',
    refOrderNo: '',
    salesperson: 'Vikram Mehta',
    driverName: 'Ramesh Patel',
    vehicleNo: 'GJ-01-AB-1234',
    deliveryDetails: 'Dispatched via tempo/truck. Handle ceramic materials with care.',
    remarks: 'Material dispatched for site installation',
    status: 'Dispatched'
  });

  const [items, setItems] = useState([
    {
      sku: 'VT-60120-GL',
      productName: 'Glazed Vitrified Tile 600x1200mm Statuario',
      description: 'Statuario Marble Finish Heavy Duty',
      quantity: 500,
      unit: 'Sq.Ft'
    }
  ]);

  useEffect(() => {
    getQuotations().then(res => {
      const qts = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setConfirmedQuotations(qts.filter(q => q.status === 'Confirmed' || q.status === 'Customer Interested'));
    });
  }, []);

  const handleQuotationSelect = (e) => {
    const qNo = e.target.value;
    setFormError('');
    const qt = confirmedQuotations.find(q => q.quotationNumber === qNo);
    if (qt) {
      setFormData(prev => ({
        ...prev,
        customerId: qt.customerId || qt.id,
        customerName: qt.customerName || '',
        customerContact: qt.customerContact || '',
        customerAddress: qt.customerAddress || '',
        refQuotationNo: qt.quotationNumber,
        refOrderNo: `ORD-${qt.quotationNumber.replace('QT-', '')}`,
        salesperson: qt.salesperson || 'Vikram Mehta'
      }));

      if (Array.isArray(qt.items) && qt.items.length > 0) {
        setItems(qt.items.map(i => ({
          sku: i.sku || 'CUSTOM',
          productName: i.productName || 'Ceramic Tile',
          description: i.description || '',
          quantity: i.actualIssuedQty || i.confirmedQty || i.quantity || 1,
          unit: i.unit || 'Sq.Ft'
        })));
      }
    } else {
      setFormData(prev => ({ ...prev, refQuotationNo: '', customerName: '', customerContact: '', customerAddress: '' }));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' ? Number(value) : value;
    setItems(updated);
    if (formError) setFormError('');
  };

  const addItem = () => {
    setItems([...items, { sku: '', productName: '', description: '', quantity: 1, unit: 'Sq.Ft' }]);
  };

  const removeItem = (idx) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.customerName.trim()) {
      setFormError('Please enter a customer name or select a confirmed quotation.');
      return;
    }

    if (items.length === 0) {
      setFormError('Please add at least one item to dispatch.');
      return;
    }

    setSaving(true);
    try {
      await createChallan({
        ...formData,
        items
      });
      setSuccessToast(`Delivery Challan ${formData.challanNumber} created! Physical stock has been deducted.`);
      setTimeout(() => {
        navigate('/challans');
      }, 900);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error creating delivery challan.');
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
          to="/challans" 
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
          <span>Back to Challans</span>
        </Link>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Create Delivery Challan
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Material Dispatch & Stock Deduction
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
        {/* Card 1: Challan & Dispatch Information */}
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
              <Truck size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Challan & Dispatch Information
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Log dispatch numbers, customer site details, and driver info
              </p>
            </div>
          </div>

          {/* Quotation Link Banner */}
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem'
          }}>
            <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0369a1', display: 'block', marginBottom: '0.4rem' }}>
              Link Confirmed Quotation (Auto-fills Items & Customer Details)
            </label>
            <select
              className="form-control"
              value={formData.refQuotationNo}
              onChange={handleQuotationSelect}
              style={{ height: '42px', borderRadius: '8px', borderColor: '#7dd3fc', backgroundColor: '#ffffff', fontSize: '0.875rem' }}
            >
              <option value="">-- Choose Confirmed Quotation --</option>
              {confirmedQuotations.map(q => (
                <option key={q.id || q._id} value={q.quotationNumber}>
                  {q.quotationNumber} - {q.customerName} ({q.status})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Challan Number */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Challan Number
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.challanNumber}
                readOnly
                style={{ height: '44px', borderRadius: '8px', backgroundColor: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
              />
            </div>

            {/* Dispatch Date */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Dispatch Date
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
                placeholder="Enter customer name"
                required
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Customer Contact Phone */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Customer Contact Phone
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.customerContact}
                onChange={(e) => setFormData({ ...formData, customerContact: e.target.value })}
                placeholder="Enter contact number"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Delivery Site Address */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Delivery Site Address
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.customerAddress}
                onChange={(e) => setFormData({ ...formData, customerAddress: e.target.value })}
                placeholder="Enter delivery site address"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Driver Name */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Driver Name
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.driverName}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                placeholder="Enter driver name"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Vehicle Number */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Vehicle Number
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.vehicleNo}
                onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                placeholder="e.g. GJ-01-AB-1234"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Delivery Details & Special Instructions */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Delivery Details & Special Instructions
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.deliveryDetails}
                onChange={(e) => setFormData({ ...formData, deliveryDetails: e.target.value })}
                placeholder="e.g. Dispatched via tempo/truck. Handle ceramic materials with care."
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>
          </div>
        </div>

        {/* Card 2: Dispatched Items Table Section */}
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
                Dispatched Items (Stock Deduction)
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                Items specified here will be automatically deducted from physical warehouse stock
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
                  <th style={{ width: '16%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>SKU</th>
                  <th style={{ width: '34%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Product Name</th>
                  <th style={{ width: '24%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ width: '12%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Quantity</th>
                  <th style={{ width: '8%', padding: '0.65rem 0.5rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Unit</th>
                  <th style={{ width: '6%', padding: '0.65rem 0.25rem', textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.5rem 0.5rem', verticalAlign: 'top' }}>
                      <input
                        type="text"
                        className="table-input"
                        value={item.sku}
                        onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                        placeholder="SKU"
                      />
                    </td>
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
                        value={item.description}
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        placeholder="Description"
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
                    <td style={{ padding: '0.5rem 0.25rem', verticalAlign: 'top', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{
                          border: 'none',
                          background: '#fef2f2',
                          color: '#dc2626',
                          borderRadius: '6px',
                          width: '32px',
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
            to="/challans" 
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
                <span>Creating...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Finalize Challan & Deduct Stock</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateChallan;
