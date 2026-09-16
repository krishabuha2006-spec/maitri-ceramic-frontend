import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const titleMap = {
  '/': 'Dashboard',
  '/products': 'Product Management',
  '/products/new': 'Add New Product',
  '/customers': 'Customer Directory',
  '/customers/new': 'Add New Customer',
  '/quotations': 'Quotation Management',
  '/quotations/create': 'Create Quotation',
  '/follow-ups': 'Quotation Follow-Ups',
  '/stock': 'Stock & Inventory',
  '/stock/entry': 'Stock Entry Form',
  '/challans': 'Delivery Challans',
  '/challans/create': 'Create Delivery Challan',
  '/invoices': 'Sales Invoices',
  '/invoices/create': 'Create Sales Invoice',
  '/payments': 'Payments & Receipts',
  '/payments/entry': 'Record Payment Receipt',
  '/returns': 'Returns Management',
  '/reports': 'Reports Hub',
  '/users': 'Users & Role Settings'
};

export const Layout = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath]);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  let pageTitle = titleMap[currentPath];
  if (!pageTitle) {
    if (currentPath.startsWith('/products/')) pageTitle = 'Product Details';
    else if (currentPath.startsWith('/customers/')) pageTitle = 'Customer Details & History';
    else if (currentPath.startsWith('/quotations/')) pageTitle = 'Quotation Details';
    else if (currentPath.startsWith('/invoices/')) pageTitle = 'Invoice Details';
    else if (currentPath.startsWith('/payments/')) pageTitle = 'Payment Receipt Preview';
    else pageTitle = 'Maitri Ceramic';
  }

  return (
    <div className="app-container">
      {sidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="main-content">
        <Header pageTitle={pageTitle} onToggleSidebar={toggleSidebar} />
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

