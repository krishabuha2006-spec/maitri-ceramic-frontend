import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getCustomers } from '../services/customerService';
import { getProducts } from '../services/productService';
import { getQuotations, getFollowUps } from '../services/quotationService';
import { getChallans } from '../services/challanService';
import { formatCurrency } from '../utils/formatters';
import { 
  Users, 
  Package, 
  FileText, 
  PhoneCall,
  CheckCircle2,
  Boxes, 
  AlertTriangle, 
  IndianRupee, 
  ArrowRight,
  Truck,
  ChevronDown,
  Layers,
  ShieldCheck
} from 'lucide-react';

// Pure SVG Circular Donut Chart Component
const DonutChart = ({ segments = [], size = 120, strokeWidth = 14, centerLabel, centerSub }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

  let accumulatedPercent = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={strokeWidth}
        />
        {total > 0 && segments.map((seg, i) => {
          const val = Number(seg.value) || 0;
          if (val <= 0) return null;
          const pct = val / total;
          const strokeDasharray = `${pct * circumference} ${circumference}`;
          const strokeDashoffset = -accumulatedPercent * circumference;
          accumulatedPercent += pct;

          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease' }}
            />
          );
        })}
      </svg>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        pointerEvents: 'none',
        padding: '0 4px'
      }}>
        <span style={{ fontSize: size < 90 ? '1rem' : (size < 105 ? '1.25rem' : '1.4rem'), fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
          {centerLabel}
        </span>
        {centerSub && (
          <span style={{
            fontSize: size < 90 ? '0.5rem' : (centerSub.length > 8 ? '0.54rem' : '0.62rem'),
            fontWeight: 700,
            color: '#64748b',
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
            marginTop: '2px',
            lineHeight: 1,
            whiteSpace: 'nowrap'
          }}>
            {centerSub}
          </span>
        )}
      </div>
    </div>
  );
};


