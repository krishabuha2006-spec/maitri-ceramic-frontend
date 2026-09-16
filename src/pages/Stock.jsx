import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/productService';
import { getStockMovements } from '../services/stockService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { Plus, Boxes, History, RefreshCw } from 'lucide-react';

export const Stock = () => {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStockData = async () => {
      setLoading(true);
      try {
        const [pRes, mRes] = await Promise.all([getProducts(), getStockMovements()]);
        setProducts(pRes.data || []);
        setMovements(mRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadStockData();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Stock & Inventory Management</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Track Actual Stock, Reserved Management Stock & Purchase Requirements</p>
        </div>
        <Link to="/stock/entry" className="btn btn-primary">
          <Plus size={16} />
          <span>Stock Entry (In / Out)</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Product Stock Levels
        </button>
        <button
          className={`tab-btn ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          Stock Movement Log
        </button>
      </div>

      <div className="table-container">
        {activeTab === 'inventory' ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Unit</th>
                <th>Actual Stock</th>
                <th>Mgmt Stock</th>
                <th>Available Stock</th>
                <th>Reorder Level</th>
                <th>Stock Status</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2.5rem' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Loading stock levels...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>No products found.</td></tr>
              ) : (
                products.map(p => {
                  const actual = p.actualStock || 0;
                  const mgmt = p.managementStock || 0;
                  const avail = Math.max(0, actual - mgmt);
                  const reorder = p.reorderLevel || 0;

                  let statusText = 'Available';
                  if (avail < reorder) statusText = 'Purchase Required';
                  else if (actual <= reorder) statusText = 'Low Stock';

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.sku}</td>
                      <td>{p.productName}</td>
                      <td>{p.unit}</td>
                      <td style={{ fontWeight: 700, color: actual <= reorder ? '#dc2626' : '#0f172a' }}>{actual}</td>
                      <td style={{ color: '#0284c7', fontWeight: 600 }}>{mgmt}</td>
                      <td style={{ fontWeight: 700, color: '#16a34a' }}>{avail}</td>
                      <td>{reorder}</td>
                      <td><StatusBadge status={statusText} /></td>
                      <td style={{ textAlign: 'center' }}>
                        <Link to="/stock/entry" className="btn btn-secondary btn-sm">
                          Adjust Stock
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Transaction Type</th>
                <th>Quantity</th>
                <th>Balance Log</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No movement transactions.</td></tr>
              ) : (
                movements.map(m => (
                  <tr key={m.id}>
                    <td>{formatDate(m.date)}</td>
                    <td style={{ fontWeight: 600 }}>{m.sku}</td>
                    <td>{m.productName}</td>
                    <td><StatusBadge status={m.transaction} /></td>
                    <td style={{ fontWeight: 700, color: m.quantity > 0 ? '#16a34a' : '#dc2626' }}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td>{m.balance}</td>
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

export default Stock;
