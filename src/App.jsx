import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import AccessDenied from './components/AccessDenied';
import { ROLES, canView, canCreate, canEdit } from './utils/permissions';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import ProductDetails from './pages/ProductDetails';
import ProductImport from './pages/ProductImport';
import Customers from './pages/Customers';
import CustomerForm from './pages/CustomerForm';
import CustomerDetails from './pages/CustomerDetails';
import Quotations from './pages/Quotations';
import CreateQuotation from './pages/CreateQuotation';
import QuotationDetails from './pages/QuotationDetails';
import FollowUps from './pages/FollowUps';
import Stock from './pages/Stock';
import StockEntry from './pages/StockEntry';
import Challans from './pages/Challans';
import CreateChallan from './pages/CreateChallan';
import Invoices from './pages/Invoices';
import CreateInvoice from './pages/CreateInvoice';
import InvoiceDetails from './pages/InvoiceDetails';
import Payments from './pages/Payments';
import PaymentEntry from './pages/PaymentEntry';
import PaymentReceipt from './pages/PaymentReceipt';
import Returns from './pages/Returns';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';

import Companies from './pages/Companies';
import ProductGroups from './pages/ProductGroups';
import QuotationFormats from './pages/QuotationFormats';

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PermissionRoute = ({ moduleId, action = 'view', children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Super Admin has full unrestricted access
  if (currentUser.role === ROLES.SUPER_ADMIN) {
    return children;
  }

  let hasAccess = true;
  if (action === 'create') {
    hasAccess = canCreate(currentUser.role, moduleId, currentUser.permissions);
  } else if (action === 'edit') {
    hasAccess = canEdit(currentUser.role, moduleId, currentUser.permissions);
  } else {
    hasAccess = canView(currentUser.role, moduleId, currentUser.permissions);
  }

  if (!hasAccess) {
    return <AccessDenied moduleId={moduleId} action={action} />;
  }

  return children;
};

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={
              <PermissionRoute moduleId="dashboard">
                <Dashboard />
              </PermissionRoute>
            } />
            
            {/* Products, Companies & Import */}
            <Route path="products" element={
              <PermissionRoute moduleId="products">
                <Products />
              </PermissionRoute>
            } />
            <Route path="products/new" element={
              <PermissionRoute moduleId="products" action="create">
                <ProductForm />
              </PermissionRoute>
            } />
            <Route path="products/edit/:id" element={
              <PermissionRoute moduleId="products" action="edit">
                <ProductForm />
              </PermissionRoute>
            } />
            <Route path="products/:id" element={
              <PermissionRoute moduleId="products">
                <ProductDetails />
              </PermissionRoute>
            } />
            <Route path="product-groups" element={
              <PermissionRoute moduleId="product-groups">
                <ProductGroups />
              </PermissionRoute>
            } />
            <Route path="companies" element={
              <PermissionRoute moduleId="companies">
                <Companies />
              </PermissionRoute>
            } />
            <Route path="imports" element={
              <PermissionRoute moduleId="products" action="create">
                <ProductImport />
              </PermissionRoute>
            } />

            {/* Customers */}
            <Route path="customers" element={
              <PermissionRoute moduleId="customers">
                <Customers />
              </PermissionRoute>
            } />
            <Route path="customers/new" element={
              <PermissionRoute moduleId="customers" action="create">
                <CustomerForm />
              </PermissionRoute>
            } />
            <Route path="customers/edit/:id" element={
              <PermissionRoute moduleId="customers" action="edit">
                <CustomerForm />
              </PermissionRoute>
            } />
            <Route path="customers/:id" element={
              <PermissionRoute moduleId="customers">
                <CustomerDetails />
              </PermissionRoute>
            } />

            {/* Quotations */}
            <Route path="quotations" element={
              <PermissionRoute moduleId="quotations">
                <Quotations />
              </PermissionRoute>
            } />
            <Route path="quotations/create" element={
              <PermissionRoute moduleId="quotations" action="create">
                <CreateQuotation />
              </PermissionRoute>
            } />
            <Route path="quotations/edit/:id" element={
              <PermissionRoute moduleId="quotations" action="edit">
                <CreateQuotation />
              </PermissionRoute>
            } />
            <Route path="quotations/:id" element={
              <PermissionRoute moduleId="quotations">
                <QuotationDetails />
              </PermissionRoute>
            } />
            <Route path="quotation-formats" element={
              <PermissionRoute moduleId="quotations">
                <QuotationFormats />
              </PermissionRoute>
            } />
            <Route path="follow-ups" element={
              <PermissionRoute moduleId="quotations">
                <FollowUps />
              </PermissionRoute>
            } />

            {/* Stock */}
            <Route path="stock" element={
              <PermissionRoute moduleId="stock">
                <Stock />
              </PermissionRoute>
            } />
            <Route path="stock/entry" element={
              <PermissionRoute moduleId="stock" action="create">
                <StockEntry />
              </PermissionRoute>
            } />

            {/* Challans */}
            <Route path="challans" element={
              <PermissionRoute moduleId="challans">
                <Challans />
              </PermissionRoute>
            } />
            <Route path="challans/create" element={
              <PermissionRoute moduleId="challans" action="create">
                <CreateChallan />
              </PermissionRoute>
            } />

            {/* Invoices */}
            <Route path="invoices" element={
              <PermissionRoute moduleId="invoices">
                <Invoices />
              </PermissionRoute>
            } />
            <Route path="invoices/create" element={
              <PermissionRoute moduleId="invoices" action="create">
                <CreateInvoice />
              </PermissionRoute>
            } />
            <Route path="invoices/:id" element={
              <PermissionRoute moduleId="invoices">
                <InvoiceDetails />
              </PermissionRoute>
            } />

            {/* Payments */}
            <Route path="payments" element={
              <PermissionRoute moduleId="payments">
                <Payments />
              </PermissionRoute>
            } />
            <Route path="payments/entry" element={
              <PermissionRoute moduleId="payments" action="create">
                <PaymentEntry />
              </PermissionRoute>
            } />
            <Route path="payments/:id" element={
              <PermissionRoute moduleId="payments">
                <PaymentReceipt />
              </PermissionRoute>
            } />

            {/* Returns & Reports */}
            <Route path="returns" element={
              <PermissionRoute moduleId="returns">
                <Returns />
              </PermissionRoute>
            } />
            <Route path="reports" element={
              <PermissionRoute moduleId="reports">
                <Reports />
              </PermissionRoute>
            } />

            {/* Users & Settings */}
            <Route path="users" element={
              <PermissionRoute moduleId="users">
                <Users />
              </PermissionRoute>
            } />
            <Route path="settings" element={
              <PermissionRoute moduleId="users">
                <Settings />
              </PermissionRoute>
            } />
            <Route path="units" element={<Navigate to="/settings?tab=units" replace />} />
            <Route path="tax-presets" element={<Navigate to="/settings?tab=tax" replace />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
