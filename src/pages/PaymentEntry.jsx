import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getInvoices } from '../services/invoiceService';
import { createPayment, getInvoicePaymentBalanceDue } from '../services/paymentService';
import { getPaymentModes } from '../services/masterService';
import { 
  ArrowLeft, 
  CreditCard, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Receipt, 
  FileText, 
  CheckSquare, 
  Square,
  Info,
  Building2,
  DollarSign
} from 'lucide-react';

export const PaymentEntry = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [paymentModes, setPaymentModes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingDues, setFetchingDues] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    receiptNumber: `RCPT-2026-27-00${Math.floor(Math.random() * 90) + 10}`,
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    paymentModeId: '6aa7c9ec612a410d893bcbc0', // Default Bank Transfer
    totalAmount: 0,
    referenceNumber: '',
    bankCashAccount: 'HDFC Bank - Current A/C 50200012345678',
    remarks: 'Payment received against sales billing settlement'
  });

  const [selectedInvoiceRef, setSelectedInvoiceRef] = useState('');
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const [cRes, iRes, mRes] = await Promise.all([
          getCustomers(),
          getInvoices(),
          getPaymentModes()
        ]);
        if (!isMounted) return;

        const custs = cRes.data || [];
        const invs = iRes.data || [];
        const modes = Array.isArray(mRes) ? mRes : (mRes.data || []);

        setCustomers(custs);
        setInvoices(invs);
        setPaymentModes(modes);

        if (modes.length > 0 && !formData.paymentModeId) {
          setFormData(prev => ({ ...prev, paymentModeId: modes[0]._id || modes[0].id }));
        }
      } catch (err) {
        console.error('Error initializing payment form:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, []);

  // Sync allocations and calculate live real-time balance due from backend
  const buildAllocationsForCustomer = async (custId, targetInvoiceId = null) => {
    if (!custId) {
      setAllocations([]);
      return;
    }

    setFetchingDues(true);
    try {
      const custInvs = invoices.filter(i => 
        String(i.customerId) === String(custId) || 
        String(i.customer?._id) === String(custId) ||
        String(i.customer?.id) === String(custId)
      );

      // Fetch live real-time balance-due for each invoice to prevent over-allocation errors
      const mapped = await Promise.all(custInvs.map(async (inv) => {
        const invId = inv._id || inv.id;
        let due = Number(inv.balanceDue ?? inv.outstandingAmount ?? inv.finalTotal ?? 0);
        let paid = Number(inv.paidAmount || 0);

        try {
          const liveDue = await getInvoicePaymentBalanceDue(invId);
          if (liveDue && liveDue.balanceDue !== undefined) {
            due = Number(liveDue.balanceDue);
            paid = Number(liveDue.paymentReceived || 0);
          }
        } catch (e) {}

        const isTarget = targetInvoiceId ? String(invId) === String(targetInvoiceId) : (due > 0);
        const shouldSelect = isTarget && due > 0;

        return {
          invoiceId: invId,
          invoiceNumber: inv.invoiceNumber,
          date: inv.date,
          grandTotal: Number(inv.grandTotal || inv.finalTotal || 0),
          paidAmount: paid,
          balanceDue: due,
          allocatedAmount: shouldSelect ? due : 0,
          isSelected: shouldSelect,
          isFullyPaid: due <= 0
        };
      }));

      setAllocations(mapped);

      const sumAllocated = mapped
        .filter(m => m.isSelected)
        .reduce((sum, m) => sum + m.allocatedAmount, 0);

      setFormData(prev => ({
        ...prev,
        totalAmount: sumAllocated
      }));
    } finally {
      setFetchingDues(false);
    }
  };

  const handleCustomerSelect = async (e) => {
    const custId = e.target.value;
    setFormError('');
    setSelectedInvoiceRef('');

    const cust = customers.find(c => String(c.id || c._id) === String(custId));
    if (cust) {
      const cId = cust._id || cust.id;
      setFormData(prev => ({
        ...prev,
        customerId: cId,
        customerName: cust.name || cust.customerName || ''
      }));
      await buildAllocationsForCustomer(cId);
    } else {
      setFormData(prev => ({
        ...prev,
        customerId: '',
        customerName: '',
        totalAmount: 0
      }));
      setAllocations([]);
    }
  };

  const handleInvoiceSelect = async (e) => {
    const invVal = e.target.value;
    setSelectedInvoiceRef(invVal);
    setFormError('');

    if (!invVal) {
      if (formData.customerId) {
        await buildAllocationsForCustomer(formData.customerId);
      }
      return;
    }

    const inv = invoices.find(i => String(i._id || i.id) === String(invVal) || i.invoiceNumber === invVal);
    if (inv) {
      const custId = inv.customerId || inv.customer?._id || inv.customer?.id;
      const custName = inv.customerName || inv.customer?.customerName || '';

      setFormData(prev => ({
        ...prev,
        customerId: custId,
        customerName: custName
      }));

      await buildAllocationsForCustomer(custId, inv._id || inv.id);
    }
  };

  const toggleInvoiceAllocation = (idx) => {
    setAllocations(prev => {
      const next = [...prev];
      const item = next[idx];
      if (item.isFullyPaid) return prev;

      const newSelected = !item.isSelected;
      item.isSelected = newSelected;
      if (newSelected && (!item.allocatedAmount || item.allocatedAmount <= 0)) {
        item.allocatedAmount = item.balanceDue;
      } else if (!newSelected) {
        item.allocatedAmount = 0;
      }

      const sum = next.filter(i => i.isSelected).reduce((s, i) => s + (Number(i.allocatedAmount) || 0), 0);
      setFormData(f => ({ ...f, totalAmount: sum }));
      return next;
    });
  };

  const handleAllocatedAmountChange = (idx, value) => {
    const rawVal = Number(value);
    setAllocations(prev => {
      const next = [...prev];
      const item = next[idx];
      let val = isNaN(rawVal) ? 0 : rawVal;

      // Automatically clamp to real live balance due to prevent 400 error
      if (val > item.balanceDue) {
        val = item.balanceDue;
      }

      item.allocatedAmount = val;
      item.isSelected = val > 0;

      const sum = next.filter(i => i.isSelected).reduce((s, i) => s + (Number(i.allocatedAmount) || 0), 0);
      setFormData(f => ({ ...f, totalAmount: sum }));
      return next;
    });
  };

  const handleQuickAllocateFull = (idx) => {
    setAllocations(prev => {
      const next = [...prev];
      const item = next[idx];
      if (item.isFullyPaid) return prev;

      item.isSelected = true;
      item.allocatedAmount = item.balanceDue;

      const sum = next.filter(i => i.isSelected).reduce((s, i) => s + (Number(i.allocatedAmount) || 0), 0);
      setFormData(f => ({ ...f, totalAmount: sum }));
      return next;
    });
  };

  const totalAllocated = allocations
    .filter(a => a.isSelected)
    .reduce((sum, a) => sum + (Number(a.allocatedAmount) || 0), 0);

  const selectedMode = paymentModes.find(m => String(m._id || m.id) === String(formData.paymentModeId)) || {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.customerId) {
      setFormError('Please select a customer from the customer dropdown.');
      return;
    }

    const activeAllocations = allocations.filter(a => a.isSelected && Number(a.allocatedAmount) > 0);

    if (activeAllocations.length === 0) {
      setFormError('Please select at least one invoice and allocate payment amount to it.');
      return;
    }

    // Validate that no allocation exceeds current live balance due
    for (const alloc of activeAllocations) {
      if (Number(alloc.allocatedAmount) > Number(alloc.balanceDue)) {
        setFormError(`Allocated amount (₹${Number(alloc.allocatedAmount).toLocaleString('en-IN')}) exceeds current live balance due (₹${Number(alloc.balanceDue).toLocaleString('en-IN')}) for invoice '${alloc.invoiceNumber}'.`);
        return;
      }
    }

    const totalAmt = Number(formData.totalAmount);
    if (!totalAmt || totalAmt <= 0) {
      setFormError('Total payment amount must be greater than zero.');
      return;
    }

    if (Math.abs(totalAmt - totalAllocated) > 0.01) {
      setFormError(`Payment Amount (₹${totalAmt.toLocaleString('en-IN')}) must equal the sum of invoice allocations (₹${totalAllocated.toLocaleString('en-IN')}). Click 'Sync' to auto-align.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        customerId: formData.customerId,
        paymentModeId: formData.paymentModeId,
        totalAmount: totalAmt,
        date: formData.date,
        referenceNumber: formData.referenceNumber,
        bankCashAccount: formData.bankCashAccount,
        remarks: formData.remarks,
        allocations: activeAllocations.map(a => ({
          invoiceId: a.invoiceId,
          allocatedAmount: Number(a.allocatedAmount)
        }))
      };

      const pmt = await createPayment(payload);
      setSuccessToast(`Payment receipt #${pmt.receiptNumber} recorded successfully!`);
      setTimeout(() => {
        navigate(`/payments/${pmt.id || pmt._id}`);
      }, 900);
    } catch (err) {
      console.error('Payment create error:', err);
      setFormError(err.message || 'Error recording payment receipt. Please check your inputs.');
    } finally {
      setSaving(false);
    }
  };

  // Filter invoices for the quick dropdown
  const filteredDropdownInvoices = formData.customerId
    ? invoices.filter(i => String(i.customerId || i.customer?._id || i.customer?.id) === String(formData.customerId))
    : invoices;

  return (
    <div style={{ maxWidth: '1060px', margin: '0 auto', paddingBottom: '3.5rem', fontFamily: 'var(--font-family, system-ui, sans-serif)' }}>
      {/* Toast Notification */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '0.85rem',
          backgroundColor: '#15803d',
          color: '#ffffff',
          padding: '1rem 1.75rem',
          borderRadius: '12px',
          boxShadow: '0 12px 28px rgba(21, 128, 61, 0.35)',
          fontWeight: 600,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <CheckCircle2 size={24} />
          <span style={{ fontSize: '0.95rem' }}>{successToast}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link 
            to="/payments" 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: '#334155',
              textDecoration: 'none',
              transition: 'all 0.2s'
            }}
          >
            <ArrowLeft size={18} />
            <span>Back to Payments</span>
          </Link>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
              Record Payment Receipt
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>
              Receive customer payment, settle pending tax invoices, and issue official payment receipt.
            </p>
          </div>
        </div>

        {(loading || fetchingDues) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            <span>{fetchingDues ? 'Calculating live dues...' : 'Loading live data...'}</span>
          </div>
        )}
      </div>

      {/* Error Alert Box */}
      {formError && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.85rem',
          padding: '1.1rem 1.35rem',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '12px',
          color: '#991b1b',
          fontSize: '0.925rem',
          marginBottom: '1.75rem',
          boxShadow: '0 2px 8px rgba(239, 68, 68, 0.08)'
        }}>
          <AlertCircle size={22} style={{ flexShrink: 0, color: '#dc2626', marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#b91c1c' }}>Error Processing Payment:</strong>
            {formError}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        {/* Card: Primary Details & Dropdowns */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          padding: '1.85rem',
          marginBottom: '1.75rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            paddingBottom: '1.1rem',
            marginBottom: '1.6rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CreditCard size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Customer & Payment Details
              </h3>
              <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                Select customer, choose live payment mode, and specify transaction parameters
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.35rem' }}>
            {/* Customer Dropdown */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span>Select Customer <span style={{ color: '#dc2626' }}>*</span></span>
                <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#64748b' }}>
                  {customers.length} Customers Available
                </span>
              </label>
              <div style={{ position: 'relative' }}>
                <select
                  className="form-control"
                  value={formData.customerId}
                  onChange={handleCustomerSelect}
                  required
                  style={{
                    width: '100%',
                    height: '46px',
                    borderRadius: '10px',
                    border: '1.5px solid #cbd5e1',
                    padding: '0 1rem',
                    fontSize: '0.925rem',
                    fontWeight: 600,
                    color: '#0f172a',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  <option value="">-- Choose Customer to Receive Payment From --</option>
                  {customers.map(c => {
                    const cId = c._id || c.id;
                    const out = Number(c.totalOutstanding || 0);
                    return (
                      <option key={cId} value={cId}>
                        {c.name || c.customerName} {c.mobile && c.mobile !== '-' ? `(${c.mobile})` : ''} — Outstanding: ₹{out.toLocaleString('en-IN')}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Quick Invoice Reference Dropdown */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span>Quick Select by Invoice (Optional)</span>
                {formData.customerId && (
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                    Filtered to selected customer
                  </span>
                )}
              </label>
              <select
                className="form-control"
                value={selectedInvoiceRef}
                onChange={handleInvoiceSelect}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '0 0.85rem',
                  fontSize: '0.875rem',
                  color: '#1e293b',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                <option value="">-- Optional: Link Direct Invoice --</option>
                {filteredDropdownInvoices.map(i => {
                  const invId = i._id || i.id;
                  const due = Number(i.balanceDue ?? i.outstandingAmount ?? i.finalTotal ?? 0);
                  return (
                    <option key={invId} value={invId}>
                      {i.invoiceNumber} • {i.customerName || 'Customer'} (Due: ₹{due.toLocaleString('en-IN')})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Payment Mode Dropdown (Live from Backend) */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span>Payment Mode <span style={{ color: '#dc2626' }}>*</span></span>
                {selectedMode.requiresReference && (
                  <span style={{ fontSize: '0.725rem', color: '#b45309', backgroundColor: '#fef3c7', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                    Requires Ref/UTR
                  </span>
                )}
              </label>
              <select
                className="form-control"
                value={formData.paymentModeId}
                onChange={(e) => setFormData({ ...formData, paymentModeId: e.target.value })}
                required
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  padding: '0 0.85rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: '#0f172a',
                  backgroundColor: '#ffffff',
                  outline: 'none'
                }}
              >
                {paymentModes.map(m => (
                  <option key={m._id || m.id} value={m._id || m.id}>
                    {m.modeName || m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Date */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.45rem' }}>
                Payment Date <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="date"
                className="form-control"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '0 0.85rem',
                  fontSize: '0.9rem',
                  color: '#0f172a'
                }}
              />
            </div>

            {/* Total Payment Amount */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
                <span>Total Amount Received (₹) <span style={{ color: '#dc2626' }}>*</span></span>
                {Math.abs(formData.totalAmount - totalAllocated) > 0.01 && (
                  <button
                    type="button"
                    onClick={() => setFormData(f => ({ ...f, totalAmount: totalAllocated }))}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#2563eb',
                      fontSize: '0.725rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    Sync to Allocations
                  </button>
                )}
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                required
                placeholder="0.00"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '2px solid #86efac',
                  padding: '0 0.85rem',
                  fontWeight: 800,
                  color: '#15803d',
                  fontSize: '1.15rem',
                  backgroundColor: '#f0fdf4'
                }}
              />
            </div>

            {/* Transaction / Cheque / UTR Ref */}
            <div style={{ gridColumn: 'span 4' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.45rem' }}>
                Transaction / UTR / Cheque Ref No.
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="e.g. UTR-99012348"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '0 0.85rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Bank / Cash Account */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.45rem' }}>
                Deposited In (Bank / Cash Account)
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.bankCashAccount}
                onChange={(e) => setFormData({ ...formData, bankCashAccount: e.target.value })}
                placeholder="e.g. HDFC Bank - Current A/C"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '0 0.85rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Remarks / Settlement Notes */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.45rem' }}>
                Remarks / Payment Notes
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="e.g. Payment received against sales billing"
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  padding: '0 0.85rem',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>
        </div>

        {/* Card: Invoice Allocations & Settlement Table */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          padding: '1.85rem',
          marginBottom: '1.75rem'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '1.1rem',
            marginBottom: '1.25rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Receipt size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Invoice Allocation & Settlement <span style={{ color: '#dc2626' }}>*</span>
                </h3>
                <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  Live balance due is verified against the backend. Maximum allocated amount cannot exceed current balance due.
                </p>
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Total Allocated:</div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                color: Math.abs(totalAllocated - formData.totalAmount) < 0.01 ? '#15803d' : '#b45309'
              }}>
                ₹{totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {!formData.customerId ? (
            <div style={{
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              backgroundColor: '#f8fafc',
              borderRadius: '12px',
              border: '1.5px dashed #cbd5e1',
              color: '#64748b'
            }}>
              <Building2 size={36} style={{ margin: '0 auto 0.75rem auto', color: '#94a3b8' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155', margin: '0 0 0.35rem 0' }}>
                Please select a customer first
              </h4>
              <p style={{ fontSize: '0.825rem', margin: 0 }}>
                Pending invoices for the selected customer will appear here automatically for settlement.
              </p>
            </div>
          ) : allocations.length === 0 ? (
            <div style={{
              padding: '2rem 1.5rem',
              textAlign: 'center',
              backgroundColor: '#fffbeb',
              borderRadius: '12px',
              border: '1px solid #fde68a',
              color: '#92400e'
            }}>
              <Info size={30} style={{ margin: '0 auto 0.5rem auto', color: '#d97706' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                No Invoices Found for This Customer
              </h4>
              <p style={{ fontSize: '0.825rem', margin: 0, maxWidth: '560px', marginInline: 'auto' }}>
                The live system strictly requires at least one invoice allocation to record a payment. Please create a sales invoice for this customer first from the Invoices section.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1rem', width: '48px', textAlign: 'center' }}></th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Invoice No</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Grand Total</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Already Paid</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'right' }}>Current Balance Due</th>
                    <th style={{ padding: '0.75rem 1rem', fontSize: '0.8rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', width: '220px', textAlign: 'right' }}>Allocated Amount (₹)</th>
                    <th style={{ padding: '0.75rem 1rem', width: '100px', textAlign: 'center' }}>Quick Action</th>
                  </tr>
                </thead>
                <tbody>
                  {allocations.map((item, idx) => (
                    <tr 
                      key={item.invoiceId} 
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: item.isFullyPaid ? '#f8fafc' : (item.isSelected ? '#f0fdf4' : 'transparent'),
                        opacity: item.isFullyPaid ? 0.65 : 1,
                        transition: 'background-color 0.15s'
                      }}
                    >
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={item.isFullyPaid}
                          onClick={() => toggleInvoiceAllocation(idx)}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: item.isFullyPaid ? 'not-allowed' : 'pointer',
                            color: item.isFullyPaid ? '#cbd5e1' : (item.isSelected ? '#16a34a' : '#94a3b8'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 0
                          }}
                        >
                          {item.isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                        </button>
                      </td>
                      <td style={{ padding: '0.85rem 1rem' }}>
                        <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                          {item.invoiceNumber}
                        </span>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {item.date || '-'}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>
                        ₹{item.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: '#15803d', fontSize: '0.9rem' }}>
                        ₹{item.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: item.balanceDue > 0 ? '#b91c1c' : '#15803d', fontSize: '0.9rem' }}>
                        {item.balanceDue > 0 ? (
                          `₹${item.balanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                        ) : (
                          <span style={{ backgroundColor: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                            Fully Paid
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={item.balanceDue}
                          value={item.allocatedAmount}
                          onChange={(e) => handleAllocatedAmountChange(idx, e.target.value)}
                          disabled={!item.isSelected || item.isFullyPaid}
                          style={{
                            width: '160px',
                            height: '38px',
                            borderRadius: '8px',
                            border: item.isSelected ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                            padding: '0 0.75rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: item.isSelected ? '#15803d' : '#94a3b8',
                            backgroundColor: item.isSelected ? '#ffffff' : '#f8fafc',
                            outline: 'none'
                          }}
                        />
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <button
                          type="button"
                          disabled={item.isFullyPaid}
                          onClick={() => handleQuickAllocateFull(idx)}
                          style={{
                            border: item.isFullyPaid ? '1px solid #e2e8f0' : '1px solid #bbf7d0',
                            backgroundColor: item.isFullyPaid ? '#f1f5f9' : '#f0fdf4',
                            color: item.isFullyPaid ? '#94a3b8' : '#15803d',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            borderRadius: '6px',
                            padding: '0.35rem 0.65rem',
                            cursor: item.isFullyPaid ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          {item.isFullyPaid ? 'Settled' : 'Pay Full'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Submission Action Bar */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 2rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
              Final Amount to Credit:
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#15803d' }}>
              ₹{Number(formData.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link 
              to="/payments" 
              style={{
                borderRadius: '10px',
                height: '44px',
                padding: '0 1.35rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#475569',
                display: 'inline-flex',
                alignItems: 'center',
                textDecoration: 'none'
              }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || loading || fetchingDues || (formData.customerId && allocations.filter(a => !a.isFullyPaid).length === 0)}
              style={{
                borderRadius: '10px',
                height: '44px',
                padding: '0 2rem',
                fontWeight: 700,
                fontSize: '0.925rem',
                backgroundColor: (saving || loading || fetchingDues || (formData.customerId && allocations.filter(a => !a.isFullyPaid).length === 0)) ? '#94a3b8' : '#16a34a',
                color: '#ffffff',
                border: 'none',
                boxShadow: '0 4px 14px rgba(22, 163, 74, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.55rem',
                cursor: (saving || loading || fetchingDues || (formData.customerId && allocations.filter(a => !a.isFullyPaid).length === 0)) ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Recording Payment...</span>
                </>
              ) : (
                <>
                  <Save size={18} />
                  <span>Save Payment & Generate Receipt</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default PaymentEntry;