// SVG / CSS Grouped Bar Chart for Delivery Challans Dispatch Status (100% Dynamic)
const DispatchGroupedBarChart = ({ data = [], height = 115 }) => {
  const [hoveredDay, setHoveredDay] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
        No dispatch data recorded
      </div>
    );
  }

  const maxRaw = Math.max(
    ...data.map(d => Math.max(Number(d.dispatched || 0), Number(d.pending || 0), Number(d.cancelled || 0))),
    0
  );
  const maxVal = maxRaw > 0 ? (maxRaw <= 4 ? 4 : maxRaw + 2) : 4;
  const yTicks = [0, Math.round(maxVal / 2), maxVal];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height, width: '100%', position: 'relative' }}>
      {/* Chart Plot Area */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', borderBottom: '1px solid #e2e8f0', paddingBottom: '2px' }}>
        {/* Y Axis Guide */}
        <div style={{
          width: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          paddingRight: '4px',
          fontSize: '0.625rem',
          fontWeight: 600,
          color: '#94a3b8',
          userSelect: 'none'
        }}>
          <span>{yTicks[2]}</span>
          <span>{yTicks[1]}</span>
          <span>0</span>
        </div>

        {/* Bars Container */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '3px', position: 'relative' }}>
          {/* Subtle Grid Lines */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', backgroundColor: '#f1f5f9' }} />
          <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', backgroundColor: '#f1f5f9' }} />

          {data.map((day, idx) => {
            const hDisp = (day.dispatched || 0) > 0 ? Math.max(8, ((day.dispatched || 0) / maxVal) * 100) : 0;
            const hPend = (day.pending || 0) > 0 ? Math.max(8, ((day.pending || 0) / maxVal) * 100) : 0;
            const hCanc = (day.cancelled || 0) > 0 ? Math.max(8, ((day.cancelled || 0) / maxVal) * 100) : 0;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredDay(idx)}
                onMouseLeave={() => setHoveredDay(null)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: '2px',
                  height: '100%',
                  cursor: 'pointer',
                  position: 'relative'
                }}
              >
                {/* Dispatched Bar */}
                <div
                  style={{
                    width: '5px',
                    height: `${hDisp}%`,
                    backgroundColor: (day.dispatched || 0) > 0 ? '#16a34a' : 'transparent',
                    borderRadius: '2px 2px 0 0',
                    transition: 'all 0.3s ease'
                  }}
                />
                {/* Pending Bar */}
                <div
                  style={{
                    width: '5px',
                    height: `${hPend}%`,
                    backgroundColor: (day.pending || 0) > 0 ? '#f59e0b' : 'transparent',
                    borderRadius: '2px 2px 0 0',
                    transition: 'all 0.3s ease'
                  }}
                />
                {/* Cancelled Bar */}
                <div
                  style={{
                    width: '5px',
                    height: `${hCanc}%`,
                    backgroundColor: (day.cancelled || 0) > 0 ? '#dc2626' : 'transparent',
                    borderRadius: '2px 2px 0 0',
                    transition: 'all 0.3s ease'
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* X Axis Labels */}
      <div style={{ display: 'flex', paddingLeft: '20px', justifyContent: 'space-between', paddingTop: '4px' }}>
        {data.map((day, idx) => (
          <div key={idx} style={{ flex: 1, textAlign: 'center', fontSize: '0.625rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>
            {day.label}
          </div>
        ))}
      </div>

      {/* Hover tooltip */}
      {hoveredDay !== null && data[hoveredDay] && (
        <div style={{
          position: 'absolute',
          top: '-32px',
          left: `calc(20px + ${(hoveredDay / Math.max(data.length - 1, 1)) * 75}%)`,
          backgroundColor: '#0f172a',
          color: '#ffffff',
          padding: '3px 8px',
          borderRadius: '5px',
          fontSize: '0.675rem',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <strong>{data[hoveredDay].label}:</strong> Dispatched: {data[hoveredDay].dispatched} | Pending: {data[hoveredDay].pending} | Cancelled: {data[hoveredDay].cancelled}
        </div>
      )}
    </div>
  );
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalProducts: 0,
    pendingQuotations: 0,
    followUpsDue: 0,
    confirmedQuotations: 0,
    totalChallans: 0,
    finalizedChallans: 0,
    actualStockTotal: 0,
    lowStockCount: 0,
    outstandingAmountTotal: 0
  });

  const [stockAnalytics, setStockAnalytics] = useState({
    healthyCount: 0,
    lowCount: 0,
    outOfStockCount: 0,
    totalCount: 0,
    healthyPct: 0,
    lowPct: 0,
    outOfStockPct: 0,
    inStockPct: 0
  });

  const [pipelineAnalytics, setPipelineAnalytics] = useState({
    confirmed: 0,
    pending: 0,
    followUpsDue: 0,
    totalQuotations: 0,
    conversionRate: 0,
    stages: {
      draft: { count: 0, pct: 0 },
      sent: { count: 0, pct: 0 },
      viewed: { count: 0, pct: 0 },
      negotiation: { count: 0, pct: 0 },
      confirmed: { count: 0, pct: 0 }
    }
  });

  const [challanAnalytics, setChallanAnalytics] = useState({
    total: 0,
    finalized: 0,
    draft: 0,
    cancelled: 0,
    finalizedPct: 0,
    draftPct: 0,
    cancelledPct: 0
  });

  // Timeline Trends (100% Dynamic)
  const [quotationTrendData, setQuotationTrendData] = useState([]);
  const [dispatchStatusData, setDispatchStatusData] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [custRes, prdRes, qtRes, flwRes, chRes] = await Promise.all([
          getCustomers(),
          getProducts(),
          getQuotations(),
          getFollowUps(),
          getChallans({ limit: 1000 })
        ]);

        const customers = Array.isArray(custRes?.data) ? custRes.data : (Array.isArray(custRes) ? custRes : []);
        const products = Array.isArray(prdRes?.data) ? prdRes.data : (Array.isArray(prdRes) ? prdRes : []);
        const quotations = Array.isArray(qtRes?.data) ? qtRes.data : (Array.isArray(qtRes) ? qtRes : []);
        const followUps = Array.isArray(flwRes?.data) ? flwRes.data : (Array.isArray(flwRes) ? flwRes : (Array.isArray(flwRes?.followUps) ? flwRes.followUps : []));
        const challans = Array.isArray(chRes?.data) ? chRes.data : (Array.isArray(chRes) ? chRes : []);

        const totalCustomers = customers.length;
        const totalProducts = products.length;
        const pendingQuotations = quotations.filter(q => {
          const st = (q.status || '').toLowerCase();
          return st === 'follow-up pending' || st === 'sent' || st === 'draft' || st === 'negotiation' || st === 'customer interested';
        }).length;
        const confirmedQuotations = quotations.filter(q => (q.status || '').toLowerCase() === 'confirmed').length;
        
        const outstandingAmountTotal = customers.reduce((sum, c) => sum + Number(c.totalOutstanding || 0), 0);

        let actualStockTotal = 0;
        let managementStockTotal = 0;
        let outOfStockCount = 0;
        let lowCount = 0;
        let healthyCount = 0;

        products.forEach(p => {
          const actual = Number(p.actualStock || 0);
          const mgmt = Number(p.managementStock || 0);
          const reorder = Number(p.reorderLevel || 0);

          actualStockTotal += actual;
          managementStockTotal += mgmt;

          if (actual <= 0) {
            outOfStockCount++;
          } else if (actual <= reorder) {
            lowCount++;
          } else {
            healthyCount++;
          }
        });

        const pendingFlws = followUps.filter(f => {
          const st = (f.status || '').toLowerCase();
          return st === 'follow-up pending' || st === 'pending';
        });

        // 1. Pipeline analytics (100% Dynamic)
        const totalQts = quotations.length;
        const convRate = totalQts > 0 ? Math.round((confirmedQuotations / totalQts) * 100) : 0;

        const draftCount = quotations.filter(q => (q.status || '').toLowerCase() === 'draft').length;
        const sentCount = quotations.filter(q => (q.status || '').toLowerCase() === 'sent').length;
        const viewedCount = quotations.filter(q => {
          const s = (q.status || '').toLowerCase();
          return s.includes('viewed') || s.includes('interested');
        }).length;
        const negCount = quotations.filter(q => (q.status || '').toLowerCase().includes('negotiat')).length;
        const confCount = confirmedQuotations;

        const stageStats = {
          draft: { count: draftCount, pct: totalQts > 0 ? Math.round((draftCount / totalQts) * 100) : 0 },
          sent: { count: sentCount, pct: totalQts > 0 ? Math.round((sentCount / totalQts) * 100) : 0 },
          viewed: { count: viewedCount, pct: totalQts > 0 ? Math.round((viewedCount / totalQts) * 100) : 0 },
          negotiation: { count: negCount, pct: totalQts > 0 ? Math.round((negCount / totalQts) * 100) : 0 },
          confirmed: { count: confCount, pct: totalQts > 0 ? Math.round((confCount / totalQts) * 100) : 0 }
        };

        // 2. Delivery Challans stats (100% Dynamic)
        const totalChallans = challans.length;
        const finalizedChallans = challans.filter(c => (c.status || '').toUpperCase() === 'FINALIZED' || c.isFinalized).length;
        const draftChallans = challans.filter(c => (c.status || '').toUpperCase() === 'DRAFT' && !c.isFinalized).length;
        const cancelledChallans = challans.filter(c => (c.status || '').toUpperCase() === 'CANCELLED').length;
        const challanFinalizedPct = totalChallans > 0 ? Math.round((finalizedChallans / totalChallans) * 100) : 0;
        const challanDraftPct = totalChallans > 0 ? Math.round((draftChallans / totalChallans) * 100) : 0;
        const challanCancelledPct = totalChallans > 0 ? Math.round((cancelledChallans / totalChallans) * 100) : 0;

        // Generate past 7 days timeline dates dynamically
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dayNum = d.getDate();
          const monthName = d.toLocaleString('default', { month: 'short' });
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(dayNum).padStart(2, '0');
          last7Days.push({
            dateStr: `${yyyy}-${mm}-${dd}`,
            label: `${dayNum} ${monthName}`
          });
        }

        const isDateInDay = (recordDate, targetDateStr) => {
          if (!recordDate) return false;
          return String(recordDate).startsWith(targetDateStr);
        };

        // 3. 7-Day Quotation Trend
        const quotTrend = last7Days.map(day => {
          const count = quotations.filter(q => isDateInDay(q.date || q.quotationDate || q.createdAt, day.dateStr)).length;
          return {
            label: day.label,
            value: count
          };
        });
        setQuotationTrendData(quotTrend);

        // 4. 7-Day Dispatch Status Trend
        const dispatchTrend = last7Days.map(day => {
          const dayChallans = challans.filter(c => isDateInDay(c.date || c.challanDate || c.createdAt, day.dateStr));
          const disp = dayChallans.filter(c => (c.status || '').toUpperCase() === 'FINALIZED' || c.isFinalized).length;
          const pend = dayChallans.filter(c => (c.status || '').toUpperCase() === 'DRAFT' && !c.isFinalized).length;
          const canc = dayChallans.filter(c => (c.status || '').toUpperCase() === 'CANCELLED').length;

          return {
            label: day.label,
            dispatched: disp,
            pending: pend,
            cancelled: canc
          };
        });
        setDispatchStatusData(dispatchTrend);

        // 5. Stock Analytics
        const inStockCount = healthyCount + lowCount;
        const healthyPct = totalProducts > 0 ? Math.round((healthyCount / totalProducts) * 100) : 0;
        const lowPct = totalProducts > 0 ? Math.round((lowCount / totalProducts) * 100) : 0;
        const outOfStockPct = totalProducts > 0 ? Math.round((outOfStockCount / totalProducts) * 100) : 0;
        const inStockPct = totalProducts > 0 ? Math.round((inStockCount / totalProducts) * 100) : 0;

        setStats({
          totalCustomers,
          totalProducts,
          pendingQuotations,
          followUpsDue: pendingFlws.length,
          confirmedQuotations,
          totalChallans,
          finalizedChallans,
          actualStockTotal,
          managementStockTotal,
          lowStockCount: outOfStockCount + lowCount,
          outstandingAmountTotal
        });

        setStockAnalytics({
          healthyCount,
          lowCount,
          outOfStockCount,
          totalCount: totalProducts,
          healthyPct,
          lowPct,
          outOfStockPct,
          inStockPct
        });

        setPipelineAnalytics({
          confirmed: confirmedQuotations,
          pending: pendingQuotations,
          followUpsDue: pendingFlws.length,
          totalQuotations: totalQts,
          conversionRate: convRate,
          stages: stageStats
        });

        setChallanAnalytics({
          total: totalChallans,
          finalized: finalizedChallans,
          draft: draftChallans,
          cancelled: cancelledChallans,
          finalizedPct: challanFinalizedPct,
          draftPct: challanDraftPct,
          cancelledPct: challanCancelledPct
        });

      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '55vh',
        gap: '1.25rem'
      }}>
        <div className="spinner-circle" />
        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#475569', letterSpacing: '0.01em' }}>
          Loading Business Overview...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: 'var(--font-family)', paddingBottom: '2.5rem' }}>
      
      {/* 10 Metric Summary Cards (5 on Top, 5 on Bottom on Desktop) */}
      <div className="dashboard-kpi-grid">
        
        {/* 1. Total Customers */}
        <div className="kpi-card" onClick={() => navigate('/customers')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Total Customers</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff' }}>
              <Users size={15} style={{ color: '#2563eb' }} />
            </div>
          </div>
          <div className="kpi-value">{stats.totalCustomers}</div>
        </div>

        {/* 2. Total Products */}
        <div className="kpi-card" onClick={() => navigate('/products')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Total Products</span>
            <div className="kpi-icon-wrap" style={{ background: '#f0f9ff' }}>
              <Package size={15} style={{ color: '#0284c7' }} />
            </div>
          </div>
          <div className="kpi-value">{stats.totalProducts}</div>
        </div>

        {/* 3. Pending Quotations */}
        <div className="kpi-card" onClick={() => navigate('/quotations')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Pending Quotations</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7' }}>
              <FileText size={15} style={{ color: '#d97706' }} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#d97706' }}>{stats.pendingQuotations}</div>
        </div>

        {/* 4. Follow-Ups Due */}
        <div className="kpi-card" onClick={() => navigate('/follow-ups')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Follow-Ups Due</span>
            <div className="kpi-icon-wrap" style={{ background: stats.followUpsDue > 0 ? '#fee2e2' : '#f1f5f9' }}>
              <PhoneCall size={15} style={{ color: stats.followUpsDue > 0 ? '#dc2626' : '#64748b' }} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: stats.followUpsDue > 0 ? '#dc2626' : '#0f172a' }}>{stats.followUpsDue}</div>
        </div>

        {/* 5. Confirmed Quotations */}
        <div className="kpi-card" onClick={() => navigate('/quotations')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Confirmed Quotations</span>
            <div className="kpi-icon-wrap" style={{ background: '#f0fdf4' }}>
              <CheckCircle2 size={15} style={{ color: '#16a34a' }} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>{stats.confirmedQuotations}</div>
        </div>

        {/* 6. Actual Stock Total */}
        <div className="kpi-card" onClick={() => navigate('/stock')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Actual Stock Total</span>
            <div className="kpi-icon-wrap" style={{ background: '#f0fdf4' }}>
              <Boxes size={15} style={{ color: '#16a34a' }} />
            </div>
          </div>
          <div className="kpi-value">{stats.actualStockTotal.toLocaleString()}</div>
        </div>

        {/* 7. Management Stock */}
        <div className="kpi-card" onClick={() => navigate('/stock')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Management Stock</span>
            <div className="kpi-icon-wrap" style={{ background: '#f0f9ff' }}>
              <Boxes size={15} style={{ color: '#0284c7' }} />
            </div>
          </div>
          <div className="kpi-value">{stats.managementStockTotal.toLocaleString()}</div>
        </div>

        {/* 8. Low Stock Items */}
        <div className="kpi-card" onClick={() => navigate('/stock')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Low Stock Items</span>
            <div className="kpi-icon-wrap" style={{ background: stats.lowStockCount > 0 ? '#fef2f2' : '#f0fdf4' }}>
              <AlertTriangle size={15} style={{ color: stats.lowStockCount > 0 ? '#dc2626' : '#16a34a' }} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: stats.lowStockCount > 0 ? '#dc2626' : '#16a34a' }}>{stats.lowStockCount}</div>
        </div>

        {/* 9. Delivery Challans */}
        <div className="kpi-card" onClick={() => navigate('/challans')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Delivery Challans</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff' }}>
              <Truck size={15} style={{ color: '#2563eb' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'nowrap' }}>
            <span className="kpi-value">{stats.totalChallans}</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
              ({stats.finalizedChallans} Dispatched)
            </span>
          </div>
        </div>

        {/* 10. Outstanding Amount */}
        <div className="kpi-card" onClick={() => navigate('/customers')} role="button" tabIndex={0}>
          <div className="kpi-header">
            <span className="kpi-label">Outstanding Amount</span>
            <div className="kpi-icon-wrap" style={{ background: stats.outstandingAmountTotal > 0 ? '#fee2e2' : '#f0fdf4' }}>
              <IndianRupee size={15} style={{ color: stats.outstandingAmountTotal > 0 ? '#dc2626' : '#16a34a' }} />
            </div>
          </div>
          <div className="kpi-value" style={{ fontSize: '1.2rem', color: stats.outstandingAmountTotal > 0 ? '#dc2626' : '#0f172a' }}>
            {formatCurrency(stats.outstandingAmountTotal)}
          </div>
        </div>

      </div>

      {/* 3 Full-Feature Analytics Cards (100% Pure Dynamic Database Calculations) */}
      <div className="dashboard-analytics-grid">
        
        {/* ======================================================== */}
        {/* CARD 1: Quotations Pipeline */}
        {/* ======================================================== */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Quotations Pipeline
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Track your quotation status and conversion.
                </p>
              </div>
            </div>
            <Link 
              to="/quotations" 
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Top Section: Donut + Legend */}
          <div style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <DonutChart
              size={96}
              strokeWidth={12}
              centerLabel={`${pipelineAnalytics.conversionRate}%`}
              centerSub="WIN RATE"
              segments={[
                { value: pipelineAnalytics.confirmed, color: '#16a34a' },
                { value: pipelineAnalytics.pending, color: '#f59e0b' },
                { value: pipelineAnalytics.followUpsDue, color: '#dc2626' }
              ]}
            />
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }}></span>
                  Confirmed Deals
                </span>
                <strong style={{ color: '#0f172a', fontSize: '0.85rem', flexShrink: 0, marginLeft: '6px' }}>{pipelineAnalytics.confirmed}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }}></span>
                  Pending Quotations
                </span>
                <strong style={{ color: '#0f172a', fontSize: '0.85rem', flexShrink: 0, marginLeft: '6px' }}>{pipelineAnalytics.pending}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#dc2626', flexShrink: 0 }}></span>
                  Action Required
                </span>
                <strong style={{ color: '#dc2626', fontSize: '0.85rem', flexShrink: 0, marginLeft: '6px' }}>{pipelineAnalytics.followUpsDue}</strong>
              </div>
            </div>
          </div>

          {/* Bottom Full-Width Section: Pipeline Overview */}
          <div style={{ padding: '0 1.15rem 1.15rem 1.15rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem',
              flex: 1
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                Pipeline Overview
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {/* Draft */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '70px', whiteSpace: 'nowrap', flexShrink: 0 }}>Draft</span>
                  <div style={{ flex: 1, margin: '0 0.65rem', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pipelineAnalytics.stages.draft.pct}%`, height: '100%', backgroundColor: '#60a5fa', borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: '50px', justifyContent: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{pipelineAnalytics.stages.draft.count}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>({pipelineAnalytics.stages.draft.pct}%)</span>
                  </div>
                </div>

                {/* Sent */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '70px', whiteSpace: 'nowrap', flexShrink: 0 }}>Sent</span>
                  <div style={{ flex: 1, margin: '0 0.65rem', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pipelineAnalytics.stages.sent.pct}%`, height: '100%', backgroundColor: '#818cf8', borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: '50px', justifyContent: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{pipelineAnalytics.stages.sent.count}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>({pipelineAnalytics.stages.sent.pct}%)</span>
                  </div>
                </div>

                {/* Viewed / Interested */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '70px', whiteSpace: 'nowrap', flexShrink: 0 }}>Viewed</span>
                  <div style={{ flex: 1, margin: '0 0.65rem', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pipelineAnalytics.stages.viewed.pct}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: '50px', justifyContent: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{pipelineAnalytics.stages.viewed.count}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>({pipelineAnalytics.stages.viewed.pct}%)</span>
                  </div>
                </div>

                {/* Negotiation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '70px', whiteSpace: 'nowrap', flexShrink: 0 }}>Negotiate</span>
                  <div style={{ flex: 1, margin: '0 0.65rem', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pipelineAnalytics.stages.negotiation.pct}%`, height: '100%', backgroundColor: '#14b8a6', borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: '50px', justifyContent: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{pipelineAnalytics.stages.negotiation.count}</strong>
                    <span style={{ color: '#64748b', fontSize: '0.7rem' }}>({pipelineAnalytics.stages.negotiation.pct}%)</span>
                  </div>
                </div>

                {/* Confirmed */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '70px', whiteSpace: 'nowrap', flexShrink: 0 }}>Confirmed</span>
                  <div style={{ flex: 1, margin: '0 0.65rem', height: '8px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${pipelineAnalytics.stages.confirmed.pct}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '999px' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', minWidth: '50px', justifyContent: 'flex-end', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{pipelineAnalytics.stages.confirmed.count}</strong>
                    <span style={{ color: '#16a34a', fontSize: '0.7rem', fontWeight: 700 }}>({pipelineAnalytics.stages.confirmed.pct}%)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 2: Delivery Challans (100% Dynamic) */}
        {/* ======================================================== */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Truck size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Delivery Challans
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Track dispatch status and fulfillment.
                </p>
              </div>
            </div>
            <Link 
              to="/challans" 
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            >
              <span>View All</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Top Section: Donut + Legend */}
          <div style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <DonutChart
              size={96}
              strokeWidth={12}
              centerLabel={String(challanAnalytics.total)}
              centerSub="TOTAL"
              segments={[
                { value: challanAnalytics.finalized, color: '#16a34a' },
                { value: challanAnalytics.draft, color: '#f59e0b' },
                { value: challanAnalytics.cancelled, color: '#dc2626' }
              ]}
            />
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }}></span>
                  Dispatched
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{challanAnalytics.finalized}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({challanAnalytics.finalizedPct}%)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }}></span>
                  Draft / Pending
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{challanAnalytics.draft}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({challanAnalytics.draftPct}%)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#dc2626', flexShrink: 0 }}></span>
                  Cancelled
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px' }}>
                  <strong style={{ color: '#dc2626', fontSize: '0.85rem' }}>{challanAnalytics.cancelled}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({challanAnalytics.cancelledPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section: Dispatch Status Multi-Bar Timeline Chart */}
          <div style={{
            padding: '0 1.15rem 1.15rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            flex: 1
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.75rem 0.85rem',
              display: 'flex',
              flexDirection: 'column',
              flex: 1
            }}>
              {/* Header with Title on left, Dropdown on right */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                  Dispatch Status
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '0.65rem', color: '#475569', fontWeight: 700, backgroundColor: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <span>Last 7 Days</span>
                  <ChevronDown size={10} style={{ flexShrink: 0 }} />
                </div>
              </div>

              {/* Sub-header Legend Dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', fontSize: '0.65rem', fontWeight: 600, color: '#64748b', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
                  Dispatched
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                  Pending
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#dc2626' }}></span>
                  Cancelled
                </span>
              </div>

              {/* Grouped Bar Chart */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', paddingTop: '0.25rem' }}>
                <DispatchGroupedBarChart data={dispatchStatusData} height={110} />
              </div>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* CARD 3: Inventory Health (Clean Full-Width UI) */}
        {/* ======================================================== */}
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Card Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.1rem 1.25rem',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ffe4e6', color: '#e11d48', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Boxes size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                  Inventory Health
                </h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Monitor stock levels and critical items.
                </p>
              </div>
            </div>
            <Link 
              to="/stock" 
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}
            >
              <span>View Stock</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Top Section: Donut + Legend */}
          <div style={{ padding: '1rem 1.15rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <DonutChart
              size={96}
              strokeWidth={12}
              centerLabel={String(stockAnalytics.lowCount + stockAnalytics.outOfStockCount)}
              centerSub="ALERTS"
              segments={[
                { value: stockAnalytics.healthyCount, color: '#16a34a' },
                { value: stockAnalytics.lowCount, color: '#f59e0b' },
                { value: stockAnalytics.outOfStockCount, color: '#dc2626' }
              ]}
            />
            
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.45rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#16a34a', flexShrink: 0 }}></span>
                  Sufficient Stock
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px' }}>
                  <strong style={{ color: '#0f172a', fontSize: '0.85rem' }}>{stockAnalytics.healthyCount}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({stockAnalytics.healthyPct}%)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f59e0b', flexShrink: 0 }}></span>
                  Low Stock Warning
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px' }}>
                  <strong style={{ color: '#d97706', fontSize: '0.85rem' }}>{stockAnalytics.lowCount}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({stockAnalytics.lowPct}%)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#dc2626', flexShrink: 0 }}></span>
                  Critical / Out of Stock
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: '6px' }}>
                  <strong style={{ color: '#dc2626', fontSize: '0.85rem' }}>{stockAnalytics.outOfStockCount}</strong>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({stockAnalytics.outOfStockPct}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Full-Width Section: Stock Health & Warehouse Capacity Summary */}
          <div style={{
            padding: '0 1.15rem 1.15rem 1.15rem',
            display: 'flex',
            flexDirection: 'column',
            flex: 1
          }}>
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '0.85rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.85rem',
              flex: 1
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'nowrap' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                  <ShieldCheck size={15} style={{ color: '#16a34a', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#0f172a' }}>
                    Stock Availability
                  </span>
                </div>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: '#f0fdf4',
                  color: '#166534',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '6px',
                  border: '1px solid #bbf7d0',
                  whiteSpace: 'nowrap',
                  flexShrink: 0
                }}>
                  {stockAnalytics.inStockPct}% Available
                </span>
              </div>

              {/* Circle Donut on Top (Centered) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0.35rem 0' }}>
                <DonutChart
                  size={82}
                  strokeWidth={10}
                  centerLabel={`${stockAnalytics.inStockPct}%`}
                  centerSub="In Stock"
                  segments={[
                    { value: stockAnalytics.healthyCount, color: '#16a34a' },
                    { value: stockAnalytics.lowCount, color: '#f59e0b' },
                    { value: stockAnalytics.outOfStockCount, color: '#dc2626' }
                  ]}
                />
              </div>

              {/* Progress Breakdown Lines Stacked Across Full Width Below Donut */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
                {/* Sufficient */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, marginBottom: '3px', gap: '0.35rem' }}>
                    <span style={{ color: '#166534', whiteSpace: 'nowrap' }}>Sufficient Units</span>
                    <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{stockAnalytics.healthyCount} SKUs ({stockAnalytics.healthyPct}%)</span>
                  </div>
                  <div style={{ height: '7px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${stockAnalytics.healthyPct}%`, height: '100%', backgroundColor: '#16a34a', borderRadius: '999px' }} />
                  </div>
                </div>

                {/* Low Stock */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, marginBottom: '3px', gap: '0.35rem' }}>
                    <span style={{ color: '#92400e', whiteSpace: 'nowrap' }}>Low Stock Warning</span>
                    <span style={{ color: '#0f172a', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{stockAnalytics.lowCount} SKUs ({stockAnalytics.lowPct}%)</span>
                  </div>
                  <div style={{ height: '7px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${stockAnalytics.lowPct}%`, height: '100%', backgroundColor: '#f59e0b', borderRadius: '999px' }} />
                  </div>
                </div>

                {/* Critical */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', fontWeight: 600, marginBottom: '3px', gap: '0.35rem' }}>
                    <span style={{ color: '#991b1b', whiteSpace: 'nowrap' }}>Out of Stock</span>
                    <span style={{ color: '#dc2626', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>{stockAnalytics.outOfStockCount} SKUs ({stockAnalytics.outOfStockPct}%)</span>
                  </div>
                  <div style={{ height: '7px', backgroundColor: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${stockAnalytics.outOfStockPct}%`, height: '100%', backgroundColor: '#dc2626', borderRadius: '999px' }} />
                  </div>
                </div>
              </div>

              {/* Bottom Metadata Ribbon */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: '0.5rem',
                paddingTop: '0.55rem',
                borderTop: '1px solid #f1f5f9',
                fontSize: '0.72rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '0.4rem 0.65rem', borderRadius: '7px', border: '1px solid #e2e8f0', gap: '0.5rem', minWidth: 0 }}>
                  <span style={{ color: '#64748b', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Catalog SKUs</span>
                  <strong style={{ color: '#0f172a', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{stats.totalProducts} Items</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f8fafc', padding: '0.4rem 0.65rem', borderRadius: '7px', border: '1px solid #e2e8f0', gap: '0.5rem', minWidth: 0 }}>
                  <span style={{ color: '#64748b', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Total Stock</span>
                  <strong style={{ color: '#16a34a', fontWeight: 800, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{stats.actualStockTotal.toLocaleString()} Units</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
