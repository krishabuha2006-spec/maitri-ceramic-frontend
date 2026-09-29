import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';

const titleMap = {
  '/': 'Home - Ceramic & Luxury Tiles Showcase',
  '/products': 'Product Management',
  '/products/new': 'Add New Product',
  '/product-types': 'Product Types & SubTypes',
  '/product-groups': 'Product Types & SubTypes',
  '/companies': 'Companies & Brands',
  '/customers': 'Customer Directory & Hub',
  '/customers/new': 'Add New Customer',
  '/quotations': 'Quotation Management',
  '/quotations/create': 'Create Quotation',
  '/follow-ups': 'Quotation Follow-Ups',
  '/stock': 'Stock Management & Inventory',
  '/stock/entry': 'Stock Entry Form',
  '/challans': 'Delivery Challans',
  '/challans/create': 'Create Delivery Challan',
  '/invoices': 'Sales Invoices',
  '/invoices/create': 'Create Sales Invoice',
  '/payments': 'Payments & Receipts',
  '/payments/entry': 'Record Payment Receipt',
  '/returns': 'Returns Management',
  '/reports': 'Reports Hub',
  '/settings': 'Settings & System Configuration',
  '/users': 'Users & Role Settings'
};

export const Layout = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  let pageTitle = titleMap[currentPath];
  if (!pageTitle) {
    if (currentPath.startsWith('/products/')) pageTitle = 'Product Details';
    else if (currentPath.startsWith('/customers/')) pageTitle = 'Customer 360° Hub & History';
    else if (currentPath.startsWith('/quotations/')) pageTitle = 'Quotation Details';
    else if (currentPath.startsWith('/invoices/')) pageTitle = 'Invoice Details';
    else if (currentPath.startsWith('/payments/')) pageTitle = 'Payment Receipt Preview';
    else pageTitle = 'Maitri Ceramic';
  }

  return (
    <div className="app-container">
      <Header pageTitle={pageTitle} />
      <div className="main-content">
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;

