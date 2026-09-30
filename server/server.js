const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const connectDB = require('./config/db');
const { errorHandler } = require('./middlewares/error.middleware');
const { sendSuccess } = require('./utils/response.util');

// Route imports
const authRoutes = require('./routes/auth.routes');
const roleRoutes = require('./routes/role.routes');
const userRoutes = require('./routes/user.routes');
const permissionRoutes = require('./routes/permission.routes');
const categoryRoutes = require('./routes/category.routes');
const companyRoutes = require('./routes/company.routes');
const productGroupRoutes = require('./routes/productGroup.routes');
const unitRoutes = require('./routes/unit.routes');
const taxRoutes = require('./routes/tax.routes');
const paymentModeRoutes = require('./routes/paymentMode.routes');
const quotationFormatRoutes = require('./routes/quotationFormat.routes');
const vendorRoutes = require('./routes/vendor.routes');
const productRoutes = require('./routes/product.routes');
const importRoutes = require('./routes/import.routes');

const { setupSwagger } = require('./config/swagger');

const app = express();

// Disable ETag generation to prevent 304 Not Modified caching on dynamic ERP endpoints
app.set('etag', false);

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
}));

// Disable client caching for real-time live ERP data
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Ensure database is connected for all requests (critical for serverless / Vercel execution)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Swagger Interactive API Documentation
setupSwagger(app);

// Health Check API
app.get('/api/health', (req, res) => {
  return sendSuccess(res, 'Maitri Ceramic ERP Backend is healthy and operational.', {
    service: 'Maitri Ceramic API',
    version: '1.0.0',
    documentation: '/api/docs',
    timestamp: new Date().toISOString()
  });
});

// Mount Module 1: Auth, Users & Permissions
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/permissions', permissionRoutes);

// Mount Module 2: Master Management
app.use('/api/categories', categoryRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/product-groups', productGroupRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/tax-presets', taxRoutes);
app.use('/api/payment-modes', paymentModeRoutes);
app.use('/api/quotation-formats', quotationFormatRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/products', productRoutes);

// Mount Module 3: Product Import (Excel & PDF)
app.use('/api/imports', importRoutes);

// Mount Module 4: Customer Management
const customerRoutes = require('./routes/customer.routes');
app.use('/api/customers', customerRoutes);

// Mount Module 5: Quotation Management
const quotationRoutes = require('./routes/quotation.routes');
app.use('/api/quotations', quotationRoutes);

// Mount Module 6: Follow-Up Management
const followUpRoutes = require('./routes/followUp.routes');
app.use('/api/follow-ups', followUpRoutes);

// Mount Module 7: Quotation Confirmation
const confirmationRoutes = require('./routes/confirmation.routes');
app.use('/api/confirmations', confirmationRoutes);

// Mount Module 8: Stock Management
const stockRoutes = require('./routes/stock.routes');
app.use('/api/stock', stockRoutes);

// Mount Module 9: Challan Management
const challanRoutes = require('./routes/challan.routes');
app.use('/api/challans', challanRoutes);

// Mount Module 10: Invoice Management
const invoiceRoutes = require('./routes/invoice.routes');
app.use('/api/invoices', invoiceRoutes);

// Mount Module 11: Payment Management
const paymentRoutes = require('./routes/payment.routes');
app.use('/api/payments', paymentRoutes);

// Mount Module 12: Return Management
const returnNoteRoutes = require('./routes/returnNote.routes');
app.use('/api/returns', returnNoteRoutes);

// Mount Module 13: Credit/Debit & Ledger
const ledgerRoutes = require('./routes/ledger.routes');
app.use('/api/ledger', ledgerRoutes);

// Mount Module 14: Product-Quotation Tracking
const productQuotationTrackingRoutes = require('./routes/productQuotationTracking.routes');
app.use('/api/product-tracking', productQuotationTrackingRoutes);

// Mount Module 15: Reports
const reportRoutes = require('./routes/report.routes');
app.use('/api/reports', reportRoutes);

// Mount Module 16: Audit / Activity Log
const auditLogRoutes = require('./routes/auditLog.routes');
app.use('/api/audit-log', auditLogRoutes);

// --- Serve Frontend Static Build from Backend Public Folder ---
const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));

// 404 Handler for Unhandled API Routes
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Resource not found at API route: ${req.originalUrl}`
  });
});

// SPA Fallback: Serve frontend index.html for all non-API navigation requests
app.get('*', (req, res, next) => {
  const indexPath = path.join(publicPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      // Fallback response if frontend build is not yet in public folder
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Maitri Ceramic ERP</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px; background: #f8fafc; color: #1e293b; }
              .card { background: white; padding: 40px; border-radius: 12px; max-width: 540px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
              h1 { color: #0284c7; margin-bottom: 12px; }
              code { background: #f1f5f9; padding: 4px 8px; border-radius: 6px; font-weight: 600; color: #0f172a; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Maitri Ceramic ERP</h1>
              <p>Backend API server is live and running.</p>
              <p style="color: #64748b; font-size: 0.95rem;">Please build the frontend using <code>npm run build</code> to generate static files into <code>server/public</code>.</p>
            </div>
          </body>
        </html>
      `);
    }
  });
});

// Centralized Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;

// Only start the server if this file is executed directly
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`🚀 Maitri Ceramic Backend Server running on port ${PORT}`);
    console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use by another process. Please close duplicate terminal instances.`);
    } else {
      console.error('Server error:', err);
    }
  });

  connectDB()
    .then(() => {
      console.log('✅ Database connection established.');
    })
    .catch((err) => {
      console.error('⚠️ Initial DB connect warning:', err.message);
    });
}

module.exports = app;
module.exports.app = app;
module.exports.connectDB = connectDB;
