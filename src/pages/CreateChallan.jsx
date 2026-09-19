import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getConfirmations, getConfirmationById } from '../services/confirmationService';
import { createChallan, finalizeChallan } from '../services/challanService';
import { 
  ArrowLeft, 
  Truck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  PackageCheck, 
  FileText, 
  User, 
  MapPin, 
  Phone, 
  ShieldCheck,
  CheckSquare,
  Square
} from 'lucide-react';

export const CreateChallan = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedConfirmationId = searchParams.get('confirmationId') || '';

  const [confirmations, setConfirmations] = useState([]);
  const [loadingConfirmations, setLoadingConfirmations] = useState(true);
  const [selectedConfirmationId, setSelectedConfirmationId] = useState(preselectedConfirmationId);
  const [selectedConfirmation, setSelectedConfirmation] = useState(null);

  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [remarks, setRemarks] = useState('');

  // Item states: [{ confirmedItemId, sku, productName, unit, confirmedQty, deliveredQty, balanceQty, quantityToIssue, selected, remarks }]
  const [items, setItems] = useState([]);

  const [saving, setSaving] = useState(false);
  const [finalizeDirectly, setFinalizeDirectly] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Fetch all active quotation confirmations from backend Module 7
  useEffect(() => {
    const fetchConfirmations = async () => {
      setLoadingConfirmations(true);
      try {
        const res = await getConfirmations({ limit: 100 });
        const list = Array.isArray(res?.data) ? res.data : [];
        // Filter confirmations that are not fully delivered
        const activeList = list.filter(c => !c.isFullyDelivered && (c.isActive !== false));
        setConfirmations(activeList);

        if (preselectedConfirmationId) {
          const found = list.find(c => String(c._id) === String(preselectedConfirmationId) || String(c.id) === String(preselectedConfirmationId));
          if (found) {
            setSelectedConfirmationId(found._id || found.id);
            setupConfirmationData(found);
          }
        }
      } catch (err) {
        console.error('Failed to fetch confirmations:', err);
      } finally {
        setLoadingConfirmations(false);
      }
    };

    fetchConfirmations();
  }, [preselectedConfirmationId]);

  const setupConfirmationData = (conf) => {
    setSelectedConfirmation(conf);
    setFormError('');

    // Pre-populate items from confirmation
    const rawItems = conf.confirmedItems || [];
    const mapped = rawItems.map(item => {
      const confirmedQty = Number(item.confirmedQuantity || 0);
      const extraQty = Number(item.extraQuantity || 0);
      const deliveredQty = Number(item.deliveredQuantity || 0);
      const totalAllowed = confirmedQty + extraQty;
      const balanceQty = Math.max(0, totalAllowed - deliveredQty);

      return {
        confirmedItemId: item._id || item.id,
        sku: item.skuCodeSnapshot || item.product?.companySkuCode || item.product?.sku || 'SKU',
        productName: item.productNameSnapshot || item.product?.productName || 'Product',
        unit: item.product?.unit?.unitName || 'Pcs',
        confirmedQty: totalAllowed,
        deliveredQty,
        balanceQty,
        quantityToIssue: balanceQty > 0 ? balanceQty : 0,
        selected: balanceQty > 0,
        remarks: ''
      };
    });

    setItems(mapped);

    // Suggest default delivery details if available from customer shipping address
    const cust = conf.quotation?.customer || conf.customer || {};
    const shipping = cust.shippingAddress || cust.billingAddress || '';
    if (!deliveryDetails && shipping) {
      setDeliveryDetails(`Site Delivery: ${shipping}`);
    }
  };

  const handleConfirmationChange = (e) => {
    const id = e.target.value;
    setSelectedConfirmationId(id);
    if (!id) {
      setSelectedConfirmation(null);
      setItems([]);
      return;
    }
    const conf = confirmations.find(c => String(c._id) === String(id) || String(c.id) === String(id));
    if (conf) {
      setupConfirmationData(conf);
    }
  };

  const handleItemToggle = (index) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index].selected = !copy[index].selected;
      return copy;
    });
  };

  const handleQtyChange = (index, value) => {
    setItems(prev => {
      const copy = [...prev];
      const num = Number(value);
      copy[index].quantityToIssue = isNaN(num) ? 0 : num;
      return copy;
    });
  };

  const handleItemRemarksChange = (index, value) => {
    setItems(prev => {
      const copy = [...prev];
      copy[index].remarks = value;
      return copy;
    });
  };

  const handleSubmit = async (andFinalize = false) => {
    setFormError('');

    if (!selectedConfirmationId) {
      setFormError('Please select a Quotation Confirmation to create a Delivery Challan against.');
      return;
    }

    const selectedItems = items.filter(i => i.selected && i.quantityToIssue > 0);

    if (selectedItems.length === 0) {
      setFormError('Please select at least one item with a quantity greater than 0 to dispatch.');
      return;
    }

    // Check bounds
    for (const item of selectedItems) {
      if (item.quantityToIssue > item.balanceQty) {
        setFormError(`Quantity for "${item.productName}" exceeds available balance of ${item.balanceQty} ${item.unit}.`);
        return;
      }
    }

    // Construct full delivery note string
    let fullDeliveryDetails = deliveryDetails.trim();
    if (vehicleNo.trim() || driverName.trim()) {
      const vehiclePart = [
        vehicleNo.trim() ? `Vehicle: ${vehicleNo.trim()}` : '',
        driverName.trim() ? `Driver: ${driverName.trim()}` : ''
      ].filter(Boolean).join(', ');
      
      fullDeliveryDetails = fullDeliveryDetails 
        ? `${vehiclePart} | ${fullDeliveryDetails}` 
        : vehiclePart;
    }

    setSaving(true);
    setFinalizeDirectly(andFinalize);

    try {
      const challanPayload = {
        confirmationId: selectedConfirmationId,
        deliveryDetails: fullDeliveryDetails,
        remarks: remarks.trim(),
        items: selectedItems.map(i => ({
          confirmedItemId: i.confirmedItemId,
          quantityToIssue: Number(i.quantityToIssue),
          remarks: i.remarks || ''
        }))
      };

      const created = await createChallan(challanPayload);
      const createdId = created._id || created.id;

      if (andFinalize && createdId) {
        await finalizeChallan(createdId);
        setSuccessToast(`Delivery Challan ${created.challanNumber} created & finalized! Stock deducted.`);
      } else {
        setSuccessToast(`Delivery Challan ${created.challanNumber} created as DRAFT.`);
      }

      setTimeout(() => {
        navigate('/challans');
      }, 1000);
    } catch (err) {
      console.error('Error creating challan:', err);
      setFormError(err.response?.data?.message || err.message || 'Error generating delivery challan from backend.');
    } finally {
      setSaving(false);
    }
  };

  const customerObj = selectedConfirmation?.quotation?.customer || selectedConfirmation?.customer || {};
  const quotationObj = selectedConfirmation?.quotation || {};

  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', paddingBottom: '3.5rem', fontFamily: 'var(--font-family)' }}>
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

      {/* Top Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to="/challans" 
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              borderRadius: '8px',
              padding: '0.55rem 0.95rem',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to Challans</span>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Create Delivery Challan
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.2rem 0 0 0' }}>
              Module 9: Multi-challan dispatch against Quotation Confirmation & Dual-Write Stock Deduction
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
          borderRadius: '10px',
          color: '#991b1b',
          fontSize: '0.9rem',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={20} style={{ flexShrink: 0, color: '#dc2626' }} />
          <div>{formError}</div>
        </div>
      )}

      {/* Step 1: Confirmation Selection */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
        padding: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{
            width: '34px',
            height: '34px',
            borderRadius: '8px',
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FileText size={18} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
              1. Select Confirmed Quotation / Order
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
              Delivery Challans are dispatched directly against active Quotation Confirmations
            </p>
          </div>
        </div>

        <div>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
            Active Quotation Confirmation <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            className="form-control"
            value={selectedConfirmationId}
            onChange={handleConfirmationChange}
            disabled={loadingConfirmations}
            style={{
              height: '44px',
              borderRadius: '8px',
              borderColor: '#cbd5e1',
              backgroundColor: '#ffffff',
              fontSize: '0.9rem',
              fontWeight: 500
            }}
          >
            <option value="">-- Choose active confirmation --</option>
            {confirmations.map(c => {
              const qNum = c.quotation?.quotationNumber || 'Quotation';
              const cName = c.quotation?.customer?.customerName || c.customer?.customerName || 'Customer';
              const pendingItemsCount = (c.confirmedItems || []).filter(i => {
                const total = (i.confirmedQuantity || 0) + (i.extraQuantity || 0);
                return total > (i.deliveredQuantity || 0);
              }).length;

              return (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {qNum} - {cName} ({pendingItemsCount} items ready for dispatch)
                </option>
              );
            })}
          </select>

          {confirmations.length === 0 && !loadingConfirmations && (
            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#64748b' }}>
              No active undelivered confirmations found. Go to <strong>Quotations</strong> to confirm an order before creating a delivery challan.
            </div>
          )}
        </div>

        {/* Customer & Quotation Summary Card */}
        {selectedConfirmation && (
          <div style={{
            marginTop: '1.25rem',
            padding: '1.25rem',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            fontSize: '0.85rem'
          }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                Customer Name
              </span>
              <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{customerObj.customerName || 'Customer'}</strong>
              <div style={{ color: '#475569', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                <Phone size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                {customerObj.mobile || 'N/A'}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                Ref Quotation No.
              </span>
              <strong style={{ color: '#2563eb', fontSize: '0.95rem' }}>
                {quotationObj.quotationNumber || 'N/A'}
              </strong>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                Salesperson: {selectedConfirmation.confirmedBy?.name || quotationObj.salesperson?.name || 'Maitri Sales'}
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', display: 'block', marginBottom: '0.2rem' }}>
                Site / Shipping Destination
              </span>
              <div style={{ color: '#334155', fontSize: '0.825rem', lineHeight: 1.4 }}>
                <MapPin size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: '#64748b' }} />
                {customerObj.shippingAddress || customerObj.billingAddress || customerObj.city || 'Direct Site Delivery'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Items to Dispatch */}
      {selectedConfirmation && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <PackageCheck size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  2. Select Items & Quantities to Dispatch
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Supports partial dispatches across multiple challans until entire order quantity is fulfilled
                </p>
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '45px' }}>Include</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '130px' }}>SKU Code</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '220px' }}>Product Description</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '100px' }}>Confirmed Qty</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '100px' }}>Delivered</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '100px' }}>Balance Qty</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '140px' }}>Issue Qty</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '160px' }}>Item Remarks</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const isBalanceZero = item.balanceQty <= 0;
                  return (
                    <tr 
                      key={item.confirmedItemId || idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: item.selected ? '#f0f9ff' : (isBalanceZero ? '#fafafa' : '#ffffff'),
                        opacity: isBalanceZero ? 0.6 : 1
                      }}
                    >
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => !isBalanceZero && handleItemToggle(idx)}
                          disabled={isBalanceZero}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: isBalanceZero ? 'not-allowed' : 'pointer',
                            padding: 0,
                            color: item.selected ? '#2563eb' : '#94a3b8'
                          }}
                        >
                          {item.selected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </button>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {item.sku}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>
                        {item.productName}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#475569' }}>
                        {item.confirmedQty} {item.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#64748b' }}>
                        {item.deliveredQty} {item.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, color: isBalanceZero ? '#94a3b8' : '#16a34a' }}>
                        {item.balanceQty} {item.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <input
                          type="number"
                          className="form-control"
                          min="1"
                          max={item.balanceQty}
                          value={item.quantityToIssue}
                          onChange={(e) => handleQtyChange(idx, e.target.value)}
                          disabled={!item.selected || isBalanceZero}
                          style={{
                            height: '34px',
                            width: '100%',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            borderRadius: '6px',
                            borderColor: item.selected ? '#3b82f6' : '#cbd5e1',
                            backgroundColor: item.selected ? '#ffffff' : '#f1f5f9'
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Batch no / Box condition"
                          value={item.remarks}
                          onChange={(e) => handleItemRemarksChange(idx, e.target.value)}
                          disabled={!item.selected || isBalanceZero}
                          style={{
                            height: '34px',
                            fontSize: '0.8rem',
                            borderRadius: '6px',
                            borderColor: '#cbd5e1'
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Step 3: Dispatch & Logistics */}
      {selectedConfirmation && (
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
          padding: '1.5rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Truck size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                3. Dispatch & Vehicle Information
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Transporter details, driver contact, and destination remarks for delivery note
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Driver Name
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Ramesh Bhai"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                style={{ height: '40px', borderRadius: '8px', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Vehicle Number
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. GJ-01-AB-1234"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                style={{ height: '40px', borderRadius: '8px', fontSize: '0.875rem' }}
              />
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Delivery Details / Site Notes
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Tata Ace delivery at Site 4 Green City"
                value={deliveryDetails}
                onChange={(e) => setDeliveryDetails(e.target.value)}
                style={{ height: '40px', borderRadius: '8px', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
              General Remarks
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Handle ceramic boxes with care; site unloading coordinated with supervisor."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              style={{ height: '40px', borderRadius: '8px', fontSize: '0.875rem' }}
            />
          </div>
        </div>
      )}

      {/* Action Footer */}
      {selectedConfirmation && (
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '1rem',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
        }}>
          <Link
            to="/challans"
            className="btn btn-secondary"
            style={{ borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="btn btn-secondary"
            style={{
              borderRadius: '8px',
              padding: '0.65rem 1.25rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              backgroundColor: '#f8fafc',
              borderColor: '#cbd5e1'
            }}
          >
            {saving && !finalizeDirectly ? (
              <RefreshCw size={16} className="spin-animation" />
            ) : (
              <Save size={16} />
            )}
            <span>Save as DRAFT Challan</span>
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={saving}
            className="btn btn-primary"
            style={{
              borderRadius: '8px',
              padding: '0.65rem 1.5rem',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
            }}
          >
            {saving && finalizeDirectly ? (
              <RefreshCw size={16} className="spin-animation" />
            ) : (
              <ShieldCheck size={18} />
            )}
            <span>Create & Finalize (Deduct Stock)</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CreateChallan;
