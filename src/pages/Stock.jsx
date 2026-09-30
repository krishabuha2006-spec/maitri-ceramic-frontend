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
  reconcileProductStock,
  adjustProductStock
} from '../services/stockService';
import { formatDate } from '../utils/formatters';
import { usePermissions } from '../utils/permissions';
import StatusBadge from '../components/StatusBadge';
import { Pagination } from '../components/Pagination';
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
  Info,
  Building2,
  Layers,
  AlertCircle,
  Edit3,
  PackagePlus,
  PackageMinus,
  Save,
  Check
} from 'lucide-react';

export const Stock = () => {
  const { canCreate, canEdit, canDelete } = usePermissions('stock');
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

  // Custom Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page to 1 when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, search, directionFilter]);

  // Product History Modal State
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productHistory, setProductHistory] = useState([]);
  const [productSummary, setProductSummary] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reconcilingId, setReconcilingId] = useState(null);

  // Quick Stock Quantity Adjustment Modal State
  const [adjustModalProduct, setAdjustModalProduct] = useState(null);
  const [adjustData, setAdjustData] = useState({
    mode: 'SET_EXACT', // 'SET_EXACT' | 'ADD' | 'DEDUCT'
    targetQuantity: 0,
    adjustmentQuantity: 10,
    reason: 'MANUAL_ADDITION',
    referenceDocNote: 'Manual Stock Update',
    remarks: ''
  });
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState('');

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

  const handleOpenAdjustModal = (p) => {
    const actual = Number(p.actualStock !== undefined ? p.actualStock : (p.currentStock || p.openingStock || 0));
    setAdjustModalProduct(p);
    setAdjustData({
      mode: 'SET_EXACT',
      targetQuantity: actual,
      adjustmentQuantity: 10,
      reason: 'MANUAL_ADDITION',
      referenceDocNote: 'Manual Stock Update',
      remarks: ''
    });
    setAdjustError('');
  };

  const handleSaveStockAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModalProduct) return;
    setAdjustSaving(true);
    setAdjustError('');

    try {
      const id = adjustModalProduct._id || adjustModalProduct.id;
      await adjustProductStock({
        productId: id,
        mode: adjustData.mode,
        targetQuantity: Number(adjustData.targetQuantity),
        adjustmentQuantity: Number(adjustData.adjustmentQuantity),
        reason: adjustData.reason,
        referenceDocNote: adjustData.referenceDocNote,
        remarks: adjustData.remarks
      });
      showToast(`Stock updated successfully for ${adjustModalProduct.sku}!`);
      setAdjustModalProduct(null);
      await loadStockData();
    } catch (err) {
      console.error('Stock adjust error:', err);
      setAdjustError(err.response?.data?.message || err.message || 'Failed to adjust stock.');
    } finally {
      setAdjustSaving(false);
    }
  };

  const [companyFilter, setCompanyFilter] = useState('ALL');

  // Company-wise Product & Stock Analytics
  const companyStats = useMemo(() => {
    const map = {};
    products.forEach(p => {
      const compName = (typeof p.company === 'object' && p.company?.companyName) 
        ? p.company.companyName 
        : (typeof p.company === 'string' && p.company ? p.company : 'Unassigned Brand');
      
      if (!map[compName]) {
        map[compName] = {
          name: compName,
          totalProducts: 0,
          totalStock: 0,
          lowStockCount: 0
        };
      }
      map[compName].totalProducts += 1;
      const stock = Number(p.currentStock !== undefined ? p.currentStock : (p.openingStock || 0));
      map[compName].totalStock += stock;
      const reorderQty = Number(p.reorderAlertQty || p.alertStockQty || 10);
      if (stock <= reorderQty) {
        map[compName].lowStockCount += 1;
      }
    });
    return Object.values(map).sort((a, b) => b.totalProducts - a.totalProducts);
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const compName = (typeof p.company === 'object' && p.company?.companyName) 
        ? p.company.companyName 
        : (typeof p.company === 'string' && p.company ? p.company : 'Unassigned Brand');
      
      if (companyFilter !== 'ALL' && compName !== companyFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (p.sku && p.sku.toLowerCase().includes(q)) || 
        (p.productName && p.productName.toLowerCase().includes(q)) ||
        (compName && compName.toLowerCase().includes(q)) ||
        (p.productGroup && String(p.productGroup).toLowerCase().includes(q))
      );
    });
  }, [products, search, companyFilter]);

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

  const filteredLowStock = useMemo(() => {
    if (!search.trim()) return lowStock;
    const q = search.toLowerCase();
    return lowStock.filter(p =>
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.productName && p.productName.toLowerCase().includes(q)) ||
      (p.company && p.company.toLowerCase().includes(q))
    );
  }, [lowStock, search]);

  const filteredPurchaseAlerts = useMemo(() => {
    if (!search.trim()) return purchaseAlerts;
    const q = search.toLowerCase();
    return purchaseAlerts.filter(a =>
      (a.sku && a.sku.toLowerCase().includes(q)) ||
      (a.productName && a.productName.toLowerCase().includes(q))
    );
  }, [purchaseAlerts, search]);

  // Paginated Slices for all 4 tabs
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage, pageSize]);

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, currentPage, pageSize]);

  const paginatedLowStock = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLowStock.slice(start, start + pageSize);
  }, [filteredLowStock, currentPage, pageSize]);

  const paginatedPurchaseAlerts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPurchaseAlerts.slice(start, start + pageSize);
  }, [filteredPurchaseAlerts, currentPage, pageSize]);

  return (
    <div style={{ fontFamily: 'var(--font-family)', paddingBottom: '2.5rem' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="floating-toast-container">
          <div className="floating-toast">
            <CheckCircle2 size={16} />
            <span>{toastMessage}</span>
          </div>
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
            data-tooltip="Export Stock Report to Excel"
            style={{ borderRadius: '8px', padding: '0.5rem 0.95rem', fontWeight: 600, fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <FileSpreadsheet size={15} style={{ color: '#16a34a' }} />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
          {canCreate && (
            <Link 
              to="/stock/entry" 
              className="btn btn-primary" 
              data-tooltip="Record New Stock In / Out"
              style={{ borderRadius: '8px', padding: '0.525rem 1.15rem', fontWeight: 700, fontSize: '0.85rem' }}
            >
              <Plus size={16} />
              <span>Stock Entry (In / Out)</span>
            </Link>
          )}
        </div>
      </div>

      {/* Top Inventory KPI Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem'
      }}>
        {/* Total Products & Units */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Boxes size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Products
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {products.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
              {products.reduce((acc, p) => acc + Number(p.currentStock !== undefined ? p.currentStock : (p.openingStock || 0)), 0).toLocaleString()} Total Units in Stock
            </div>
          </div>
        </div>

        {/* Low Stock Alerts (Urgent) */}
        <div 
          onClick={() => setActiveTab('lowStock')}
          style={{
            backgroundColor: lowStock.length > 0 ? '#fef2f2' : '#ffffff',
            borderRadius: '12px',
            border: lowStock.length > 0 ? '1px solid #fca5a5' : '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: lowStock.length > 0 ? '#fee2e2' : '#f8fafc', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: lowStock.length > 0 ? '#991b1b' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Low Stock Alerts</span>
              {lowStock.length > 0 && (
                <span style={{ width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.65rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {lowStock.length}
                </span>
              )}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: lowStock.length > 0 ? '#dc2626' : '#0f172a', lineHeight: 1.2 }}>
              {lowStock.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: lowStock.length > 0 ? '#b91c1c' : '#64748b', marginTop: '0.15rem' }}>
              {lowStock.length > 0 ? 'Requires stock purchase replenishment' : 'All stock levels healthy'}
            </div>
          </div>
        </div>

        {/* Purchase Shortfalls */}
        <div 
          onClick={() => setActiveTab('purchaseAlerts')}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            padding: '1.15rem 1.25rem',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            cursor: 'pointer'
          }}
        >
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#fff7ed', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <TrendingDown size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Purchase Alerts
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {purchaseAlerts.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
              Pending order shortage items
            </div>
          </div>
        </div>

        {/* Brands / Companies */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '1.15rem 1.25rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', backgroundColor: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Brand Portfolios
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
              {companyStats.length}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
              Company brands in catalog
            </div>
          </div>
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
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
        >
          <span>Low Stock Alerts</span>
          {lowStock.length > 0 ? (
            <span style={{
              minWidth: '20px',
              height: '20px',
              padding: '0 5px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1
            }}>
              {lowStock.length}
            </span>
          ) : (
            <span style={{ opacity: 0.7 }}>(0)</span>
          )}
        </button>
        <button
          className={`tab-btn ${activeTab === 'purchaseAlerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchaseAlerts')}
        >
          Purchase Alerts ({purchaseAlerts.length})
        </button>
      </div>

      {/* Filter / Search Bar with Brand Dropdown */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search SKU, product name, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: '2.25rem', height: '38px', borderRadius: '8px', fontSize: '0.85rem' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Company / Brand Filter Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Building2 size={15} style={{ color: '#64748b' }} />
            <select
              className="form-control"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              style={{ height: '38px', borderRadius: '8px', fontSize: '0.825rem', minWidth: '160px', width: 'auto' }}
            >
              <option value="ALL">All Brands / Companies</option>
              {companyStats.map((cs, idx) => (
                <option key={idx} value={cs.name}>
                  {cs.name} ({cs.totalProducts})
                </option>
              ))}
            </select>
          </div>

          {companyFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setCompanyFilter('ALL')}
              style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            >
              <X size={13} /> Reset Brand
            </button>
          )}
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
          <>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>SKU</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569' }}>Product Description</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Company</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Product Type</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Actual Stock</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Mgmt Stock</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Available</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading inventory records...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No products found.</td></tr>
                ) : (
                  paginatedProducts.map(p => {
                    const actual = Number(p.actualStock || 0);
                    const mgmt = Number(p.managementStock || 0);
                    const avail = Math.max(0, actual - mgmt);
                    const isReconciling = reconcilingId === (p._id || p.id);

                    return (
                      <tr key={p._id || p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {p.sku}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.8rem', color: '#1e293b' }}>
                          {p.productName}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          {p.company || '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.78rem', color: '#475569', whiteSpace: 'nowrap' }}>
                          {p.productType || p.productGroup || '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 800, color: actual < 50 ? '#dc2626' : '#0f172a', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {actual} {p.unit || 'Sq.Ft'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 600, color: '#d97706', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {mgmt} {p.unit || 'Sq.Ft'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', fontSize: '0.825rem', fontWeight: 700, color: '#16a34a', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {avail} {p.unit || 'Sq.Ft'}
                        </td>
                        <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleOpenAdjustModal(p)}
                                data-tooltip="Manage Stock Qty"
                                title="Manage Stock Quantity (Set / In / Out)"
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  padding: 0,
                                  borderRadius: '6px',
                                  border: '1px solid #bbf7d0',
                                  background: '#f0fdf4',
                                  color: '#16a34a',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'all 0.15s ease'
                                }}
                              >
                                <SlidersHorizontal size={14} />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenHistoryModal(p)}
                              data-tooltip="Stock Movement Ledger"
                              title="View Stock Movement History & Ledger"
                              style={{
                                width: '30px',
                                height: '30px',
                                padding: 0,
                                fontSize: '0.725rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#334155',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <History size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReconcile(p)}
                              disabled={isReconciling}
                              data-tooltip="Reconcile Stock"
                              title="Reconcile product stock against ledger entries (Safety Net)"
                              style={{
                                width: '30px',
                                height: '30px',
                                padding: 0,
                                fontSize: '0.725rem',
                                borderRadius: '6px',
                                border: '1px solid #dbeafe',
                                background: '#eff6ff',
                                color: '#2563eb',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isReconciling ? (
                                <RefreshCw size={13} className="spin-animation" />
                              ) : (
                                <ShieldCheck size={14} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
            {!loading && filteredProducts.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredProducts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </>
        )}

        {activeTab === 'movements' && (
          <>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Entry No</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Date</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Direction</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>SKU</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569' }}>Product Description</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Qty</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569' }}>Ledger Reason</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>Ref Doc</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading movement ledger...</td></tr>
                ) : filteredEntries.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>No ledger entries found.</td></tr>
                ) : (
                  paginatedEntries.map(e => {
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
            {!loading && filteredEntries.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredEntries.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </>
        )}

        {activeTab === 'lowStock' && (
          <>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>SKU</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569' }}>Product Description</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569' }}>Company</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Current Stock</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Reorder Level</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Shortfall</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Loading low stock report...</td></tr>
                ) : filteredLowStock.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#16a34a', fontWeight: 600 }}>All products have sufficient stock levels!</td></tr>
                ) : (
                  paginatedLowStock.map(p => {
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
            {!loading && filteredLowStock.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredLowStock.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </>
        )}

        {activeTab === 'purchaseAlerts' && (
          <>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.785rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>SKU</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569' }}>Product Description</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Confirmed Quoted</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Physical Stock</th>
                  <th style={{ padding: '0.65rem 0.75rem', fontWeight: 700, color: '#475569', textAlign: 'center', whiteSpace: 'nowrap' }}>Net Shortfall</th>
                  <th style={{ padding: '0.65rem 0.75rem', textAlign: 'center', whiteSpace: 'nowrap' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>Calculating purchase alerts...</td></tr>
                ) : filteredPurchaseAlerts.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: '#16a34a', fontWeight: 600 }}>No stock shortfalls against confirmed orders.</td></tr>
                ) : (
                  paginatedPurchaseAlerts.map((a, idx) => (
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
            {!loading && filteredPurchaseAlerts.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredPurchaseAlerts.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
              />
            )}
          </>
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

      {/* Quick Stock Quantity Adjustment Modal */}
      {adjustModalProduct && (() => {
        const currentActual = Number(adjustModalProduct.actualStock !== undefined ? adjustModalProduct.actualStock : (adjustModalProduct.currentStock || adjustModalProduct.openingStock || 0));
        const currentMgmt = Number(adjustModalProduct.managementStock || 0);
        const currentAvail = Math.max(0, currentActual - currentMgmt);
        const unitLabel = adjustModalProduct.unit || 'Sq.Ft';

        let projectedStock = currentActual;
        let delta = 0;
        if (adjustData.mode === 'SET_EXACT') {
          projectedStock = Number(adjustData.targetQuantity) || 0;
          delta = projectedStock - currentActual;
        } else if (adjustData.mode === 'ADD') {
          delta = Number(adjustData.adjustmentQuantity) || 0;
          projectedStock = currentActual + delta;
        } else if (adjustData.mode === 'DEDUCT') {
          delta = -(Number(adjustData.adjustmentQuantity) || 0);
          projectedStock = currentActual + delta;
        }

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '560px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              animation: 'fadeIn 0.2s ease-out'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                backgroundColor: '#f8fafc'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '5px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe'
                    }}>
                      {adjustModalProduct.sku}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '5px',
                      backgroundColor: '#f1f5f9',
                      color: '#475569'
                    }}>
                      {adjustModalProduct.company || 'Maitri Ceramic'}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    Manage Stock Quantity
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                    {adjustModalProduct.productName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustModalProduct(null)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: '#64748b',
                    padding: '0.25rem',
                    borderRadius: '6px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Current Stock Metrics Bar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem',
                padding: '0.85rem 1.5rem',
                backgroundColor: '#f1f5f9',
                borderBottom: '1px solid #e2e8f0'
              }}>
                <div style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Current Actual</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: currentActual < 50 ? '#dc2626' : '#0f172a' }}>
                    {currentActual} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{unitLabel}</span>
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Management Reserved</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#d97706' }}>
                    {currentMgmt} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{unitLabel}</span>
                  </div>
                </div>
                <div style={{ background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Available to Sell</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: currentAvail > 0 ? '#16a34a' : '#dc2626' }}>
                    {currentAvail} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>{unitLabel}</span>
                  </div>
                </div>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSaveStockAdjustment} style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                {adjustError && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    padding: '0.65rem 0.85rem',
                    color: '#991b1b',
                    fontSize: '0.825rem',
                    marginBottom: '1rem'
                  }}>
                    <AlertCircle size={16} style={{ flexShrink: 0, color: '#dc2626' }} />
                    <span>{adjustError}</span>
                  </div>
                )}

                {/* Adjustment Mode Segmented Control */}
                <div style={{ marginBottom: '1.15rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.4rem' }}>
                    Adjustment Action / Mode
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.35rem',
                    backgroundColor: '#f1f5f9',
                    padding: '0.25rem',
                    borderRadius: '10px'
                  }}>
                    <button
                      type="button"
                      onClick={() => setAdjustData(prev => ({ ...prev, mode: 'SET_EXACT', reason: 'MANUAL_ADDITION' }))}
                      style={{
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.5rem 0.35rem',
                        fontSize: '0.775rem',
                        fontWeight: adjustData.mode === 'SET_EXACT' ? 700 : 600,
                        backgroundColor: adjustData.mode === 'SET_EXACT' ? '#ffffff' : 'transparent',
                        color: adjustData.mode === 'SET_EXACT' ? '#2563eb' : '#64748b',
                        boxShadow: adjustData.mode === 'SET_EXACT' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <SlidersHorizontal size={13} />
                      <span>Set Exact Total</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustData(prev => ({ ...prev, mode: 'ADD', reason: 'PURCHASE_ENTRY' }))}
                      style={{
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.5rem 0.35rem',
                        fontSize: '0.775rem',
                        fontWeight: adjustData.mode === 'ADD' ? 700 : 600,
                        backgroundColor: adjustData.mode === 'ADD' ? '#ffffff' : 'transparent',
                        color: adjustData.mode === 'ADD' ? '#16a34a' : '#64748b',
                        boxShadow: adjustData.mode === 'ADD' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <PackagePlus size={14} />
                      <span>+ Stock In (Add)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustData(prev => ({ ...prev, mode: 'DEDUCT', reason: 'MANUAL_DEDUCTION' }))}
                      style={{
                        border: 'none',
                        borderRadius: '7px',
                        padding: '0.5rem 0.35rem',
                        fontSize: '0.775rem',
                        fontWeight: adjustData.mode === 'DEDUCT' ? 700 : 600,
                        backgroundColor: adjustData.mode === 'DEDUCT' ? '#ffffff' : 'transparent',
                        color: adjustData.mode === 'DEDUCT' ? '#dc2626' : '#64748b',
                        boxShadow: adjustData.mode === 'DEDUCT' ? '0 2px 5px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <PackageMinus size={14} />
                      <span>- Stock Out (Deduct)</span>
                    </button>
                  </div>
                </div>

                {/* Mode: SET_EXACT */}
                {adjustData.mode === 'SET_EXACT' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.825rem', fontWeight: 700, color: '#1e293b', display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span>New Exact Physical Stock ({unitLabel})</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Current: {currentActual} {unitLabel}</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="form-control"
                      value={adjustData.targetQuantity}
                      onChange={(e) => setAdjustData({ ...adjustData, targetQuantity: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      required
                      style={{ height: '44px', borderRadius: '8px', fontSize: '1rem', fontWeight: 800 }}
                    />

                    {/* Quick Preset Buttons */}
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                      {[0, 50, 100, 200, 500, 1000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAdjustData({ ...adjustData, targetQuantity: val })}
                          style={{
                            border: '1px solid #e2e8f0',
                            backgroundColor: Number(adjustData.targetQuantity) === val ? '#eff6ff' : '#ffffff',
                            color: Number(adjustData.targetQuantity) === val ? '#2563eb' : '#475569',
                            fontWeight: 600,
                            fontSize: '0.725rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode: ADD */}
                {adjustData.mode === 'ADD' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.825rem', fontWeight: 700, color: '#166534', display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span>Quantity to Add (+ Inflow)</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Current: {currentActual} {unitLabel}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="form-control"
                      value={adjustData.adjustmentQuantity}
                      onChange={(e) => setAdjustData({ ...adjustData, adjustmentQuantity: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      required
                      style={{ height: '44px', borderRadius: '8px', fontSize: '1rem', fontWeight: 800, borderColor: '#bbf7d0', color: '#15803d' }}
                    />

                    {/* Quick Preset Add Buttons */}
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                      {[5, 10, 25, 50, 100, 250].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAdjustData({ ...adjustData, adjustmentQuantity: val })}
                          style={{
                            border: '1px solid #bbf7d0',
                            backgroundColor: Number(adjustData.adjustmentQuantity) === val ? '#dcfce7' : '#ffffff',
                            color: '#166534',
                            fontWeight: 700,
                            fontSize: '0.725rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          +{val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode: DEDUCT */}
                {adjustData.mode === 'DEDUCT' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.825rem', fontWeight: 700, color: '#991b1b', display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span>Quantity to Deduct (- Outflow)</span>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Current: {currentActual} {unitLabel}</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={currentActual}
                      step="1"
                      className="form-control"
                      value={adjustData.adjustmentQuantity}
                      onChange={(e) => setAdjustData({ ...adjustData, adjustmentQuantity: e.target.value })}
                      onFocus={(e) => e.target.select()}
                      required
                      style={{ height: '44px', borderRadius: '8px', fontSize: '1rem', fontWeight: 800, borderColor: '#fca5a5', color: '#dc2626' }}
                    />

                    {/* Quick Preset Deduct Buttons */}
                    <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.45rem', flexWrap: 'wrap' }}>
                      {[1, 5, 10, 20, 50].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAdjustData({ ...adjustData, adjustmentQuantity: val })}
                          style={{
                            border: '1px solid #fca5a5',
                            backgroundColor: Number(adjustData.adjustmentQuantity) === val ? '#fee2e2' : '#ffffff',
                            color: '#991b1b',
                            fontWeight: 700,
                            fontSize: '0.725rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '5px',
                            cursor: 'pointer'
                          }}
                        >
                          -{val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Calculation Impact Callout */}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  backgroundColor: delta > 0 ? '#f0fdf4' : (delta < 0 ? '#fef2f2' : '#f8fafc'),
                  border: `1px solid ${delta > 0 ? '#bbf7d0' : (delta < 0 ? '#fecaca' : '#e2e8f0')}`,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {delta > 0 ? (
                      <TrendingUp size={18} style={{ color: '#16a34a' }} />
                    ) : delta < 0 ? (
                      <TrendingDown size={18} style={{ color: '#dc2626' }} />
                    ) : (
                      <Check size={18} style={{ color: '#64748b' }} />
                    )}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: delta > 0 ? '#166534' : (delta < 0 ? '#991b1b' : '#334155') }}>
                        {delta > 0 ? `+${delta} ${unitLabel} (Stock In)` : (delta < 0 ? `${delta} ${unitLabel} (Stock Out)` : 'No change in stock')}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                        Ledger adjustment impact
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Resulting Actual Stock</div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 800, color: projectedStock < 50 ? '#dc2626' : '#0f172a' }}>
                      {projectedStock} {unitLabel}
                    </div>
                  </div>
                </div>

                {/* Ledger Reason */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Ledger Reason *
                  </label>
                  <select
                    className="form-control"
                    value={adjustData.reason}
                    onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                    style={{ height: '40px', borderRadius: '8px', fontSize: '0.825rem', fontWeight: 600 }}
                  >
                    {delta >= 0 ? (
                      <>
                        <option value="MANUAL_ADDITION">MANUAL_ADDITION (Manual Count / Inventory Addition)</option>
                        <option value="PURCHASE_ENTRY">PURCHASE_ENTRY (Purchase Consignment Received)</option>
                        <option value="OPENING_STOCK">OPENING_STOCK (Opening Balance Correction)</option>
                        <option value="OTHER">OTHER (Other Inflow)</option>
                      </>
                    ) : (
                      <>
                        <option value="MANUAL_DEDUCTION">MANUAL_DEDUCTION (Breakage / Scrap / Deduction)</option>
                        <option value="OTHER">OTHER (Other Outflow)</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Reference Document / PO / Note */}
                <div style={{ marginBottom: '0.85rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Reference Document / Note
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Physical Count Audit 2026 / Vendor Bill #882"
                    value={adjustData.referenceDocNote}
                    onChange={(e) => setAdjustData({ ...adjustData, referenceDocNote: e.target.value })}
                    style={{ height: '40px', borderRadius: '8px', fontSize: '0.825rem' }}
                  />
                </div>

                {/* Warehouse Remarks */}
                <div style={{ marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '0.3rem' }}>
                    Warehouse Remarks / Reason Notes
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Optional warehouse internal remarks..."
                    value={adjustData.remarks}
                    onChange={(e) => setAdjustData({ ...adjustData, remarks: e.target.value })}
                    style={{ borderRadius: '8px', fontSize: '0.825rem' }}
                  />
                </div>

                {/* Modal Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setAdjustModalProduct(null)}
                    style={{ borderRadius: '8px', height: '38px', padding: '0 1.15rem', fontSize: '0.825rem', fontWeight: 600 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={adjustSaving}
                    style={{
                      borderRadius: '8px',
                      height: '38px',
                      padding: '0 1.35rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      backgroundColor: '#2563eb'
                    }}
                  >
                    {adjustSaving ? (
                      <>
                        <RefreshCw size={14} className="spin-animation" />
                        <span>Updating Stock...</span>
                      </>
                    ) : (
                      <>
                        <Save size={15} />
                        <span>Update Stock Quantity</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Stock;

