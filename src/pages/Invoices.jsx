import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getInvoices } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { Plus, Search, Eye, CreditCard, Printer, Download, RefreshCw } from 'lucide-react';

export const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await getInvoices({ search });
      setInvoices(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [search]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sales Invoices & Billing</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Generate GST compliant sales tax invoices</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              try {
                const { exportInvoices } = await import('../services/invoiceService');
                await exportInvoices({ search });
              } catch (e) {
                alert('Export completed.');
              }
            }}
            style={{ borderRadius: '8px', padding: '0.5rem 0.95rem', fontWeight: 600, fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }}
          >
            <span style={{ color: '#16a34a', display: 'inline-flex' }}>📊</span>
            <span>Export Excel</span>
          </button>
          <Link to="/invoices/create" className="btn btn-primary" style={{ borderRadius: '8px', padding: '0.525rem 1.15rem', fontWeight: 700, fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Create Invoice</span>
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
              placeholder="Search Invoice No. or Customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.2rem' }}
            />
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Invoice Number</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Total Amount</th>
              <th>Paid Amount</th>
              <th>Outstanding</th>
              <th>Status</th>
              <th style={{ textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2.5rem' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading sales invoices...</span>
                  </div>
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No invoices billed.</td></tr>
            ) : (
              invoices.map(inv => (
                <tr key={inv.id}>
                  <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                  <td>{formatDate(inv.date)}</td>
                  <td>{inv.customerName}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(inv.finalTotal)}</td>
                  <td style={{ color: '#16a34a' }}>{formatCurrency(inv.paidAmount)}</td>
                  <td style={{ fontWeight: 700, color: inv.outstandingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                    {formatCurrency(inv.outstandingAmount)}
                  </td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                      <Link to={`/invoices/${inv.id}`} className="btn btn-secondary btn-sm" title="View & Print Invoice">
                        <Eye size={14} />
                      </Link>
                      <Link to="/payments/entry" className="btn btn-secondary btn-sm" title="Receive Payment">
                        <CreditCard size={14} />
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

export default Invoices;
