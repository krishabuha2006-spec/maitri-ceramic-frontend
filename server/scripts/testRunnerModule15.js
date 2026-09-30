const http = require('http');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../server');
const SystemModule = require('../models/SystemModule');
const User = require('../models/User');
const Role = require('../models/Role');
const UserPermission = require('../models/UserPermission');
const Company = require('../models/Company');
const Unit = require('../models/UnitMaster');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const QuotationFormat = require('../models/QuotationFormatMaster');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const Challan = require('../models/Challan');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const PaymentModeMaster = require('../models/PaymentModeMaster');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const LedgerEntry = require('../models/LedgerEntry');
const SavedReportFilter = require('../models/SavedReportFilter');

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;
let salesManagerToken;
let salesManagerUser;
let inventoryOnlyToken;
let inventoryOnlyUser;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

let passed = 0;
let failed = 0;

function logPass(msg) {
  passed++;
  console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${msg}`);
}

function logFail(msg, err) {
  failed++;
  console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${msg}`);
  if (err) console.error(`    ${colors.yellow}Error details:${colors.reset}`, err);
  throw new Error(msg);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${colors.bold}=== ${title} ===${colors.reset}`);
}

async function api(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, fetchOptions);
  let data;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('spreadsheetml') || contentType.includes('octet-stream')) {
    data = await res.arrayBuffer();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, body: data, data };
}

async function runTests() {
  console.log(`\n${colors.magenta}${colors.bold}====================================================`);
  console.log(`🚀 MAITRI CERAMIC - MODULE 15 VERIFICATION SUITE`);
  console.log(`   (Consolidated Reports & Business Intelligence)`);
  console.log(`====================================================${colors.reset}\n`);

  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`Test server running on ${baseUrl}`);
      resolve();
    });
  });

  // Step 0: Super Admin & Multi-Persona User Authentication
  logSection('STEP 0: User Setup & Multi-Persona Authentication');
  superAdminUser = await User.findOne({ mobile: '9825702369' }).populate('role');
  if (!superAdminUser) {
    throw new Error('Super Admin user not found. Please seed database first.');
  }

  const loginAdminRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825702369', password: process.env.ADMIN_PASSWORD || 'Laksh@2508' }
  });
  superAdminToken = loginAdminRes.data.data.accessToken;
  logPass('Super Admin authenticated successfully.');

  const passwordHash = await User.hashPassword('Password@123');

  // Setup Role: Sales Manager (REPORTS + QUOTATION + CUSTOMER with dataScope: ALL)
  let salesManagerRole = await Role.findOne({ roleName: 'Sales Manager Rep' }) || await Role.create({
    roleName: 'Sales Manager Rep',
    description: 'Full Sales & Reports Access',
    isSystemRole: false
  });

  await User.deleteOne({ mobile: '9825700041' });
  salesManagerUser = await User.create({
    name: 'Sales Manager Rep',
    mobile: '9825700041',
    email: 'sales.mgr@maitri.com',
    passwordHash,
    role: salesManagerRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const smLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700041', password: 'Password@123' }
  });
  salesManagerToken = smLoginRes.data.data.accessToken;

  // Setup Role: Inventory Staff (REPORTS + STOCK + PRODUCT_MASTER, NO QUOTATION / BILLING)
  let inventoryRole = await Role.findOne({ roleName: 'Inventory Staff Rep' }) || await Role.create({
    roleName: 'Inventory Staff Rep',
    description: 'Inventory & Stock Reports Access Only',
    isSystemRole: false
  });

  await User.deleteOne({ mobile: '9825700042' });
  inventoryOnlyUser = await User.create({
    name: 'Inventory Staff Rep',
    mobile: '9825700042',
    email: 'inventory.rep@maitri.com',
    passwordHash,
    role: inventoryRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const invLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700042', password: 'Password@123' }
  });
  inventoryOnlyToken = invLoginRes.data.data.accessToken;
  logPass('Multi-persona test users created and authenticated.');

  // Step 1: SystemModule Registration
  logSection('STEP 1: SystemModule Registration (REPORTS)');
  let reportsMod = await SystemModule.findOne({ moduleKey: 'REPORTS' });
  if (!reportsMod) {
    reportsMod = await SystemModule.create({
      moduleKey: 'REPORTS',
      moduleName: 'Reports & Analytics',
      parentModule: 'REPORTS',
      isActive: true
    });
  }
  logPass('REPORTS registered and active in SystemModule registry.');

  // Fetch relevant modules for permission linking
  const modQuotation = await SystemModule.findOne({ moduleKey: 'QUOTATION' });
  const modCustomer = await SystemModule.findOne({ moduleKey: 'CUSTOMER' });
  const modStock = await SystemModule.findOne({ moduleKey: 'STOCK' });
  const modProduct = await SystemModule.findOne({ moduleKey: 'PRODUCT_MASTER' });
  const modInvoice = await SystemModule.findOne({ moduleKey: 'INVOICE' });
  const modPayment = await SystemModule.findOne({ moduleKey: 'PAYMENT' });
  const modLedger = await SystemModule.findOne({ moduleKey: 'CUSTOMER_LEDGER' });

  // Grant Sales Manager permissions (REPORTS, QUOTATION, CUSTOMER, INVOICE, PAYMENT, CUSTOMER_LEDGER)
  const fullActions = { view: true, create: true, edit: true, delete: true, export: true, approve: true };
  const grantListSM = [reportsMod, modQuotation, modCustomer, modInvoice, modPayment, modLedger];
  for (const m of grantListSM) {
    if (!m) continue;
    await UserPermission.findOneAndUpdate(
      { user: salesManagerUser._id, module: m._id },
      { $set: { actions: fullActions, dataScope: 'ALL', grantedBy: superAdminUser._id, isActive: true } },
      { upsert: true }
    );
  }

  // Grant Inventory Only permissions (REPORTS, STOCK, PRODUCT_MASTER ONLY)
  const grantListInv = [reportsMod, modStock, modProduct];
  for (const m of grantListInv) {
    if (!m) continue;
    await UserPermission.findOneAndUpdate(
      { user: inventoryOnlyUser._id, module: m._id },
      { $set: { actions: fullActions, dataScope: 'ALL', grantedBy: superAdminUser._id, isActive: true } },
      { upsert: true }
    );
  }
  logPass('User permissions configured with double-gate separation.');

  // Step 2: Shared Response Structure Verification
  logSection('STEP 2: Standard Report Response Contract ({ data, pagination, summary? })');
  const custReportRes = await api('/reports/customers/list?page=1&limit=10', { token: superAdminToken });
  if (custReportRes.status !== 200) logFail('Failed customer list report', custReportRes.data);
  const envelope = custReportRes.data.data;
  if (!Array.isArray(envelope.data) || !envelope.pagination || typeof envelope.pagination.totalRecords !== 'number') {
    logFail('Standard report response envelope missing data or pagination blocks', envelope);
  }
  logPass('Verified standard response envelope: { data: [...], pagination: { page, limit, totalRecords, totalPages } }.');

  // Step 3: Discovery Catalog
  logSection('STEP 3: Dynamic Report Catalog Discovery (/api/reports/catalog)');
  const catalogAdminRes = await api('/reports/catalog', { token: superAdminToken });
  if (catalogAdminRes.status !== 200 || !Array.isArray(catalogAdminRes.data.data)) {
    logFail('Failed to get report catalog for super admin', catalogAdminRes.data);
  }
  const allCategories = catalogAdminRes.data.data;
  if (allCategories.length !== 5) {
    logFail(`Expected 5 report categories, got ${allCategories.length}`);
  }
  logPass('Super Admin sees all 5 report categories in catalog.');

  // Check inventory user catalog visibility
  const catalogInvRes = await api('/reports/catalog', { token: inventoryOnlyToken });
  const invCatalog = catalogInvRes.data.data;
  const stockCat = invCatalog.find((c) => c.category === 'STOCK_REPORTS');
  const quoteCat = invCatalog.find((c) => c.category === 'QUOTATION_REPORTS');

  if (!stockCat || !stockCat.hasAccess) {
    logFail('Inventory user should have access to Stock Reports category');
  }
  if (!quoteCat || quoteCat.hasAccess !== false) {
    logFail('Inventory user without QUOTATION permission should have hasAccess: false on Quotation Reports');
  }
  logPass('Dynamic catalog correctly annotates `hasAccess: true` for Stock and `hasAccess: false` for Quotations for Inventory User.');

  // Step 4: Customer Reports (Cross-Customer Outstanding & 360 History)
  logSection('STEP 4: Customer Reports (Outstanding & Ledger Statement)');
  const comp = (await Company.findOne({ companyType: 'OWN' })) || (await Company.create({
    companyName: 'Maitri Ceramic Own',
    companyType: 'OWN',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const customerRep = await Customer.create({
    customerName: `Reports Customer ${Date.now()}`,
    mobile: `95${Date.now().toString().slice(-8)}`,
    city: 'Morbi',
    customerType: 'RETAIL',
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Post test invoice & payment to give this customer a live outstanding balance
  await LedgerEntry.create({
    customer: customerRep._id,
    entryDate: new Date(),
    particular: 'Invoice #INV-REP-001',
    entryType: 'DEBIT',
    amount: 15000,
    runningBalance: 15000,
    sourceType: 'INVOICE',
    sourceId: new mongoose.Types.ObjectId(),
    postedBy: superAdminUser._id,
    isActive: true
  });

  await LedgerEntry.create({
    customer: customerRep._id,
    entryDate: new Date(),
    particular: 'Payment #RCPT-REP-001',
    entryType: 'CREDIT',
    amount: 5000,
    runningBalance: 10000,
    sourceType: 'PAYMENT',
    sourceId: new mongoose.Types.ObjectId(),
    postedBy: superAdminUser._id,
    isActive: true
  });

  const outRes = await api('/reports/customers/outstanding', { token: superAdminToken });
  if (outRes.status !== 200) logFail('Failed to fetch cross-customer outstanding report', outRes.data);
  const matchedCustOut = outRes.data.data.data.find((c) => String(c.customerId) === String(customerRep._id));
  if (!matchedCustOut || matchedCustOut.outstandingAmount !== 10000) {
    logFail(`Expected outstanding amount 10000, got ${matchedCustOut?.outstandingAmount}`);
  }
  logPass(`Cross-customer Outstanding Report verified with balance ₹${matchedCustOut.outstandingAmount} (summary total: ₹${outRes.data.data.summary.totalOutstandingAmount}).`);

  const ledgerRepRes = await api(`/reports/customers/${customerRep._id}/ledger`, { token: superAdminToken });
  if (ledgerRepRes.status !== 200 || ledgerRepRes.data.data.closingBalance !== 10000) {
    logFail('Customer ledger report closing balance mismatch', ledgerRepRes.data);
  }
  logPass('Customer Ledger statement report verified with Closing Balance ₹10,000.');

  // Step 5: Quotation Reports & Conversion Analytics
  logSection('STEP 5: Quotation Reports & Conversion Analytics');
  const unit = (await Unit.findOne({ isActive: true })) || (await Unit.create({
    unitName: 'Square Meter',
    unitCode: 'SQM',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const format = (await QuotationFormat.findOne({ isActive: true })) || (await QuotationFormat.create({
    formatName: 'Format 1',
    formatType: 'TILES_SQFT',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const repProduct = await Product.create({
    productName: 'Report Vitrified Slab',
    companySkuCode: `SKU-REP-${Date.now().toString().slice(-4)}`,
    company: comp._id,
    unit: unit._id,
    mrp: 1000,
    salePrice: 1000,
    currentStock: 500,
    reorderAlertQty: 50,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const qConfirmed = await Quotation.create({
    quotationNumber: `Q-CONF-${Date.now().toString().slice(-4)}`,
    customer: customerRep._id,
    company: comp._id,
    format: format._id,
    salesperson: superAdminUser._id,
    quotationDate: new Date(),
    items: [{
      product: repProduct._id,
      productNameSnapshot: repProduct.productName,
      skuCodeSnapshot: repProduct.companySkuCode,
      quantity: 10,
      quotedRate: 1000,
      mrpSnapshot: 1000,
      grossAmount: 10000,
      discountPct: 0,
      discountAmount: 0,
      taxPct: 0,
      gstAmount: 0,
      netAmount: 10000,
      totalAmount: 10000
    }],
    subTotal: 10000,
    totalTax: 0,
    grandTotal: 10000,
    status: 'CONFIRMED',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const qPending = await Quotation.create({
    quotationNumber: `Q-PEND-${Date.now().toString().slice(-4)}`,
    customer: customerRep._id,
    company: comp._id,
    format: format._id,
    salesperson: superAdminUser._id,
    quotationDate: new Date(),
    items: [{
      product: repProduct._id,
      productNameSnapshot: repProduct.productName,
      skuCodeSnapshot: repProduct.companySkuCode,
      quantity: 5,
      quotedRate: 1000,
      mrpSnapshot: 1000,
      grossAmount: 5000,
      discountPct: 0,
      discountAmount: 0,
      taxPct: 0,
      gstAmount: 0,
      netAmount: 5000,
      totalAmount: 5000
    }],
    subTotal: 5000,
    totalTax: 0,
    grandTotal: 5000,
    status: 'FOLLOW_UP_PENDING',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const convRes = await api('/reports/quotations/conversion', { token: superAdminToken });
  if (convRes.status !== 200 || !convRes.data.data.summary) {
    logFail('Failed to fetch quotation conversion report', convRes.data);
  }
  const convSum = convRes.data.data.summary;
  if (convSum.confirmedCount < 1 || convSum.conversionRateCountPct <= 0) {
    logFail('Quotation conversion rate should be positive', convSum);
  }
  logPass(`Quotation Conversion report verified: ${convSum.confirmedCount} confirmed out of ${convSum.totalQuotations} (Conversion: ${convSum.conversionRateCountPct}% by count, ${convSum.conversionRateValuePct}% by value).`);

  // Step 6: Product Reports
  logSection('STEP 6: Product Reports (Master, Stock & Low Stock)');
  const prodMasterRes = await api('/reports/products/master', { token: superAdminToken });
  if (prodMasterRes.status !== 200 || prodMasterRes.data.data.data.length === 0) {
    logFail('Failed to fetch product master report', prodMasterRes.data);
  }
  logPass(`Product Master Report returned ${prodMasterRes.data.data.data.length} products.`);

  const lowStockRes = await api('/reports/products/low-stock', { token: superAdminToken });
  if (lowStockRes.status !== 200) logFail('Failed to fetch low stock report', lowStockRes.data);
  logPass(`Low Stock Report returned ${lowStockRes.data.data.data.length} low stock items.`);

  // Step 7: Stock Reports
  logSection('STEP 7: Stock Reports (Movement History & Challan Deductions)');
  await StockLedgerEntry.create({
    entryNumber: 'SLE-TEST-' + Date.now(),
    product: repProduct._id,
    entryDate: new Date(),
    direction: 'IN',
    quantity: 100,
    reason: 'OPENING_STOCK',
    balanceAfter: 100,
    postedBy: superAdminUser._id,
    remarks: 'Initial stock load'
  });

  const stockMoveRes = await api('/reports/stock/movement-history', { token: superAdminToken });
  if (stockMoveRes.status !== 200 || stockMoveRes.data.data.data.length === 0) {
    logFail('Failed to fetch stock movement history report', stockMoveRes.data);
  }
  logPass(`Stock Movement History Report returned ${stockMoveRes.data.data.data.length} ledger movements.`);

  // Step 8: Sales & Financial Reports (Dual Category Verification)
  logSection('STEP 8: Sales & Financial Reports (Dual Category Outstanding Verification)');
  const finOutRes = await api('/reports/finance/outstanding', { token: superAdminToken });
  if (finOutRes.status !== 200) logFail('Failed to fetch finance outstanding report', finOutRes.data);

  // Assert dual category endpoints return identical data
  if (finOutRes.data.data.summary.totalOutstandingAmount !== outRes.data.data.summary.totalOutstandingAmount) {
    logFail('Finance Outstanding and Customer Outstanding reports must return identical totals');
  }
  logPass('Verified `/api/reports/finance/outstanding` matches `/api/reports/customers/outstanding` exactly!');

  const creditDebitRes = await api('/reports/finance/credit-debit', { token: superAdminToken });
  if (creditDebitRes.status !== 200 || !creditDebitRes.data.data.summary) {
    logFail('Failed to fetch credit debit report', creditDebitRes.data);
  }
  logPass(`Credit/Debit Report verified: Total Debit ₹${creditDebitRes.data.data.summary.totalDebit}, Total Credit ₹${creditDebitRes.data.data.summary.totalCredit}.`);

  // Step 9: Synchronous Excel Export (?format=excel)
  logSection('STEP 9: Synchronous Excel Export (?format=excel)');
  const excelExportRes = await api('/reports/customers/list?format=excel', { token: superAdminToken });
  if (excelExportRes.status !== 200 || !excelExportRes.data || excelExportRes.data.byteLength === 0) {
    logFail('Failed to download synchronous Excel report workbook');
  }
  logPass(`Downloaded formatted Excel workbook (${excelExportRes.data.byteLength} bytes).`);

  // Step 10: Saved Filters CRUD (User-Scoped)
  logSection('STEP 10: Saved Filters CRUD (User-Scoped)');
  const saveFilterRes = await api('/reports/saved-filters', {
    method: 'POST',
    token: salesManagerToken,
    body: {
      reportKey: 'QUOTATION_PENDING',
      filterName: 'My Pending Quotations Filter',
      filters: { status: 'FOLLOW_UP_PENDING', city: 'Morbi' }
    }
  });
  if (saveFilterRes.status !== 201) logFail('Failed to create saved filter', saveFilterRes.data);
  const createdFilter = saveFilterRes.data.data;
  logPass(`Created saved filter '${createdFilter.filterName}'.`);

  // Sales Manager can see their own filter
  const listFiltersRes = await api('/reports/saved-filters', { token: salesManagerToken });
  if (listFiltersRes.data.data.length === 0) logFail('Saved filter list should contain newly created filter');
  logPass('Retrieved user-scoped saved filters successfully.');

  // Inventory User cannot see Sales Manager's saved filter
  const listFiltersInvRes = await api('/reports/saved-filters', { token: inventoryOnlyToken });
  if (listFiltersInvRes.data.data.some((f) => f._id === createdFilter._id)) {
    logFail('Inventory user should NOT see Sales Manager saved filter');
  }
  logPass('Verified Saved Filters are strictly scoped to the requesting user.');

  // Step 11: Double-Gate Permission Enforcement
  logSection('STEP 11: Double-Gate Permission Enforcement');
  // Inventory user has REPORTS:view, but lacks QUOTATION:view
  const blockedQuoteRes = await api('/reports/quotations/all', { token: inventoryOnlyToken });
  if (blockedQuoteRes.status !== 403) {
    logFail(`User without QUOTATION.view should be blocked with 403, got ${blockedQuoteRes.status}`);
  }
  logPass('User without QUOTATION.view is blocked (403) on `/reports/quotations/all`.');

  // Sales Manager lacks STOCK:view
  const blockedStockRes = await api('/reports/stock/movement-history', { token: salesManagerToken });
  if (blockedStockRes.status !== 403) {
    logFail(`User without STOCK.view should be blocked with 403, got ${blockedStockRes.status}`);
  }
  logPass('User without STOCK.view is blocked (403) on `/reports/stock/movement-history`.');

  console.log(`\n${colors.green}${colors.bold}====================================================`);
  console.log(`🎉 ALL MODULE 15 (REPORTS & BI) TESTS PASSED! (${passed} Passed, ${failed} Failed)`);
  console.log(`====================================================${colors.reset}\n`);

  server.close(() => process.exit(0));
}

runTests().catch((err) => {
  console.error(`\n${colors.red}❌ MODULE 15 TEST RUNNER FAILED:${colors.reset}`, err);
  if (server) server.close();
  process.exit(1);
});
