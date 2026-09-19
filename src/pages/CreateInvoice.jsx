import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getInvoiceableChallans, createInvoice } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { 
  ArrowLeft, 
  FileText, 
  Truck, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  CheckSquare, 
  Square,
  Building2,
  Phone,
  MapPin,
  Calendar
} from 'lucide-react';

export const CreateInvoice = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedChallanId = searchParams.get('challanId') || '';

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [invoiceableChallans, setInvoiceableChallans] = useState([]);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedChallanIds, setSelectedChallanIds] = useState(preselectedChallanId ? [preselectedChallanId] : []);

  const [formData, setFormData] = useState({
    buyerBillTo: '',
    consigneeShipTo: '',
    refNumber: '',
    deliveryNote: '',
    termsOfPayment: 'Net 30 Days',
    termsOfDelivery: 'Door delivery / Site delivery'
  });

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Fetch customers and un-invoiced finalized challans from backend
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [challansRes, customersRes] = await Promise.all([
          getInvoiceableChallans(),
          getCustomers({ limit: 1000 })
        ]);

        const challanList = Array.isArray(challansRes) ? challansRes : [];
        setInvoiceableChallans(challanList);
        setCustomers(customersRes.data || []);

        // If preselected challan ID provided, select customer and challan
        if (preselectedChallanId) {
          const matched = challanList.find(c => String(c._id || c.id) === String(preselectedChallanId));
          if (matched) {
            const custId = matched.customer?._id || matched.customer?.id || matched.customer || matched.customerId;
            if (custId) {
              setSelectedCustomerId(String(custId));
              setSelectedChallanIds([String(matched._id || matched.id)]);
              fillCustomerDetails(matched.customer, matched);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load initial billing data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [preselectedChallanId]);

  const fillCustomerDetails = (cust, challan) => {
    const c = cust || {};
    const name = c.customerName || c.name || 'Customer';
    const billTo = c.billingAddress 
      ? `${name}, ${c.billingAddress}, ${c.city || ''} (GSTIN: ${c.gstNumber || 'N/A'})`
      : (c.address || `${name}, ${c.city || ''}`);
    const shipTo = c.shippingAddress || c.billingAddress || challan?.deliveryDetails || c.city || '';

    setFormData(prev => ({
      ...prev,
      buyerBillTo: billTo,
      consigneeShipTo: shipTo,
      refNumber: challan?.quotationNumber || challan?.refQuotationNo || prev.refNumber || '',
      deliveryNote: challan?.deliveryDetails || prev.deliveryNote || ''
    }));
  };

  // Customers that have at least one invoiceable challan
  const customersWithChallans = useMemo(() => {
    const custMap = new Map();
    invoiceableChallans.forEach(ch => {
      const cust = ch.customer;
      const cId = cust?._id || cust?.id || ch.customerId;
      if (cId && !custMap.has(String(cId))) {
        custMap.set(String(cId), {
          id: String(cId),
          name: cust?.customerName || cust?.name || 'Customer',
          mobile: cust?.mobile || ch.customerContact || '',
          city: cust?.city || ''
        });
      }
    });
    return Array.from(custMap.values());
  }, [invoiceableChallans]);

  // Challans matching the currently selected customer
  const availableChallansForCustomer = useMemo(() => {
    if (!selectedCustomerId) return [];
    return invoiceableChallans.filter(ch => {
      const cId = ch.customer?._id || ch.customer?.id || ch.customerId;
      return String(cId) === String(selectedCustomerId);
    });
  }, [invoiceableChallans, selectedCustomerId]);

  const handleCustomerChange = (e) => {
    const custId = e.target.value;
    setSelectedCustomerId(custId);
    setFormError('');

    if (!custId) {
      setSelectedChallanIds([]);
      setFormData(prev => ({ ...prev, buyerBillTo: '', consigneeShipTo: '', refNumber: '' }));
      return;
    }

    const matching = invoiceableChallans.filter(ch => {
      const cId = ch.customer?._id || ch.customer?.id || ch.customerId;
      return String(cId) === String(custId);
    });

    if (matching.length > 0) {
      // By default select all invoiceable challans for this customer (multi-challan consolidation)
      setSelectedChallanIds(matching.map(c => String(c._id || c.id)));
      fillCustomerDetails(matching[0].customer, matching[0]);
    } else {
      setSelectedChallanIds([]);
      const cust = customers.find(c => String(c.id || c._id) === String(custId));
      if (cust) fillCustomerDetails(cust, null);
    }
  };

  const handleToggleChallan = (challanId) => {
    setFormError('');
    setSelectedChallanIds(prev => {
      if (prev.includes(challanId)) {
        return prev.filter(id => id !== challanId);
      } else {
        return [...prev, challanId];
      }
    });
  };

  // Aggregated items from all selected challans
  const aggregatedItems = useMemo(() => {
    const items = [];
    selectedChallanIds.forEach(chId => {
      const ch = invoiceableChallans.find(c => String(c._id || c.id) === String(chId));
      if (ch && Array.isArray(ch.items)) {
        ch.items.forEach(item => {
          items.push({
            challanNo: ch.challanNumber,
            sku: item.skuCodeSnapshot || item.product?.companySkuCode || item.sku || 'SKU',
            productName: item.productNameSnapshot || item.product?.productName || item.productName || 'Product',
            quantity: Number(item.quantityToIssue != null ? item.quantityToIssue : (item.quantity || 0)),
            unit: item.unit?.unitName || item.unit?.unitCode || (typeof item.unit === 'string' && item.unit.length <= 10 ? item.unit : 'Boxes') || 'Pcs',
            remarks: item.remarks || ''
          });
        });
      }
    });
    return items;
  }, [selectedChallanIds, invoiceableChallans]);

  const totalQuantity = useMemo(() => {
    return aggregatedItems.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  }, [aggregatedItems]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedCustomerId) {
      setFormError('Please select a customer with eligible delivery challans.');
      return;
    }

    if (selectedChallanIds.length === 0) {
      setFormError('At least one finalized Delivery Challan is required to generate a Tax Invoice.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: selectedCustomerId,
        challanIds: selectedChallanIds,
        buyerBillTo: formData.buyerBillTo.trim(),
        consigneeShipTo: formData.consigneeShipTo.trim(),
        referenceNumber: formData.refNumber.trim() || undefined,
        deliveryNote: formData.deliveryNote.trim() || undefined,
        termsOfPayment: formData.termsOfPayment.trim() || undefined,
        termsOfDelivery: formData.termsOfDelivery.trim() || undefined
      };

      const created = await createInvoice(payload);
      setSuccessToast(`Tax Invoice ${created?.invoiceNumber || 'INV'} generated & issued successfully!`);

      setTimeout(() => {
        navigate('/invoices');
      }, 1000);
    } catch (err) {
      console.error('Error generating invoice:', err);
      const msg = err.response?.data?.message || err.message || 'Error generating tax invoice from backend.';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedCustomerObj = customers.find(c => String(c.id || c._id) === String(selectedCustomerId)) || 
    (availableChallansForCustomer[0]?.customer) || null;

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

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to="/invoices" 
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
            <span>Back to Invoices</span>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Generate Tax Invoice
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.2rem 0 0 0' }}>
              Module 10: Multi-Challan Consolidation & Server-Computed GST Billing
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

      <form onSubmit={handleSubmit} noValidate>
        {/* Card 1: Customer Selection & Eligible Challans */}
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
              <Building2 size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                1. Select Customer & Consolidate Challans
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Only <strong>FINALIZED</strong> delivery challans eligible for billing are shown
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
              Select Customer <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <select
              className="form-control"
              value={selectedCustomerId}
              onChange={handleCustomerChange}
              disabled={loading}
              style={{
                height: '44px',
                borderRadius: '8px',
                borderColor: '#cbd5e1',
                backgroundColor: '#ffffff',
                fontSize: '0.9rem',
                fontWeight: 500
              }}
            >
              <option value="">-- Choose customer with un-invoiced challans --</option>
              {customersWithChallans.map(cust => {
                const count = invoiceableChallans.filter(c => String(c.customer?._id || c.customer?.id || c.customerId) === String(cust.id)).length;
                return (
                  <option key={cust.id} value={cust.id}>
                    {cust.name} {cust.city ? `(${cust.city})` : ''} - {count} {count === 1 ? 'Challan ready for billing' : 'Challans ready for billing'}
                  </option>
                );
              })}
            </select>

            {customersWithChallans.length === 0 && !loading && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.825rem', color: '#64748b' }}>
                No un-invoiced finalized challans found in the backend. Finalize a delivery challan in <strong>Module 9 (Challans)</strong> before generating a Tax Invoice.
              </div>
            )}
          </div>

          {/* Available Challans to Check */}
          {selectedCustomerId && (
            <div>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', display: 'block', marginBottom: '0.5rem' }}>
                Select Delivery Challans to Consolidate into this Invoice:
              </label>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {availableChallansForCustomer.map(ch => {
                  const chId = String(ch._id || ch.id);
                  const isChecked = selectedChallanIds.includes(chId);
                  const itemsCount = ch.items?.length || 0;
                  const totalQty = ch.items?.reduce((s, i) => s + Number(i.quantityToIssue || i.quantity || 0), 0) || 0;

                  return (
                    <div 
                      key={chId}
                      onClick={() => handleToggleChallan(chId)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.85rem 1.15rem',
                        borderRadius: '8px',
                        border: isChecked ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: isChecked ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        <div style={{ color: isChecked ? '#2563eb' : '#94a3b8' }}>
                          {isChecked ? <CheckSquare size={20} /> : <Square size={20} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                            {ch.challanNumber}
                            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#16a34a', backgroundColor: '#f0fdf4', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                              FINALIZED
                            </span>
                          </div>
                          <div style={{ fontSize: '0.785rem', color: '#64748b', marginTop: '0.2rem' }}>
                            Date: {formatDate(ch.challanDate)} | Ref: {ch.quotationNumber || ch.refQuotationNo || 'Quotation'} | {ch.deliveryDetails || 'Direct Delivery'}
                          </div>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                        <strong style={{ color: '#2563eb' }}>{itemsCount}</strong> items ({totalQty} Qty)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Card 2: Consolidated Line Items Preview */}
        {selectedChallanIds.length > 0 && (
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 12px rgba(0, 0, 0, 0.03)',
            padding: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
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
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    2. Consolidated Line Items ({aggregatedItems.length})
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                    The backend resolves pricing and computes GST directly from confirmed quotation line items
                  </p>
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                Total Quantity: <span style={{ color: '#2563eb' }}>{totalQuantity}</span>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '45px' }}>#</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', width: '150px' }}>Source Challan</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '130px' }}>SKU</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'left', minWidth: '240px' }}>Product Description</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '110px' }}>Quantity</th>
                    <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', width: '90px' }}>Unit</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedItems.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#2563eb' }}>{item.challanNo}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>{item.sku}</td>
                      <td style={{ padding: '0.65rem 0.75rem', fontWeight: 600, color: '#1e293b' }}>{item.productName}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{item.quantity}</td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#64748b' }}>{item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Card 3: Billing & Consignee Details */}
        {selectedChallanIds.length > 0 && (
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
                  3. Invoice Terms & Delivery Details
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                  Bill-to, Ship-to, and Payment Terms for printed GST invoice
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Buyer (Bill To) Address & GSTIN <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={formData.buyerBillTo}
                  onChange={(e) => setFormData({ ...formData, buyerBillTo: e.target.value })}
                  required
                  placeholder="Legal buyer billing name, full address, and GSTIN"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Consignee (Ship To) Destination <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={formData.consigneeShipTo}
                  onChange={(e) => setFormData({ ...formData, consigneeShipTo: e.target.value })}
                  required
                  placeholder="Project site delivery destination"
                  style={{ borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Ref Quotation / Order
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.refNumber}
                  onChange={(e) => setFormData({ ...formData, refNumber: e.target.value })}
                  placeholder="e.g. Q-2026-27-0039"
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Terms of Payment
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.termsOfPayment}
                  onChange={(e) => setFormData({ ...formData, termsOfPayment: e.target.value })}
                  placeholder="e.g. Net 30 Days"
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                  Terms of Delivery
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.termsOfDelivery}
                  onChange={(e) => setFormData({ ...formData, termsOfDelivery: e.target.value })}
                  placeholder="e.g. Door delivery / FOR Site"
                  style={{ height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Action Bar */}
        {selectedChallanIds.length > 0 && (
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
              to="/invoices"
              className="btn btn-secondary"
              style={{ borderRadius: '8px', padding: '0.65rem 1.25rem', fontWeight: 600, fontSize: '0.875rem' }}
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{
                borderRadius: '8px',
                padding: '0.65rem 1.75rem',
                fontWeight: 700,
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)'
              }}
            >
              {saving ? <RefreshCw size={16} className="spin-animation" /> : <ShieldCheck size={18} />}
              <span>Generate Tax Invoice</span>
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default CreateInvoice;
