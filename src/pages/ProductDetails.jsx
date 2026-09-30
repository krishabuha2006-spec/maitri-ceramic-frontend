import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProductById, deleteProduct } from '../services/productService';
import { getQuotations } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { 
  ArrowLeft, Edit, Boxes, FileText, Trash2, 
  Tag, Ruler, Palette, Box, DollarSign, Building2, 
  CheckCircle2, AlertTriangle, Layers, Package, ShieldCheck
} from 'lucide-react';

export const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [quotationHistory, setQuotationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const prd = await getProductById(id);
        setProduct(prd);

        const qtRes = await getQuotations();
        const allQts = qtRes.data || [];

        // Filter quotations containing this product SKU or Name
        const trackedQts = [];
        allQts.forEach(q => {
          if (q.items) {
            q.items.forEach(item => {
              if (item.sku === prd.sku || item.productName === prd.productName) {
                trackedQts.push({
                  quotationNumber: q.quotationNumber,
                  customerName: q.customerName,
                  date: q.date,
                  quantity: item.quantity,
                  amount: item.netAmount || (item.rate * item.quantity),
                  status: q.status
                });
              }
            });
          }
        });

        setQuotationHistory(trackedQts);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleDelete = () => {
    if (!product) return;
    setShowConfirm(true);
  };

  const handleConfirmDelete = async () => {
    setShowConfirm(false);
    try {
      await deleteProduct(product.id || product._id);
      navigate('/products');
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <div className="spinner-circle" />
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#64748b' }}>Loading product details...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center', padding: '2.5rem', backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
        <AlertTriangle size={36} style={{ color: '#dc2626', margin: '0 auto 1rem auto' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Product Not Found</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>The product you are looking for may have been deleted or the ID is invalid.</p>
        <Link to="/products" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', borderRadius: '8px' }}>
          <ArrowLeft size={16} />
          <span>Back to Products</span>
        </Link>
      </div>
    );
  }

  const isTile = product.category === 'Tiles';
  const isLowStock = Number(product.actualStock || product.currentStock || 0) <= Number(product.reorderLevel || product.alertStockQty || 10);

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '0.5rem 1rem 4rem 1rem' }}>
      
      {/* Top Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link 
            to="/products" 
            className="btn btn-secondary"
            style={{ borderRadius: '9px', padding: '0.5rem 0.9rem', fontSize: '0.825rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ArrowLeft size={15} />
            <span>Back to Products</span>
          </Link>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Product Specifications & View
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
          <button 
            type="button" 
            onClick={handleDelete} 
            className="btn btn-secondary" 
            style={{ color: '#dc2626', borderColor: '#fca5a5', backgroundColor: '#fef2f2', borderRadius: '9px', padding: '0.5rem 1rem', fontSize: '0.825rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
          <Link 
            to={`/products/edit/${product.id || product._id}`} 
            className="btn btn-primary"
            style={{ borderRadius: '9px', padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)' }}
          >
            <Edit size={15} />
            <span>Edit Product</span>
          </Link>
        </div>
      </div>

      {/* Hero Card: 1. Main Product Overview */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Product Visual Box */}
          <div style={{
            width: '150px',
            height: '150px',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            {product.image ? (
              <img 
                src={product.image} 
                alt={product.productName} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                <Package size={42} style={{ color: '#2563eb', opacity: 0.8, marginBottom: '0.4rem' }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, display: 'block' }}>{product.category || 'Ceramic'}</span>
              </div>
            )}
          </div>

          {/* Details Column */}
          <div style={{ flex: 1, minWidth: '280px' }}>
            {/* Badges Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '0.825rem',
                fontWeight: 800,
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                padding: '0.2rem 0.65rem',
                borderRadius: '7px'
              }}>
                {product.sku || 'SKU-NONE'}
              </span>

              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                color: '#334155',
                border: '1px solid #cbd5e1',
                padding: '0.2rem 0.6rem',
                borderRadius: '7px'
              }}>
                {product.category || 'Sanitaryware'}
              </span>

              <StatusBadge status={product.status || 'Active'} />

              {isLowStock && (
                <span style={{
                  fontSize: '0.725rem',
                  fontWeight: 800,
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <AlertTriangle size={13} />
                  <span>Low Stock Alert</span>
                </span>
              )}
            </div>

            {/* Product Title */}
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.65rem 0', lineHeight: 1.3 }}>
              {product.productName}
            </h1>

            {/* Full Technical Description */}
            {product.fullDescription && (
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1.25rem 0', lineHeight: 1.5, backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                {product.fullDescription}
              </p>
            )}

            {/* Specifications Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid #f1f5f9'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Company / Brand</span>
                <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>{product.company || '-'}</span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Product Type</span>
                <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>
                  {product.productType || product.productGroup || '-'} 
                  {product.productSubType ? ` (${product.productSubType})` : ''}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>
                  {isTile ? 'Tile Size' : 'Range / Collection'}
                </span>
                <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#2563eb' }}>
                  {isTile ? (product.size || product.rangeOrSize || '-') : (product.range || product.rangeOrSize || '-')}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Colour & Finish</span>
                <span style={{ fontSize: '0.925rem', fontWeight: 600, color: '#0f172a' }}>
                  {product.colourName || 'White'} {product.finish ? `• ${product.finish}` : ''}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>HSN Code</span>
                <span style={{ fontSize: '0.925rem', fontFamily: 'monospace', fontWeight: 700, color: '#334155' }}>{product.hsnCode || '-'}</span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>Unit of Measure</span>
                <span style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0f172a' }}>{product.unit || 'PCS'}</span>
              </div>
            </div>

            {/* If Tile: Box Packaging specs */}
            {isTile && (
              <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600, display: 'block' }}>Pieces Per Box:</span>
                  <strong style={{ color: '#166534', fontSize: '0.9rem' }}>{product.piecesPerBox || '-'} Pcs</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600, display: 'block' }}>Coverage Area:</span>
                  <strong style={{ color: '#166534', fontSize: '0.9rem' }}>{product.sqftPerBox || '-'} Sq.Ft</strong>
                </div>
                <div>
                  <span style={{ fontSize: '0.725rem', color: '#166534', fontWeight: 600, display: 'block' }}>Box Weight:</span>
                  <strong style={{ color: '#166534', fontSize: '0.9rem' }}>{product.weightPerBox || '-'} Kg</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Card 2: Pricing, Margins & GST Tax Structure */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#ecfdf5', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <DollarSign size={20} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Pricing, Rates & Tax Breakdown
            </h2>
            <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0 }}>
              Commercial catalogue pricing, wholesale rates, and standard ceramic GST
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Catalog MRP</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {formatCurrency(product.mrp)}
            </div>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Standard List Price</span>
          </div>

          <div style={{ backgroundColor: '#f0fdf4', padding: '1.15rem', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Selling Price (Wholesale)</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#15803d', marginTop: '0.2rem' }}>
              {formatCurrency(product.salePrice)}
            </div>
            <span style={{ fontSize: '0.725rem', color: '#166534' }}>Effective Quotation Rate</span>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Purchase / Cost Rate</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#334155', marginTop: '0.2rem' }}>
              {formatCurrency(product.purchaseRate || product.costRate)}
            </div>
            <span style={{ fontSize: '0.725rem', color: '#94a3b8' }}>Inventory Cost Valuation</span>
          </div>

          <div style={{ backgroundColor: '#eff6ff', padding: '1.15rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase' }}>GST Tax Rate</span>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.2rem' }}>
              {product.gstPercent || 18}% GST
            </div>
            <span style={{ fontSize: '0.725rem', color: '#2563eb' }}>
              ({(product.gstPercent || 18) / 2}% CGST + {(product.gstPercent || 18) / 2}% SGST)
            </span>
          </div>
        </div>
      </div>

      {/* Card 3: Inventory, Stock & Availability */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Inventory & Stock Availability
              </h2>
              <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0 }}>
                Warehouse ledger levels, reserved quotation stock, and reorder levels
              </p>
            </div>
          </div>

          <Link 
            to="/stock" 
            className="btn btn-secondary btn-sm"
            style={{ borderRadius: '7px', fontSize: '0.775rem', fontWeight: 700 }}
          >
            Manage Stock Ledger →
          </Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Opening Stock</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>
              {product.openingStock || 0} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{product.unit}</span>
            </div>
          </div>

          <div style={{ backgroundColor: isLowStock ? '#fef2f2' : '#f8fafc', padding: '1rem 1.15rem', borderRadius: '12px', border: isLowStock ? '1px solid #fca5a5' : '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isLowStock ? '#991b1b' : '#64748b', textTransform: 'uppercase' }}>Current / Actual Stock</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: isLowStock ? '#dc2626' : '#0f172a', marginTop: '0.2rem' }}>
              {product.actualStock || product.currentStock || 0} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isLowStock ? '#dc2626' : '#64748b' }}>{product.unit}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Management Stock</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0284c7', marginTop: '0.2rem' }}>
              {product.managementStock || 0} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{product.unit}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#f8fafc', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Available Stock</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16a34a', marginTop: '0.2rem' }}>
              {product.availableStock || (product.actualStock || 0)} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>{product.unit}</span>
            </div>
          </div>

          <div style={{ backgroundColor: '#fffbeb', padding: '1rem 1.15rem', borderRadius: '12px', border: '1px solid #fde68a' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Reorder Alert Level</span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#d97706', marginTop: '0.2rem' }}>
              {product.reorderLevel || product.alertStockQty || 10} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b45309' }}>{product.unit}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card 4: Quotation Tracking & Sales History */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.75rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', backgroundColor: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                Quotation & Invoicing Tracking
              </h2>
              <p style={{ fontSize: '0.775rem', color: '#64748b', margin: 0 }}>
                Recent quotations that include this product line item
              </p>
            </div>
          </div>
          <span className="badge badge-secondary" style={{ borderRadius: '12px', padding: '0.25rem 0.65rem', fontWeight: 700 }}>
            {quotationHistory.length} Record(s)
          </span>
        </div>

        {quotationHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
            <FileText size={32} style={{ color: '#94a3b8', margin: '0 auto 0.5rem auto' }} />
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>No Active Quotation Records</div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>This product has not been added to any finalized or draft customer quotations yet.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Quotation No.</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Customer Name</th>
                  <th style={{ padding: '0.65rem 0.85rem' }}>Date</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Quantity</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Amount (₹)</th>
                  <th style={{ padding: '0.65rem 0.85rem', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {quotationHistory.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: '#2563eb', padding: '0.65rem 0.85rem' }}>{item.quotationNumber}</td>
                    <td style={{ fontWeight: 600, color: '#0f172a', padding: '0.65rem 0.85rem' }}>{item.customerName}</td>
                    <td style={{ color: '#64748b', padding: '0.65rem 0.85rem' }}>{formatDate(item.date)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600, padding: '0.65rem 0.85rem' }}>{item.quantity} {product.unit}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', padding: '0.65rem 0.85rem' }}>{formatCurrency(item.amount)}</td>
                    <td style={{ textAlign: 'center', padding: '0.65rem 0.85rem' }}><StatusBadge status={item.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Delete Product"
        message={`Are you sure you want to permanently delete "${product?.productName}"? This action cannot be undone.`}
        confirmLabel="Delete Product"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
        danger
      />

    </div>
  );
};

export default ProductDetails;
