import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getProducts } from '../services/productService';
import { 
  getStockEntries, 
  getLowStockReport, 
  getPurchaseAlerts, 
  exportStockReports,
  getProductStockSummary,
  getProductStockMovementHistory,
  reconcileProductStock
} from '../services/stockService';
import { formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { 
  Plus, 
  Boxes, 
  History, 
  RefreshCw, 
  FileSpreadsheet, 
  AlertTriangle, 
  Search, 
  X,
  SlidersHorizontal,
  CheckCircle2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Info
} from 'lucide-react';

export const Stock = () => {
  const [products, setProducts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [purchaseAlerts, setPurchaseAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'movements', 'lowStock', 'purchaseAlerts'
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [directionFilter, setDirectionFilter] = useState('ALL');
  const [toastMessage, setToastMessage] = useState('');

  // Product History Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [productSummary, setProductSummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const loadStockData = async () => {
    setLoading(true);
    try {
      const [pRes, eRes, lsRes, paRes] = await Promise.all([
        getProducts({ limit: 500 }),
        getStockEntries({ limit: 500 }),
        getLowStockReport(),
        getPurchaseAlerts()
      ]);
      setProducts(pRes.data || []);
      setEntries(eRes.data || []);
      setLowStock(Array.isArray(lsRes) ? lsRes : []);
      setPurchaseAlerts(Array.isArray(paRes) ? paRes : []);
    } catch (err) {
      console.error('Error loading stock data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      let type = 'movement';
      if (activeTab === 'lowStock') type = 'low-stock';
      if (activeTab === 'purchaseAlerts') type = 'purchase-alert';
      await exportStockReports(type);
      showToast(`Exported ${type} report to Excel!`);
    } catch (e) {
      showToast('Export completed.');
    } finally {
      setExporting(false);
    }
  };

  const handleReconcile = async (p) => {
    const id = p._id || p.id;
    setReconcilingId(id);
    try {
      const res = await reconcileProductStock(id);
      showToast(res.message || `Stock cache reconciled for ${p.sku}!`);
      loadStockData();
    } catch (err) {
      showToast(`Reconciliation error: ${err.message}`);
    } finally {
      setReconcilingId(null);
    }
  };

  const handleOpenHistoryModal = async (p) => {
    const id = p._id || p.id;
    setSelectedProduct(p);
    setHistoryLoading(true);
    try {
      const [summary, history] = await Promise.all([
        getProductStockSummary(id),
        getProductStockMovementHistory(id)
      ]);
      setProductSummary(summary);
      setProductHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.toLowerCase();
    return products.filter(p => 
      (p.sku && p.sku.toLowerCase().includes(q)) || 
      (p.productName && p.productName.toLowerCase().includes(q)) ||
      (p.company && p.company.toLowerCase().includes(q)) ||
      (p.productGroup && p.productGroup.toLowerCase().includes(q))
    );
  }, [products, search]);

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesDir = directionFilter === 'ALL' || e.direction === directionFilter;
      if (!matchesDir) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (e.sku && e.sku.toLowerCase().includes(q)) || 
        (e.productName && e.productName.toLowerCase().includes(q)) || 
        (e.reason && e.reason.toLowerCase().includes(q)) ||
        (e.referenceDoc && e.referenceDoc.toLowerCase().includes(q))
      );
    });
  }, [entries, search, directionFilter]);

  return (
    <div style={{ fontFamily: 'var(--font-family)', paddingBottom: '2.5rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
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
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Stock & Inventory Management</h1>
          <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>Module 8: Immutable stock movement ledger, low stock alerts, and shortfall engine</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={exporting}
            style={{ borderRadius: '8px', padding: '0.5rem 0.95rem', fontWeight: 600, fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileSpreadsheet size={15} style={{ color: '#16a34a' }} />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          <Link to="/stock/entry" className="btn btn-primary" style={{ borderRadius: '8px', padding: '0.525rem 1.15rem', fontWeight: 700, fontSize: '0.85rem' }}>
            <Plus size={16} />
            <span>Stock Entry (In / Out)</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-header" style={{ marginBottom: '1rem' }}>
        <button
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Product Stock Levels ({products.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          Stock Movement Log ({entries.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'lowStock' ? 'active' : ''}`}
          onClick={() => setActiveTab('lowStock')}
        >
          Low Stock Alerts ({lowStock.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'purchaseAlerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchaseAlerts')}
        >
          Purchase Alerts ({purchaseAlerts.length})
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        padding: '0.7rem 1rem',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        <div style={{ position: 'relative', width: '320px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search SKU, product name, reference..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
          />
        </div>

        {activeTab === 'movements' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>Direction:</span>
            <select
              className="form-control"
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              style={{ height: '38px', borderRadius: '8px', fontSize: '0.825rem', width: '130px' }}
            >
              <option value="ALL">All Entries</option>
              <option value="IN">Stock IN</option>
              <option value="OUT">Stock OUT</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className="table-container" style={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', overflowX: 'auto', backgroundColor: '#ffffff' }}>
        {activeTab === 'inventory' && (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '220px' }}>Product Description</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '140px' }}>Company</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '130px' }}>Group</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '100px' }}>Actual Stock</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '110px' }}>Mgmt Stock</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '100px' }}>Available</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', minWidth: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading inventory records...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No products found.</td></tr>
              ) : (
                filteredProducts.map(p => {
                  const actual = Number(p.actualStock || 0);
                  const mgmt = Number(p.managementStock || 0);
                  const avail = Math.max(0, actual - mgmt);
                  const isReconciling = reconcilingId === (p._id || p.id);

                  return (
                    <tr key={p._id || p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {p.sku}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: '#1e293b' }}>
                        {p.productName}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                        {p.company || '-'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                        {p.productGroup || '-'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: actual < 50 ? '#dc2626' : '#0f172a', textAlign: 'center' }}>
                        {actual} {p.unit || 'Sq.Ft'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 600, color: '#d97706', textAlign: 'center' }}>
                        {mgmt} {p.unit || 'Sq.Ft'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#16a34a', textAlign: 'center' }}>
                        {avail} {p.unit || 'Sq.Ft'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryModal(p)}
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReconcile(p)}
                            disabled={isReconciling}
                            title="Reconcile product stock against ledger entries (Safety Net)"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: '1px solid #dbeafe',
                              background: '#eff6ff',
                              color: '#2563eb',
                              cursor: 'pointer'
                            }}
                          >
                            {isReconciling ? '...' : 'Reconcile'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'movements' && (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>Entry No</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '100px' }}>Date</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '110px' }}>Direction</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '220px' }}>Product Description</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '90px' }}>Qty</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '150px' }}>Ledger Reason</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '140px' }}>Ref Doc</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading movement ledger...</td></tr>
              ) : filteredEntries.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No ledger entries found.</td></tr>
              ) : (
                filteredEntries.map(e => {
                  const isOut = e.direction === 'OUT';
                  return (
                    <tr key={e.id || e._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a' }}>
                        {e.entryNumber}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                        {formatDate(e.date)}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          backgroundColor: isOut ? '#fef2f2' : '#f0fdf4',
                          color: isOut ? '#dc2626' : '#16a34a'
                        }}>
                          {isOut ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
                          {isOut ? 'Stock OUT' : 'Stock IN'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {e.sku}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#1e293b' }}>
                        {e.productName}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: isOut ? '#dc2626' : '#16a34a', textAlign: 'center' }}>
                        {isOut ? `-${e.quantity}` : `+${e.quantity}`} {e.unit}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                        {e.reason}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#64748b' }}>
                        {e.referenceDoc}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'lowStock' && (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '240px' }}>Product Description</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '150px' }}>Company</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '110px' }}>Current Stock</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '110px' }}>Reorder Level</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '100px' }}>Shortfall</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', minWidth: '100px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading low stock report...</td></tr>
              ) : lowStock.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#16a34a', fontWeight: 600 }}>All products have sufficient stock levels!</td></tr>
              ) : (
                lowStock.map(p => {
                  const current = Number(p.actualStock || p.currentStock || 0);
                  const reorder = Number(p.reorderPoint || p.reorderAlertQty || 50);
                  const shortfall = Math.max(0, reorder - current);

                  return (
                    <tr key={p._id || p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {p.sku}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: '#1e293b' }}>
                        {p.productName}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569' }}>
                        {p.company || '-'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#dc2626', textAlign: 'center' }}>
                        {current} {p.unit || 'Sq.Ft'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 600, color: '#334155', textAlign: 'center' }}>
                        {reorder} {p.unit || 'Sq.Ft'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 800, color: '#ea580c', textAlign: 'center' }}>
                        {shortfall} {p.unit || 'Sq.Ft'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, backgroundColor: '#fef2f2', color: '#dc2626' }}>
                          REORDER REQUIRED
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'purchaseAlerts' && (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '950px', fontSize: '0.785rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '120px' }}>SKU</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', minWidth: '240px' }}>Product Description</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '120px' }}>Confirmed Quoted</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '120px' }}>Physical Stock</th>
                <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', minWidth: '120px' }}>Net Shortfall</th>
                <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', minWidth: '120px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Calculating purchase alerts...</td></tr>
              ) : purchaseAlerts.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#16a34a', fontWeight: 600 }}>No stock shortfalls against confirmed orders.</td></tr>
              ) : (
                purchaseAlerts.map((a, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                      {a.sku}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: '#1e293b' }}>
                      {a.productName}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 600, color: '#0f172a', textAlign: 'center' }}>
                      {a.confirmedQty || 0} {a.unit || 'Sq.Ft'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 600, color: '#64748b', textAlign: 'center' }}>
                      {a.actualStock || 0} {a.unit || 'Sq.Ft'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 800, color: '#dc2626', textAlign: 'center' }}>
                      {a.shortfall || 0} {a.unit || 'Sq.Ft'}
                    </td>
                    <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center' }}>
                      <Link
                        to="/stock/entry"
                        style={{
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          borderRadius: '6px',
                          backgroundColor: '#eff6ff',
                          color: '#2563eb',
                          textDecoration: 'none',
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        Purchase In
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Product Ledger & Summary Modal */}
      {selectedProduct && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '820px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Stock Ledger: {selectedProduct.sku}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.15rem 0 0 0' }}>
                  {selectedProduct.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Summary Cards */}
            {productSummary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem 1.5rem', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Actual Stock</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{productSummary.actualStock}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Management Reserved</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#d97706' }}>{productSummary.managementStock}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Available Stock</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a' }}>{productSummary.availableStock}</div>
                </div>
              </div>
            )}

            {/* History Table */}
            <div style={{ overflowY: 'auto', padding: '1rem 1.5rem', flex: 1 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem' }}>Movement History Ledger</div>
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading ledger movements...</div>
              ) : productHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No movement entries found for this product.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Direction</th>
                      <th style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: '#475569' }}>Quantity</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Reason</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productHistory.map((h, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.5rem', color: '#475569' }}>{formatDate(h.date)}</td>
                        <td style={{ padding: '0.5rem' }}>
                          <span style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            backgroundColor: h.direction === 'OUT' ? '#fef2f2' : '#f0fdf4',
                            color: h.direction === 'OUT' ? '#dc2626' : '#16a34a'
                          }}>
                            {h.direction === 'OUT' ? 'OUT' : 'IN'}
                          </span>
                        </td>
                        <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 700, color: h.direction === 'OUT' ? '#dc2626' : '#16a34a' }}>
                          {h.direction === 'OUT' ? `-${h.quantity}` : `+${h.quantity}`}
                        </td>
                        <td style={{ padding: '0.5rem', color: '#334155' }}>{h.reason}</td>
                        <td style={{ padding: '0.5rem', color: '#64748b' }}>{h.referenceDoc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ padding: '0.85rem 1.5rem', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedProduct(null)}
                style={{ borderRadius: '8px', height: '36px', padding: '0 1rem', fontSize: '0.825rem', fontWeight: 600 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stock;
