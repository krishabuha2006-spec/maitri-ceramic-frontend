import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getInvoices } from '../services/invoiceService';
import { createPayment } from '../services/paymentService';
import { ArrowLeft, CreditCard, Save, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export const PaymentEntry = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  const [formData, setFormData] = useState({
    receiptNumber: `RCT-2026-00${Math.floor(Math.random() * 900) + 100}`,
    date: new Date().toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    invoiceNumber: '',
    paymentMode: 'Bank Transfer',
    amount: 0,
    referenceNumber: '',
    bankAccount: 'HDFC Bank - Current A/C 50200012345678',
    remarks: 'Payment received against sales billing'
  });

  useEffect(() => {
    Promise.all([getCustomers(), getInvoices()]).then(([cRes, iRes]) => {
      setCustomers(cRes.data || []);
      setInvoices(iRes.data || []);
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
        amount: cust.totalOutstanding || 0
      }));
    } else {
      setFormData(prev => ({ ...prev, customerId: '', customerName: '', amount: 0 }));
    }
  };

  const handleInvoiceSelect = (e) => {
    const invNo = e.target.value;
    setFormError('');
    const inv = invoices.find(i => i.invoiceNumber === invNo);
    if (inv) {
      setFormData(prev => ({
        ...prev,
        invoiceNumber: inv.invoiceNumber,
        customerId: inv.customerId,
        customerName: inv.customerName,
        amount: inv.outstandingAmount || inv.finalTotal
      }));
    } else {
      setFormData(prev => ({ ...prev, invoiceNumber: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.customerName.trim()) {
      setFormError('Please select a customer or link an invoice.');
      return;
    }

    if (!formData.amount || formData.amount <= 0) {
      setFormError('Please enter a valid payment amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      const pmt = await createPayment(formData);
      setSuccessToast(`Payment receipt #${pmt.receiptNumber} recorded! Outstanding updated.`);
      setTimeout(() => {
        navigate(`/payments/${pmt.id}`);
      }, 900);
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Error recording payment receipt.');
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
          to="/payments" 
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
          <span>Back to Payments</span>
        </Link>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Record Payment Receipt
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.825rem', margin: '0.15rem 0 0 0' }}>
            Record money received from customer, update account balance, and issue official receipt.
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
        {/* Card: Receipt Details */}
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
              backgroundColor: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CreditCard size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                Receipt Details & Account Posting
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                Receipt voucher number, payment date, customer selection, payment mode, and amount
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '1.25rem' }}>
            {/* Receipt Number */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Receipt Number
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.receiptNumber}
                readOnly
                style={{ height: '44px', borderRadius: '8px', backgroundColor: '#f8fafc', fontWeight: 700, color: '#0f172a' }}
              />
            </div>

            {/* Payment Date */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Payment Date
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
                    {c.name} (Outstanding: ₹{c.totalOutstanding?.toLocaleString('en-IN') || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Select Invoice Ref */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Select Invoice Ref (Optional)
              </label>
              <select
                className="form-control"
                value={formData.invoiceNumber}
                onChange={handleInvoiceSelect}
                style={{ height: '44px', borderRadius: '8px' }}
              >
                <option value="">-- Optional Invoice Ref --</option>
                {invoices.map(i => (
                  <option key={i.id || i._id} value={i.invoiceNumber}>
                    {i.invoiceNumber} - {i.customerName} (Due: ₹{i.outstandingAmount?.toLocaleString('en-IN') || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Mode */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Payment Mode <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-control"
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value })}
                style={{ height: '44px', borderRadius: '8px' }}
              >
                <option value="Bank Transfer">Bank Transfer (NEFT / RTGS)</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Amount Received */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Amount Received (₹) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="number"
                step="0.01"
                className="form-control"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                required
                placeholder="0.00"
                style={{ height: '44px', borderRadius: '8px', fontWeight: 700, color: '#16a34a', fontSize: '1.05rem' }}
              />
            </div>

            {/* Transaction / Cheque / UTR Ref No */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Transaction / Cheque / UTR Ref No.
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="e.g. UTR-99012345"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Bank / Cash Account */}
            <div style={{ gridColumn: 'span 6' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Bank / Cash Account
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.bankAccount}
                onChange={(e) => setFormData({ ...formData, bankAccount: e.target.value })}
                placeholder="e.g. HDFC Bank - Current A/C"
                style={{ height: '44px', borderRadius: '8px' }}
              />
            </div>

            {/* Remarks / Payment Notes */}
            <div style={{ gridColumn: 'span 12' }}>
              <label style={{ fontWeight: 600, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.35rem' }}>
                Remarks / Payment Notes
              </label>
              <input
                type="text"
                className="form-control"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="e.g. Payment received against sales billing settlement"
                style={{ height: '44px', borderRadius: '8px' }}
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
            to="/payments" 
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
              backgroundColor: '#16a34a',
              borderColor: '#16a34a',
              boxShadow: '0 4px 14px rgba(22, 163, 74, 0.28)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {saving ? (
              <>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Saving Receipt...</span>
              </>
            ) : (
              <>
                <Save size={18} />
                <span>Save Payment & Issue Receipt</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PaymentEntry;
