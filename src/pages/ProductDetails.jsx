import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProductById, deleteProduct } from '../services/productService';
import { getQuotations } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import ConfirmModal from '../components/ConfirmModal';
import { ArrowLeft, Edit, Boxes, FileText, Trash2 } from 'lucide-react';

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

        // Filter quotations containing this product SKU
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
      await deleteProduct(product.id);
      navigate('/products');
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  if (loading) return <div style={{ padding: '2rem' }}>Loading product details...</div>;
  if (!product) return <div style={{ padding: '2rem', color: '#dc2626' }}>Product not found.</div>;

  return (
    <div style={{ maxWidth: '1000px' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <Link to="/products" className="btn btn-secondary btn-sm">
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
          <button type="button" onClick={handleDelete} className="btn btn-secondary btn-sm" style={{ color: '#dc2626', borderColor: '#fecaca' }}>
            <Trash2 size={16} />
            <span>Delete</span>
          </button>
          <Link to={`/products/edit/${product.id}`} className="btn btn-primary">
            <Edit size={16} />
            <span>Edit Product</span>
          </Link>
        </div>
      </div>

      {/* Basic Information Section */}
      <div className="card">
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {product.image && (
            <img 
              src={product.image} 
              alt={product.productName} 
              style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }} 
            />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span className="badge badge-info">{product.sku}</span>
              <StatusBadge status={product.status} />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem' }}>{product.productName}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginTop: '1rem', color: '#475569' }}>
              <div><strong>Company/Brand:</strong> {product.company}</div>
              <div><strong>Product Group:</strong> {product.productGroup}</div>
              <div><strong>HSN Code:</strong> {product.hsnCode || '-'}</div>
              <div><strong>Unit:</strong> {product.unit}</div>
              <div><strong>MRP:</strong> {formatCurrency(product.mrp)}</div>
              <div><strong>Purchase Rate:</strong> {formatCurrency(product.purchaseRate)}</div>
              <div><strong>Sale Price:</strong> <span style={{ color: '#2563eb', fontWeight: 700 }}>{formatCurrency(product.salePrice)}</span></div>
              <div><strong>GST Tax %:</strong> {product.gstPercent || 18}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stock Breakdown Section */}
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Boxes size={18} style={{ color: '#0284c7' }} />
          <span>Stock Summary & Availability</span>
        </h3>
        <div className="stats-grid" style={{ marginBottom: 0 }}>
          <div className="stat-card" style={{ background: '#f8fafc' }}>
            <div className="stat-label">Opening Stock</div>
            <div className="stat-value">{product.openingStock || 0} {product.unit}</div>
          </div>
          <div className="stat-card" style={{ background: '#f8fafc' }}>
            <div className="stat-label">Current / Actual Stock</div>
            <div className="stat-value" style={{ color: product.actualStock <= product.reorderLevel ? '#dc2626' : '#0f172a' }}>
              {product.actualStock || 0} {product.unit}
            </div>
          </div>
          <div className="stat-card" style={{ background: '#f8fafc' }}>
            <div className="stat-label">Management Stock</div>
            <div className="stat-value" style={{ color: '#0284c7' }}>{product.managementStock || 0} {product.unit}</div>
          </div>
          <div className="stat-card" style={{ background: '#f8fafc' }}>
            <div className="stat-label">Available Stock</div>
            <div className="stat-value" style={{ color: '#16a34a' }}>{product.availableStock || 0} {product.unit}</div>
          </div>
          <div className="stat-card" style={{ background: '#f8fafc' }}>
            <div className="stat-label">Reorder Level</div>
            <div className="stat-value">{product.reorderLevel || 0} {product.unit}</div>
          </div>
        </div>
      </div>

      {/* Quotation Tracking Section */}
      <div className="table-container">
        <div className="table-header-bar">
          <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={18} style={{ color: '#2563eb' }} />
            <span>Product Quotation Tracking</span>
          </h3>
          <span className="badge badge-secondary">{quotationHistory.length} Quotation(s)</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Quotation No.</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Quantity Quoted</th>
              <th>Amount (₹)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotationHistory.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No active quotations track this product.</td>
              </tr>
            ) : (
              quotationHistory.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{item.quotationNumber}</td>
                  <td>{item.customerName}</td>
                  <td>{formatDate(item.date)}</td>
                  <td>{item.quantity} {product.unit}</td>
                  <td>{formatCurrency(item.amount)}</td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={showConfirm}
        title="Delete Product"
        message={`Are you sure you want to permanently delete "${product?.productName}"? This cannot be undone.`}
        confirmLabel="Delete Product"
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
        danger
      />

    </div>
  );
};

export default ProductDetails;
