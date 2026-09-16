import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Menu } from 'lucide-react';

export const Header = ({ pageTitle = 'Dashboard', onToggleSidebar }) => {
  const { currentUser, logout } = useAuth();

  return (
    <header className="header">
      <div className="header-left">
        <button 
          type="button" 
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} />
        </button>
        <h1 className="page-title-heading">{pageTitle}</h1>
      </div>

      <div className="header-actions">
        <div className="user-profile">
          <div className="user-avatar">
            {currentUser?.name?.charAt(0) || 'M'}
          </div>
          <div className="user-info-text">
            <span className="user-name-text">{currentUser?.name || 'User'}</span>
            <span className="user-role-text">{currentUser?.role || 'Super Admin'}</span>
          </div>
          <button 
            className="btn btn-secondary btn-sm logout-btn" 
            onClick={logout}
            title="Logout"
          >
            <LogOut size={16} />
            <span className="logout-text">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;

