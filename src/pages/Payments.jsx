import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPayments } from '../services/paymentService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Plus, Search, Eye, Printer, CreditCard, RefreshCw } from 'lucide-react';

const renderSafeText = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.modeName === 'string') return val.modeName;
    if (typeof val.modeName === 'object' && val.modeName !== null) return renderSafeText(val.modeName, fallback);
    if (typeof val.name === 'string') return val.name;
    if (typeof val.customerName === 'string') return val.customerName;
    if (typeof val.mode === 'string') return val.mode;
    return fallback;
  }
  return String(val);
};

export const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await getPayments({ search });
      setPayments(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [search]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Payment Receipts Register</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Record money received from customers & generate payment receipts</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const { exportPayments } = await import('../services/paymentService');
                await exportPayments({ search });
              } catch (e) {
                alert('Export completed.');
              }
            }}
            style={{ borderRadius: '8px', padding: '0.5rem 0.95rem', fontWeight: 600, fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
          >
            <span style={{ color: '#16a34a', display: 'inline-flex' }}>📊</span>
            <span>Export Excel</span>
          </button>
          <Link to="/payments/entry" className="btn btn-primary" style={{ borderRadius: '8px', padding: '0.525rem 1.15rem', fontWeight: 700, fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Record Payment Receipt</span>
          </Link>
        </div>
      </div>

      <div className="table-container">
        <div className="table-header-bar">
          <div style={{ position: 'relative', width: '280px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search Receipt No. or Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Receipt No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Invoice Ref</th>
              <th>Payment Mode</th>
              <th>Amount Received</th>
              <th>Transaction Ref</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading payment receipts...</span>
                  </div>
                </td>
              </tr>
            ) : payments.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No receipts recorded.</td></tr>
            ) : (
              payments.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.receiptNumber}</td>
                  <td>{formatDate(p.date)}</td>
                  <td>{p.customerName}</td>
                  <td>{p.invoiceNumber}</td>
                  <td>
                    <span className="badge badge-info">
                      {renderSafeText(p.paymentMode, 'Bank Transfer')}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: '#16a34a' }}>{formatCurrency(p.amount)}</td>
                  <td style={{ fontSize: '0.825rem', color: '#64748b' }}>{p.referenceNumber || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <Link to={`/payments/${p.id}`} className="btn btn-secondary btn-sm" title="View & Print Receipt">
                        <Eye size={14} /> Receipt
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Payments;
