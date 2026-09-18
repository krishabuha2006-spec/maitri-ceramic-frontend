import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPaymentById } from '../services/paymentService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ArrowLeft, Printer, Download } from 'lucide-react';

const renderSafeText = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.modeName === 'string') return val.modeName;
    if (typeof val.modeName === 'object' && val.modeName !== null) return renderSafeText(val.modeName, fallback);
    if (typeof val.accountName === 'string') return val.accountName;
    if (typeof val.bankName === 'string') return val.bankName;
    if (typeof val.name === 'string') return val.name;
    if (typeof val.mode === 'string') return val.mode;
    return fallback;
  }
  return String(val);
};

export const PaymentReceipt = () => {
  const { id } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaymentById(id)
      .then(res => setPayment(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading receipt...</div>;
  if (!payment) return <div style={{ padding: '2rem', color: '#dc2626' }}>Receipt not found.</div>;

  return (
    <div style={{ maxWidth: '750px' }}>
      
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link to="/payments" className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Receipts
        </Link>
        <button 
          onClick={() => window.print()}
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <Printer size={16} /> Print Receipt
        </button>
      </div>

      <div className="receipt-container" style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '2.5rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', pb: '1rem', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>MAITRI CERAMIC</h1>
          <p style={{ fontSize: '0.825rem', color: '#475569' }}>
            Commerce Plaza, Ahmedabad, Gujarat | Phone: +91 98250 00000
          </p>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#16a34a', marginTop: '0.5rem' }}>OFFICIAL PAYMENT RECEIPT</h2>
        </div>

        {/* Receipt Details Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          <div><strong>Receipt Number:</strong> {renderSafeText(payment.receiptNumber, 'RCT')}</div>
          <div><strong>Payment Date:</strong> {formatDate(payment.date)}</div>
          <div><strong>Received From:</strong> <span style={{ fontWeight: 700 }}>{renderSafeText(payment.customerName, 'Customer')}</span></div>
          <div><strong>Against Invoice:</strong> {renderSafeText(payment.invoiceNumber, 'Account Settlement')}</div>
          <div><strong>Payment Mode:</strong> {renderSafeText(payment.paymentMode, 'Bank Transfer')}</div>
          <div><strong>Ref / UTR Number:</strong> {renderSafeText(payment.referenceNumber, 'N/A')}</div>
          <div><strong>Bank / Cash Account:</strong> {renderSafeText(payment.bankAccount, 'Main Cash')}</div>
        </div>

        {/* Amount Card */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1rem 1.25rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
          <span className="stat-label" style={{ color: '#166534' }}>Amount Received</span>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#16a34a' }}>
            {formatCurrency(payment.amount)}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#15803d', marginTop: '0.25rem' }}>
            <strong>In Words:</strong> {payment.amountInWords}
          </div>
        </div>

        {payment.remarks && (
          <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '2rem' }}>
            <strong>Remarks:</strong> {payment.remarks}
          </div>
        )}

        {/* Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <div>
            <p>Customer Signature</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><strong>{payment.authorizedSignatory || 'For Maitri Ceramic'}</strong></p>
            <br /><br />
            <p style={{ color: '#64748b' }}>Authorized Receiver</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PaymentReceipt;
