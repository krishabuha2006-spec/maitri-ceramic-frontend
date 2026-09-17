import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, Package, FolderTree, Building2, UploadCloud, Users, FileText, PhoneCall, 
  Boxes, Truck, Receipt, CreditCard, RotateCcw, BarChart3, Settings, X 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { hasMenuPermission } from '../utils/permissions';

export const Sidebar = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const role = currentUser?.role;
  const userPermissions = currentUser?.permissions;

  const navItems = [
    { id: 'dashboard', path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', path: '/products', label: 'Products', icon: Package },
    { id: 'product-groups', path: '/product-groups', label: 'Product Groups', icon: FolderTree },
    { id: 'companies', path: '/companies', label: 'Companies', icon: Building2 },
    { id: 'customers', path: '/customers', label: 'Customers', icon: Users },
    { id: 'quotations', path: '/quotations', label: 'Quotations', icon: FileText },
    { id: 'follow-ups', path: '/follow-ups', label: 'Follow-Ups', icon: PhoneCall },
    { id: 'stock', path: '/stock', label: 'Stock', icon: Boxes },
    { id: 'challans', path: '/challans', label: 'Challans', icon: Truck },
    { id: 'invoices', path: '/invoices', label: 'Invoices', icon: Receipt },
    { id: 'payments', path: '/payments', label: 'Payments', icon: CreditCard },
    { id: 'returns', path: '/returns', label: 'Returns', icon: RotateCcw },
    { id: 'reports', path: '/reports', label: 'Reports', icon: BarChart3 },
    { id: 'users', path: '/users', label: 'Users & Settings', icon: Settings }
  ];

  const visibleItems = navItems.filter(item => hasMenuPermission(role, item.id, userPermissions));

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div 
        className="sidebar-header" 
        style={{ 
          padding: '1.1rem 1rem', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          minHeight: '70px'
        }}
      >
        <img 
          src="/Maitri-Ceramic-logo.png" 
          alt="Maitri Ceramic Logo" 
          style={{ 
            maxHeight: '52px', 
            maxWidth: '170px', 
            width: 'auto', 
            height: 'auto',
            objectFit: 'contain',
            filter: 'brightness(0)',
            display: 'block' 
          }} 
        />
        <button 
          className="sidebar-close-btn" 
          onClick={onClose}
          aria-label="Close sidebar"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.25rem',
            color: '#64748b',
            display: 'none'
          }}
        >
          <X size={22} />
        </button>
      </div>
      
      <nav className="sidebar-nav">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end={item.path === '/'}
              onClick={onClose}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;

