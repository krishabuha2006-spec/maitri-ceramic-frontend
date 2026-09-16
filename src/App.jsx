import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';

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

const ProtectedRoute = ({ children }) => {
  const { currentUser } = useAuth();
  if (!currentUser) {
    return <Navigate to="/login" replace />;
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
            <Route index element={<Dashboard />} />
            
            {/* Products, Companies & Import */}
            <Route path="products" element={<Products />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/edit/:id" element={<ProductForm />} />
            <Route path="products/:id" element={<ProductDetails />} />
            <Route path="product-groups" element={<ProductGroups />} />
            <Route path="companies" element={<Companies />} />
            <Route path="imports" element={<ProductImport />} />

            {/* Customers */}
            <Route path="customers" element={<Customers />} />
            <Route path="customers/new" element={<CustomerForm />} />
            <Route path="customers/edit/:id" element={<CustomerForm />} />
            <Route path="customers/:id" element={<CustomerDetails />} />

            {/* Quotations */}
            <Route path="quotations" element={<Quotations />} />
            <Route path="quotations/create" element={<CreateQuotation />} />
            <Route path="quotations/edit/:id" element={<CreateQuotation />} />
            <Route path="quotations/:id" element={<QuotationDetails />} />
            <Route path="follow-ups" element={<FollowUps />} />

            {/* Stock */}
            <Route path="stock" element={<Stock />} />
            <Route path="stock/entry" element={<StockEntry />} />

            {/* Challans */}
            <Route path="challans" element={<Challans />} />
            <Route path="challans/create" element={<CreateChallan />} />

            {/* Invoices */}
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/create" element={<CreateInvoice />} />
            <Route path="invoices/:id" element={<InvoiceDetails />} />

            {/* Payments */}
            <Route path="payments" element={<Payments />} />
            <Route path="payments/entry" element={<PaymentEntry />} />
            <Route path="payments/:id" element={<PaymentReceipt />} />

            {/* Returns & Reports */}
            <Route path="returns" element={<Returns />} />
            <Route path="reports" element={<Reports />} />

            {/* Users & Settings */}
            <Route path="users" element={<Users />} />
            <Route path="settings" element={<Settings />} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
