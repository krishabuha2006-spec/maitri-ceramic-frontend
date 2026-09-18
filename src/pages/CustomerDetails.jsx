import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getCustomerById } from '../services/customerService';
import { getQuotations } from '../services/quotationService';
import { getChallans } from '../services/challanService';
import { getInvoices } from '../services/invoiceService';
import { getPayments } from '../services/paymentService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { ArrowLeft, Edit, Phone, Mail, MapPin, FileCheck } from 'lucide-react';

const getSafeMode = (val, fallback = 'Bank Transfer') => {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (typeof val.modeName === 'string') return val.modeName;
    if (typeof val.modeName === 'object' && val.modeName !== null) return getSafeMode(val.modeName, fallback);
    if (typeof val.name === 'string') return val.name;
    if (typeof val.mode === 'string') return val.mode;
  }
  return fallback;
};

export const CustomerDetails = () => {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('quotations');
  const [loading, setLoading] = useState(true);

  // Tab Data States
  const [quotations, setQuotations] = useState([]);
  const [challans, setChallans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const fetch360History = async () => {
      try {
        const cust = await getCustomerById(id);
        setCustomer(cust);

        const [qtRes, chRes, invRes, pmtRes] = await Promise.all([
          getQuotations({ customerId: cust.id, customerName: cust.name }),
          getChallans({ search: cust.name }),
          getInvoices({ customerId: cust.id }),
          getPayments({ customerId: cust.id })
        ]);

        setQuotations(qtRes.data || []);
        setChallans(chRes.data || []);
        setInvoices(invRes.data || []);
        setPayments(pmtRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetch360History();
  }, [id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '1rem' }}>
        <div className="spinner-circle" />
        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#64748b' }}>Loading 360° customer history...</div>
      </div>
    );
  }
  if (!customer) return <div style={{ padding: '2rem', color: '#dc2626' }}>Customer not found.</div>;

  // Build Ledger Entries
  const ledgerEntries = [];
  invoices.forEach(inv => {
    ledgerEntries.push({
      date: inv.date,
      particular: `Sales Invoice #${inv.invoiceNumber}`,
      debit: inv.finalTotal,
      credit: 0
    });
  });
  payments.forEach(pmt => {
    ledgerEntries.push({
      date: pmt.date,
      particular: `Payment Received #${pmt.receiptNumber} (${getSafeMode(pmt.paymentMode)})`,
      debit: 0,
      credit: pmt.amount
    });
  });
  ledgerEntries.sort((a, b) => new Date(a.date) - new Date(b.date));
  let runningBal = 0;
  const computedLedger = ledgerEntries.map(e => {
    runningBal += (e.debit - e.credit);
    return { ...e, balance: runningBal };
  });

  // Product Purchase History
  const productHistory = [];
  invoices.forEach(inv => {
    if (inv.items) {
      inv.items.forEach(item => {
        productHistory.push({
          date: inv.date,
          invoiceNumber: inv.invoiceNumber,
          sku: item.sku,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          rate: item.rate,
          amount: item.amount
        });
      });
    }
  });

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <Link to="/customers" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
        <Link to={`/customers/edit/${customer.id}`} className="btn btn-primary btn-sm">
          <Edit size={16} />
          <span>Edit Profile</span>
        </Link>
      </div>

      {/* Customer Info Header Card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700 }}>{customer.name}</h2>
              <span className="badge badge-info">{customer.customerType || 'Customer'}</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', color: '#475569', fontSize: '0.875rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Phone size={14} /> {customer.mobile} {customer.altMobile ? `/ ${customer.altMobile}` : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Mail size={14} /> {customer.email || 'No email registered'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} /> {customer.billingAddress || customer.city}, {customer.state}
              </div>
              {customer.gstNumber && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileCheck size={14} /> GSTIN: <strong>{customer.gstNumber}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Sales</div>
          <div className="stat-value">{formatCurrency(customer.totalSales)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Invoiced</div>
          <div className="stat-value">{formatCurrency(customer.totalInvoiced)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Paid</div>
          <div className="stat-value" style={{ color: '#16a34a' }}>{formatCurrency(customer.totalPaid)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Outstanding</div>
          <div className="stat-value" style={{ color: customer.totalOutstanding > 0 ? '#dc2626' : '#0f172a' }}>
            {formatCurrency(customer.totalOutstanding)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Credit Balance</div>
          <div className="stat-value">{formatCurrency(customer.credit || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Debit Balance</div>
          <div className="stat-value">{formatCurrency(customer.debit || 0)}</div>
        </div>
      </div>

      {/* Simple 7 Navigation Tabs */}
      <div className="tabs-header">
        {[
          { id: 'quotations', label: `Quotations (${quotations.length})` },
          { id: 'orders', label: 'Orders' },
          { id: 'challans', label: `Challans (${challans.length})` },
          { id: 'invoices', label: `Invoices (${invoices.length})` },
          { id: 'payments', label: `Payments (${payments.length})` },
          { id: 'ledger', label: 'Ledger' },
          { id: 'product-history', label: 'Product History' }
        ].map(tab => (
          <button 
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      <div className="table-container">
        
        {/* Tab 1: Quotations */}
        {activeTab === 'quotations' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation No.</th>
                <th>Date</th>
                <th>Salesperson</th>
                <th>Quotation Type</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No quotations for this customer.</td></tr>
              ) : (
                quotations.map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>{q.quotationNumber}</td>
                    <td>{formatDate(q.date)}</td>
                    <td>{q.salesperson}</td>
                    <td>{q.quotationType}</td>
                    <td>{formatCurrency(q.quotationAmount)}</td>
                    <td><StatusBadge status={q.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 2: Orders */}
        {activeTab === 'orders' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Ref No.</th>
                <th>Date</th>
                <th>Linked Quotation</th>
                <th>Confirmed Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {quotations.filter(q => q.status === 'Confirmed').length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No confirmed orders.</td></tr>
              ) : (
                quotations.filter(q => q.status === 'Confirmed').map(q => (
                  <tr key={q.id}>
                    <td style={{ fontWeight: 600 }}>ORD-{q.quotationNumber.replace('QT-', '')}</td>
                    <td>{formatDate(q.date)}</td>
                    <td>{q.quotationNumber}</td>
                    <td>{formatCurrency(q.confirmedAmount)}</td>
                    <td><StatusBadge status="Confirmed" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 3: Challans */}
        {activeTab === 'challans' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Challan No.</th>
                <th>Date</th>
                <th>Ref Quotation</th>
                <th>Driver / Vehicle</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {challans.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No delivery challans created.</td></tr>
              ) : (
                challans.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.challanNumber}</td>
                    <td>{formatDate(c.date)}</td>
                    <td>{c.refQuotationNo}</td>
                    <td>{c.driverName} ({c.vehicleNo})</td>
                    <td><StatusBadge status={c.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 4: Invoices */}
        {activeTab === 'invoices' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Total Amount</th>
                <th>Paid Amount</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No invoices billed to customer.</td></tr>
              ) : (
                invoices.map(inv => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td>{formatDate(inv.date)}</td>
                    <td>{formatCurrency(inv.finalTotal)}</td>
                    <td>{formatCurrency(inv.paidAmount)}</td>
                    <td style={{ fontWeight: 600, color: inv.outstandingAmount > 0 ? '#dc2626' : '#16a34a' }}>
                      {formatCurrency(inv.outstandingAmount)}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 5: Payments */}
        {activeTab === 'payments' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt No.</th>
                <th>Date</th>
                <th>Invoice Ref</th>
                <th>Payment Mode</th>
                <th>Amount</th>
                <th>Ref / Cheque No.</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No payment receipts recorded.</td></tr>
              ) : (
                payments.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.receiptNumber}</td>
                    <td>{formatDate(p.date)}</td>
                    <td>{p.invoiceNumber}</td>
                    <td>
                      {getSafeMode(p.paymentMode)}
                    </td>
                    <td style={{ fontWeight: 600, color: '#16a34a' }}>{formatCurrency(p.amount)}</td>
                    <td>{p.referenceNumber || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 6: Ledger */}
        {activeTab === 'ledger' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Particular / Reference</th>
                <th>Debit (₹)</th>
                <th>Credit (₹)</th>
                <th>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              {computedLedger.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>Ledger is empty.</td></tr>
              ) : (
                computedLedger.map((l, i) => (
                  <tr key={i}>
                    <td>{formatDate(l.date)}</td>
                    <td>{l.particular}</td>
                    <td style={{ color: l.debit > 0 ? '#dc2626' : 'inherit' }}>{l.debit > 0 ? formatCurrency(l.debit) : '-'}</td>
                    <td style={{ color: l.credit > 0 ? '#16a34a' : 'inherit' }}>{l.credit > 0 ? formatCurrency(l.credit) : '-'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(l.balance)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Tab 7: Product History */}
        {activeTab === 'product-history' && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {productHistory.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', color: '#64748b' }}>No product purchase records found.</td></tr>
              ) : (
                productHistory.map((ph, i) => (
                  <tr key={i}>
                    <td>{formatDate(ph.date)}</td>
                    <td>{ph.invoiceNumber}</td>
                    <td>{ph.sku}</td>
                    <td style={{ fontWeight: 600 }}>{ph.productName}</td>
                    <td>{ph.quantity} {ph.unit}</td>
                    <td>{formatCurrency(ph.rate)}</td>
                    <td>{formatCurrency(ph.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
};

export default CustomerDetails;
