import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getInvoiceById } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Printer, CreditCard } from 'lucide-react';

export const InvoiceDetails = () => {
  const { id } = useParams();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getInvoiceById(id)
      .then(res => setInvoice(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ padding: '2rem' }}>Loading invoice...</div>;
  if (!invoice) return <div style={{ padding: '2rem', color: '#dc2626' }}>Invoice not found.</div>;

  return (
    <div style={{ maxWidth: '900px' }}>
      
      {/* Top Action Bar */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link to="/invoices" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back to Invoices</span>
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer size={16} /> Print Tax Invoice
          </button>
          <Link to="/payments/entry" className="btn btn-primary btn-sm">
            <CreditCard size={16} /> Record Payment Receipt
          </Link>
        </div>
      </div>

      {/* Printable Invoice Container */}
      <div className="card printable-document" style={{ background: '#ffffff', padding: '2rem', border: '1px solid #cbd5e1' }}>
        
        {/* Invoice Title & Tax Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', pb: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>MAITRI CERAMIC</h1>
            <p style={{ fontSize: '0.85rem', color: '#475569' }}>
              Tiles, Sanitaryware & CP Fittings Showroom<br />
              101-104, Commerce Plaza, Near Circle, Ahmedabad, Gujarat.<br />
              GSTIN: 24ABCDE1234F1Z9 | Phone: +91 98250 00000
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#2563eb' }}>TAX INVOICE</h2>
            <div style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              <div><strong>Invoice No:</strong> {invoice.invoiceNumber}</div>
              <div><strong>Date:</strong> {formatDate(invoice.date)}</div>
              <div><strong>Status:</strong> <StatusBadge status={invoice.status} /></div>
            </div>
          </div>
        </div>

        {/* Addresses Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
          <div style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '4px' }}>
            <strong style={{ color: '#0f172a' }}>Buyer / Bill To:</strong>
            <p style={{ marginTop: '0.35rem', whiteSpace: 'pre-line' }}>{invoice.buyerBillTo}</p>
          </div>
          <div style={{ border: '1px solid #e2e8f0', padding: '0.75rem', borderRadius: '4px' }}>
            <strong style={{ color: '#0f172a' }}>Consignee / Ship To:</strong>
            <p style={{ marginTop: '0.35rem', whiteSpace: 'pre-line' }}>{invoice.consigneeShipTo}</p>
          </div>
        </div>

        {/* Invoice Reference Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '1.5rem' }}>
          <div><strong>Quotation Ref:</strong> {invoice.refNumber || '-'}</div>
          <div><strong>Buyer's Order No:</strong> {invoice.buyersOrderNo || '-'}</div>
          <div><strong>Dispatch Doc (Challan):</strong> {invoice.dispatchDocNo || '-'}</div>
          <div><strong>Terms of Delivery:</strong> {invoice.termsOfDelivery || '-'}</div>
        </div>

        {/* Items Table */}
        <table className="data-table" style={{ fontSize: '0.825rem', marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Description of Goods</th>
              <th>HSN</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Rate (₹)</th>
              <th>Disc%</th>
              <th>Taxable Amt</th>
              <th>GST%</th>
              <th style={{ textAlign: 'right' }}>Total (₹)</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items?.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{item.productName}</td>
                <td>{item.hsnCode}</td>
                <td>{item.quantity}</td>
                <td>{item.unit}</td>
                <td>{formatCurrency(item.rate)}</td>
                <td>{item.discount}%</td>
                <td>{formatCurrency(item.taxableAmount)}</td>
                <td>{item.gstPercent}%</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals & Tax Calculation Breakdown */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, minWidth: '280px', fontSize: '0.85rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <strong>Amount in Words:</strong><br />
              <span style={{ fontStyle: 'italic', color: '#334155' }}>{invoice.amountInWords}</span>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
              <strong>Declaration:</strong><br />
              <span style={{ fontSize: '0.775rem', color: '#64748b' }}>{invoice.declaration}</span>
            </div>
          </div>

          <div style={{ width: '280px', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0' }}>
              <span>Taxable Total:</span>
              <strong>{formatCurrency(invoice.taxableTotal)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#0284c7' }}>
              <span>CGST Total:</span>
              <span>{formatCurrency(invoice.cgstAmount || (invoice.totalGst / 2))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#0284c7' }}>
              <span>SGST Total:</span>
              <span>{formatCurrency(invoice.sgstAmount || (invoice.totalGst / 2))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '2px solid #0f172a', marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: 800, color: '#2563eb' }}>
              <span>Grand Total:</span>
              <span>{formatCurrency(invoice.finalTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#16a34a', fontWeight: 600 }}>
              <span>Amount Paid:</span>
              <span>{formatCurrency(invoice.paidAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', color: '#dc2626', fontWeight: 700 }}>
              <span>Balance Outstanding:</span>
              <span>{formatCurrency(invoice.outstandingAmount)}</span>
            </div>
          </div>
        </div>

        {/* Signature Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
          <div>
            <p>Customer Signature</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p><strong>{invoice.authorizedSignatory || 'For Maitri Ceramic'}</strong></p>
            <br /><br />
            <p style={{ color: '#64748b' }}>Authorized Signatory</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default InvoiceDetails;
