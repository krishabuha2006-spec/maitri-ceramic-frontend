import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getPaymentById } from '../services/paymentService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ArrowLeft, Printer, Download } from 'lucide-react';

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
        <Link to="/payments" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back to Payments</span>
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <Printer size={16} /> Print Receipt
          </button>
        </div>
      </div>

      <div className="card printable-document" style={{ background: '#ffffff', padding: '2.5rem', border: '1px solid #cbd5e1' }}>
        
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
          <div><strong>Receipt Number:</strong> {payment.receiptNumber}</div>
          <div><strong>Payment Date:</strong> {formatDate(payment.date)}</div>
          <div><strong>Received From:</strong> <span style={{ fontWeight: 700 }}>{payment.customerName}</span></div>
          <div><strong>Against Invoice:</strong> {payment.invoiceNumber || 'Account Settlement'}</div>
          <div><strong>Payment Mode:</strong> {payment.paymentMode}</div>
          <div><strong>Ref / UTR Number:</strong> {payment.referenceNumber || 'N/A'}</div>
          <div><strong>Bank / Cash Account:</strong> {payment.bankAccount || 'Main Cash'}</div>
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
