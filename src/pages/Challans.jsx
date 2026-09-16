import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getChallans } from '../services/challanService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Plus, Search, Eye, Printer, Truck, X, RefreshCw } from 'lucide-react';

export const Challans = () => {
  const [challans, setChallans] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedChallan, setSelectedChallan] = useState(null);

  const loadChallans = async () => {
    setLoading(true);
    try {
      const res = await getChallans({ search });
      setChallans(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChallans();
  }, [search]);

  const handleOpenPrintModal = (challan) => {
    setSelectedChallan(challan);
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Delivery Challan Management</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Dispatch material & automatically deduct actual stock</p>
        </div>
        <Link to="/challans/create" className="btn btn-primary" style={{ borderRadius: '8px', padding: '0.5rem 1rem', fontWeight: 600 }}>
          <Plus size={16} />
          <span>Create Delivery Challan</span>
        </Link>
      </div>

      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
        <div style={{ padding: '0.6rem 0.85rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search Challan No., Customer or Driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.1rem', height: '34px', fontSize: '0.8rem', borderRadius: '8px' }}
            />
          </div>
        </div>

        <div style={{ overflowX: 'hidden' }}>
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ width: '15%', padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Challan No.</th>
                <th style={{ width: '11%', padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date</th>
                <th style={{ width: '18%', padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Customer</th>
                <th style={{ width: '14%', padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Ref Quotation</th>
                <th style={{ width: '22%', padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Items Summary</th>
                <th style={{ width: '10%', padding: '0.6rem 0.75rem', fontSize: '0.735rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', textAlign: 'center' }}>Total Qty</th>
                <th style={{ width: '10%', padding: '0.6rem 0.5rem', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading delivery challans...</span>
                    </div>
                  </td>
                </tr>
              ) : challans.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No challans found.</td></tr>
              ) : (
                challans.map(c => {
                  const totalQty = c.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0;
                  return (
                    <tr key={c.id || c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>{c.challanNumber}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>{formatDate(c.date)}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{c.customerName}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>{c.refQuotationNo || 'N/A'}</td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.78rem', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.items?.map(i => i.productName).join(', ') || 'Tile Materials'}
                      </td>
                      <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', textAlign: 'center' }}>{totalQty}</td>
                      <td style={{ padding: '0.6rem 0.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenPrintModal(c)}
                            title="View & Print Delivery Challan"
                            style={{
                              height: '28px',
                              padding: '0 0.6rem',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              borderColor: '#cbd5e1'
                            }}
                          >
                            <Printer size={13} />
                            <span>Print</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Delivery Challan Modal */}
      {selectedChallan && (
        <Modal
          isOpen={Boolean(selectedChallan)}
          onClose={() => setSelectedChallan(null)}
          title={`Delivery Challan #${selectedChallan.challanNumber}`}
          maxWidth="820px"
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedChallan(null)}>
                Close
              </button>
              <button className="btn btn-primary" onClick={triggerPrint} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <Printer size={16} /> Print Delivery Challan
              </button>
            </div>
          }
        >
          <div className="printable-document" style={{ background: '#ffffff', padding: '0.25rem 0.5rem', color: '#0f172a' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>MAITRI CERAMIC</h1>
                <p style={{ fontSize: '0.78rem', color: '#475569', margin: '0.15rem 0 0 0', lineHeight: 1.35 }}>
                  Tiles, Sanitaryware & CP Fittings Showroom<br />
                  Commerce Plaza, Ahmedabad, Gujarat | GSTIN: 24ABCDE1234F1Z9<br />
                  Phone: +91 98250 00000
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2563eb', margin: 0 }}>DELIVERY CHALLAN</h2>
                <p style={{ fontSize: '0.725rem', fontWeight: 700, color: '#16a34a', margin: '0.15rem 0 0 0' }}>(Material Dispatch Voucher)</p>
                <div style={{ fontSize: '0.825rem', marginTop: '0.35rem' }}>
                  <div><strong>Challan No:</strong> <span style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{selectedChallan.challanNumber}</span></div>
                  <div><strong>Date:</strong> <span style={{ whiteSpace: 'nowrap' }}>{formatDate(selectedChallan.date)}</span></div>
                </div>
              </div>
            </div>

            {/* Customer & Vehicle Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem', fontSize: '0.825rem' }}>
              <div style={{ border: '1px solid #e2e8f0', padding: '0.65rem 0.75rem', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Delivery Site & Customer Info:</strong>
                <div><strong>Customer Name:</strong> {selectedChallan.customerName}</div>
                <div><strong>Phone:</strong> {selectedChallan.customerContact || 'N/A'}</div>
                <div><strong>Site Address:</strong> {selectedChallan.customerAddress || 'Direct Site Delivery'}</div>
                {selectedChallan.refQuotationNo && <div><strong>Quotation Ref:</strong> <span style={{ whiteSpace: 'nowrap' }}>{selectedChallan.refQuotationNo}</span></div>}
              </div>

              <div style={{ border: '1px solid #e2e8f0', padding: '0.65rem 0.75rem', borderRadius: '6px', backgroundColor: '#f8fafc' }}>
                <strong style={{ color: '#0f172a', display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem' }}>Logistics & Driver Details:</strong>
                <div><strong>Driver Name:</strong> {selectedChallan.driverName || 'Ramesh Patel'}</div>
                <div><strong>Vehicle No:</strong> <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{selectedChallan.vehicleNo || 'GJ-01-AB-1234'}</span></div>
                <div><strong>Salesperson:</strong> {selectedChallan.salesperson || 'Vikram Mehta'}</div>
                <div><strong>Status:</strong> <span style={{ fontWeight: 700, color: '#16a34a' }}>Dispatched</span></div>
              </div>
            </div>

            {/* Dispatched Items Table */}
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <th style={{ width: '5%', padding: '0.45rem', textAlign: 'center' }}>#</th>
                  <th style={{ width: '18%', padding: '0.45rem', whiteSpace: 'nowrap' }}>SKU Code</th>
                  <th style={{ width: '37%', padding: '0.45rem' }}>Product Description</th>
                  <th style={{ width: '23%', padding: '0.45rem' }}>Specification</th>
                  <th style={{ width: '17%', padding: '0.45rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Dispatched Qty</th>
                </tr>
              </thead>
              <tbody>
                {selectedChallan.items?.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.45rem', textAlign: 'center' }}>{idx + 1}</td>
                    <td style={{ padding: '0.45rem', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.sku || 'TILE-SKU'}</td>
                    <td style={{ padding: '0.45rem', fontWeight: 600 }}>{item.productName}</td>
                    <td style={{ padding: '0.45rem', color: '#475569' }}>{item.description || '-'}</td>
                    <td style={{ padding: '0.45rem', textAlign: 'center', fontWeight: 700, color: '#2563eb', whiteSpace: 'nowrap' }}>
                      {item.quantity} {item.unit || 'Sq.Ft'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Special Instructions */}
            {selectedChallan.deliveryDetails && (
              <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '1rem', background: '#fffbebfb', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #fef08a' }}>
                <strong>Special Instructions:</strong> {selectedChallan.deliveryDetails}
              </div>
            )}

            {/* Signatures */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1.5rem', paddingTop: '0.75rem', borderTop: '1px solid #cbd5e1', fontSize: '0.775rem', textAlign: 'center' }}>
              <div>
                <br /><br />
                <p style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.3rem', margin: 0, fontWeight: 600 }}>Driver / Transport Sign</p>
              </div>
              <div>
                <br /><br />
                <p style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.3rem', margin: 0, fontWeight: 600 }}>Customer Receiver Sign</p>
              </div>
              <div>
                <br /><br />
                <p style={{ borderTop: '1px dashed #94a3b8', paddingTop: '0.3rem', margin: 0, fontWeight: 700, color: '#0f172a' }}>For Maitri Ceramic</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Challans;
