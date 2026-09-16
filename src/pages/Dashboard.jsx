import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getProducts } from '../services/productService';
import { getQuotations, getFollowUps } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/formatters';
import StatusBadge from '../components/StatusBadge';
import { Users, Package, FileText, PhoneCall, CheckCircle2, Boxes, AlertTriangle, IndianRupee } from 'lucide-react';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProducts: 0,
    pendingQuotations: 0,
    followUpsDue: 0,
    confirmedQuotations: 0,
    actualStockTotal: 0,
    managementStockTotal: 0,
    lowStockCount: 0,
    outstandingAmountTotal: 0
  });

  const [pendingFollowUps, setPendingFollowUps] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [custRes, prdRes, qtRes, flwRes] = await Promise.all([
          getCustomers(),
          getProducts(),
          getQuotations(),
          getFollowUps()
        ]);

        const customers = Array.isArray(custRes?.data) ? custRes.data : (Array.isArray(custRes) ? custRes : []);
        const products = Array.isArray(prdRes?.data) ? prdRes.data : (Array.isArray(prdRes) ? prdRes : []);
        const quotations = Array.isArray(qtRes?.data) ? qtRes.data : (Array.isArray(qtRes) ? qtRes : []);
        const followUps = Array.isArray(flwRes?.data) ? flwRes.data : (Array.isArray(flwRes) ? flwRes : (Array.isArray(flwRes?.followUps) ? flwRes.followUps : []));

        const totalCustomers = customers.length;
        const totalProducts = products.length;
        const pendingQuotations = quotations.filter(q => q.status === 'Follow-up Pending' || q.status === 'Sent' || q.status === 'Draft').length;
        const confirmedQuotations = quotations.filter(q => q.status === 'Confirmed').length;
        
        const outstandingAmountTotal = customers.reduce((sum, c) => sum + (c.totalOutstanding || 0), 0);

        let actualStockTotal = 0;
        let managementStockTotal = 0;
        const lowStock = [];

        products.forEach(p => {
          actualStockTotal += (p.actualStock || 0);
          managementStockTotal += (p.managementStock || 0);
          if ((p.actualStock || 0) <= (p.reorderLevel || 0)) {
            lowStock.push(p);
          }
        });

        const pendingFlws = followUps.filter(f => f.status === 'Follow-up Pending' || f.status === 'Pending');

        setStats({
          totalCustomers,
          totalProducts,
          pendingQuotations,
          followUpsDue: pendingFlws.length,
          confirmedQuotations,
          actualStockTotal,
          managementStockTotal,
          lowStockCount: lowStock.length,
          outstandingAmountTotal
        });

        setPendingFollowUps(pendingFlws);
        setLowStockItems(lowStock);
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Business Overview...</div>;

  return (
    <div>
      {/* 9 Simple Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Total Customers</span>
            <Users size={18} style={{ color: '#2563eb' }} />
          </div>
          <div className="stat-value">{stats.totalCustomers}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Total Products</span>
            <Package size={18} style={{ color: '#0284c7' }} />
          </div>
          <div className="stat-value">{stats.totalProducts}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Pending Quotations</span>
            <FileText size={18} style={{ color: '#d97706' }} />
          </div>
          <div className="stat-value">{stats.pendingQuotations}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Follow-Ups Due</span>
            <PhoneCall size={18} style={{ color: '#dc2626' }} />
          </div>
          <div className="stat-value">{stats.followUpsDue}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Confirmed Quotations</span>
            <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
          </div>
          <div className="stat-value">{stats.confirmedQuotations}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Actual Stock Total</span>
            <Boxes size={18} style={{ color: '#475569' }} />
          </div>
          <div className="stat-value">{stats.actualStockTotal}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Management Stock</span>
            <Boxes size={18} style={{ color: '#0284c7' }} />
          </div>
          <div className="stat-value">{stats.managementStockTotal}</div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Low Stock Items</span>
            <AlertTriangle size={18} style={{ color: '#dc2626' }} />
          </div>
          <div className="stat-value" style={{ color: stats.lowStockCount > 0 ? '#dc2626' : 'inherit' }}>
            {stats.lowStockCount}
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Outstanding Amount</span>
            <IndianRupee size={18} style={{ color: '#dc2626' }} />
          </div>
          <div className="stat-value" style={{ color: '#dc2626' }}>
            {formatCurrency(stats.outstandingAmountTotal)}
          </div>
        </div>
      </div>

      {/* 2 Simple Tables */}
      <div className="dashboard-tables-grid">
        
        {/* Pending Follow-Ups Table */}
        <div className="table-container">
          <div className="table-header-bar">
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Pending Follow-Ups</h3>
            <Link to="/follow-ups" className="btn btn-secondary btn-sm">View All</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Quotation No.</th>
                <th>Follow-Up Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pendingFollowUps.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>No pending follow-ups due.</td>
                </tr>
              ) : (
                pendingFollowUps.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.customerName}</td>
                    <td>{f.quotationNumber}</td>
                    <td>{formatDate(f.nextFollowUpDate)}</td>
                    <td><StatusBadge status={f.status} /></td>
                    <td>
                      <Link to="/follow-ups" className="btn btn-secondary btn-sm">Follow Up</Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Low Stock Table */}
        <div className="table-container">
          <div className="table-header-bar">
            <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Low Stock Alert</h3>
            <Link to="/stock" className="btn btn-secondary btn-sm">View Stock</Link>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Actual Stock</th>
                <th>Available</th>
                <th>Reorder Level</th>
                <th style={{ textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b' }}>All items have sufficient stock level.</td>
                </tr>
              ) : (
                lowStockItems.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.productName}</td>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{p.actualStock}</td>
                    <td>{p.availableStock}</td>
                    <td>{p.reorderLevel}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ 
                        backgroundColor: '#fef2f2', 
                        color: '#dc2626', 
                        padding: '0.2rem 0.65rem', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        display: 'inline-block' 
                      }}>
                        Low Stock
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
