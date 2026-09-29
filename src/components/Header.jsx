import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasMenuPermission, isSuperAdminRole, normalizeRole, formatRoleName } from '../utils/permissions';
import { getLowStockReport } from '../services/stockService';
import { 
  Home, Users, Boxes, Package, FolderTree, Building2, 
  BarChart3, Settings, LogOut, Menu, X, ChevronRight, AlertTriangle
} from 'lucide-react';

export const Header = () => {
  const { currentUser, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);

  const rawRole = currentUser?.role;
  const role = normalizeRole(rawRole);
  const displayRole = formatRoleName(rawRole || role) || (currentUser?.name ? 'Staff' : 'User');
  const userInitials = currentUser?.name?.trim() ? currentUser.name.trim().charAt(0).toUpperCase() : 'M';
  const userPermissions = currentUser?.permissions;
  const isSuper = isSuperAdminRole(role || rawRole);

  // Fetch low stock products count for the real-time alert badge
  useEffect(() => {
    let isMounted = true;
    const fetchLowStock = async () => {
      try {
        const res = await getLowStockReport();
        const items = Array.isArray(res) ? res : (res?.data || []);
        if (isMounted) {
          setLowStockCount(items.length);
        }
      } catch (err) {
        // Fallback gracefully
      }
    };
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 45000); // refresh periodically
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    { id: 'dashboard', path: '/', label: 'Home', icon: Home },
    { id: 'customers', path: '/customers', label: 'Customer Hub', icon: Users },
    { id: 'products', path: '/products', label: 'Products', icon: Package },
    { 
      id: 'stock', 
      path: '/stock', 
      label: 'Stock Management', 
      icon: Boxes, 
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : null,
      badgeColor: '#ef4444'
    },
    { id: 'companies', path: '/companies', label: 'Company', icon: Building2 },
    { id: 'product-groups', path: '/product-types', label: 'Product Types', icon: FolderTree },
    { id: 'reports', path: '/reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', path: '/settings', label: 'Settings', icon: Settings }
  ];

  let visibleItems = isSuper 
    ? navItems 
    : navItems.filter(item => hasMenuPermission(role, item.id, userPermissions));

  if (!visibleItems || visibleItems.length === 0) {
    visibleItems = navItems;
  }

  return (
    <header className="top-navbar">
      {/* Tier 1: Brand Logo & User Controls */}
      <div className="top-navbar-main">
        {/* Left: Brand Identity (Clean logo without duplicate text) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/" className="top-navbar-brand">
            <img 
              src="/Maitri-Ceramic-logo.png" 
              alt="Maitri Ceramic" 
              style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
            />
          </Link>
          <span className="top-navbar-brand-badge">ERP Hub</span>
        </div>

        {/* Right: User Profile & Mobile Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="user-profile">
            <div className="user-avatar" style={{ boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)' }}>
              {userInitials}
            </div>
            <div className="user-info-text">
              <span className="user-name-text">{currentUser?.name || 'User'}</span>
              <span className="user-role-text" style={{ fontWeight: 600, color: '#2563eb' }}>
                {displayRole}
              </span>
            </div>
            <button 
              type="button"
              className="btn btn-secondary btn-sm logout-btn" 
              onClick={logout}
              title="Sign Out"
            >
              <LogOut size={15} />
              <span className="logout-text">Logout</span>
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button 
            type="button" 
            className="menu-toggle-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Tier 2: Desktop Horizontal Strip (Hidden on mobile via CSS) */}
      <nav className="top-navbar-nav-strip">
        {visibleItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => `top-nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={16} />
              <span>{item.label}</span>
              {item.badge && (
                <span style={{
                  marginLeft: '0.35rem',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  padding: '0.1rem 0.45rem',
                  borderRadius: '12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  lineHeight: 1.2
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#dc2626', display: 'inline-block' }}></span>
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Mobile Vertical Drawer Menu (1 single column, 1 item per row) */}
      {mobileMenuOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-nav-drawer" onClick={e => e.stopPropagation()}>
            <div className="mobile-nav-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <img src="/Maitri-Ceramic-logo.png" alt="Maitri Ceramic" style={{ height: '28px', width: 'auto' }} />
                <span className="top-navbar-brand-badge">Navigation</span>
              </div>
              <button 
                type="button" 
                className="mobile-nav-close-btn"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mobile-nav-list">
              {visibleItems.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="mobile-nav-icon-wrap">
                        <Icon size={18} />
                      </div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{item.label}</span>
                      {item.badge && (
                        <span style={{
                          marginLeft: '0.25rem',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          backgroundColor: '#fee2e2',
                          color: '#dc2626',
                          border: '1px solid #fca5a5',
                          padding: '0.1rem 0.45rem',
                          borderRadius: '12px'
                        }}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <ChevronRight size={15} style={{ opacity: 0.4 }} />
                  </NavLink>
                );
              })}
            </div>

            <div className="mobile-nav-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="user-avatar" style={{ width: '36px', height: '36px', fontSize: '0.95rem' }}>
                  {userInitials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem' }}>{currentUser?.name || 'User'}</div>
                  <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>{displayRole}</div>
                </div>
              </div>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={logout}
                style={{ width: '100%', justifyContent: 'center', borderRadius: '8px', padding: '0.55rem', fontSize: '0.85rem' }}
              >
                <LogOut size={15} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
