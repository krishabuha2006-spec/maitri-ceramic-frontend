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
const ProductQuotationSummaryCache = require('../models/ProductQuotationSummaryCache');
const productTrackingService = require('../services/productQuotationTracking.service');

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;
let salesExecUser;
let salesExecToken;
let warehouseUser;
let warehouseToken;

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
  console.log(`🚀 MAITRI CERAMIC - MODULE 14 VERIFICATION SUITE`);
  console.log(`   (Product-Quotation Tracking & Demand Analytics)`);
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

  // Step 0: Super Admin Authentication
  logSection('STEP 0: Super Admin Authentication & User Setup');
  superAdminUser = await User.findOne({ mobile: '9825702369' }).populate('role');
  if (!superAdminUser) {
    throw new Error('Super Admin user not found. Please seed database first.');
  }

  const loginRes = await api('/auth/login', {
    method: 'POST',
    body: {
      mobile: '9825702369',
      password: process.env.ADMIN_PASSWORD || 'Laksh@2508'
    }
  });

  if (loginRes.status !== 200 || !loginRes.data.data?.accessToken) {
    logFail('Failed to login as Super Admin', loginRes.data);
  }
  superAdminToken = loginRes.data.data.accessToken;
  logPass('Super Admin authenticated successfully.');

  // Create/Ensure Sales Executive User (with QUOTATION dataScope: OWN)
  const passwordHash = await User.hashPassword('Password@123');
  let salesRole = await Role.findOne({ roleName: 'Sales Executive' }) || await Role.create({
    roleName: 'Sales Executive',
    description: 'Sales Executive with OWN scope',
    isSystemRole: false
  });

  await User.deleteOne({ mobile: '9825700031' });
  salesExecUser = await User.create({
    name: 'Sales Exec A',
    mobile: '9825700031',
    email: 'sales.a@maitri.com',
    passwordHash,
    role: salesRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const salesLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700031', password: 'Password@123' }
  });
  salesExecToken = salesLoginRes.data.data.accessToken;

  // Create Warehouse User (PRODUCT_MASTER: view ONLY, no PRODUCT_QUOTATION_TRACKING)
  let warehouseRole = await Role.findOne({ roleName: 'Warehouse Staff' }) || await Role.create({
    roleName: 'Warehouse Staff',
    description: 'Inventory Only Staff',
    isSystemRole: false
  });

  await User.deleteOne({ mobile: '9825700032' });
  warehouseUser = await User.create({
    name: 'Warehouse User',
    mobile: '9825700032',
    email: 'warehouse@maitri.com',
    passwordHash,
    role: warehouseRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const warehouseLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700032', password: 'Password@123' }
  });
  warehouseToken = warehouseLoginRes.data.data.accessToken;

  // Step 1: SystemModule Registration
  logSection('STEP 1: SystemModule Registration (PRODUCT_QUOTATION_TRACKING)');
  let trackingMod = await SystemModule.findOne({ moduleKey: 'PRODUCT_QUOTATION_TRACKING' });
  if (!trackingMod) {
    trackingMod = await SystemModule.create({
      moduleKey: 'PRODUCT_QUOTATION_TRACKING',
      moduleName: 'Product-Quotation Tracking',
      parentModule: 'REPORTS',
      isActive: true
    });
  }
  logPass('PRODUCT_QUOTATION_TRACKING registered and active in SystemModule registry.');

  let quotationMod = await SystemModule.findOne({ moduleKey: 'QUOTATION' });
  if (!quotationMod) {
    quotationMod = await SystemModule.create({
      moduleKey: 'QUOTATION',
      moduleName: 'Quotation Management',
      parentModule: 'SALES',
      isActive: true
    });
  }

  let prodMasterMod = await SystemModule.findOne({ moduleKey: 'PRODUCT_MASTER' });
  if (!prodMasterMod) {
    prodMasterMod = await SystemModule.create({
      moduleKey: 'PRODUCT_MASTER',
      moduleName: 'Product Master',
      parentModule: 'MASTERS',
      isActive: true
    });
  }

  // Grant Sales Exec OWN permission on QUOTATION & view on PRODUCT_QUOTATION_TRACKING & PRODUCT_MASTER
  await UserPermission.findOneAndUpdate(
    { user: salesExecUser._id, module: quotationMod._id },
    {
      $set: {
        actions: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
        dataScope: 'OWN',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  await UserPermission.findOneAndUpdate(
    { user: salesExecUser._id, module: trackingMod._id },
    {
      $set: {
        actions: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
        dataScope: 'ALL',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  await UserPermission.findOneAndUpdate(
    { user: salesExecUser._id, module: prodMasterMod._id },
    {
      $set: {
        actions: { view: true, create: false, edit: false, delete: false, export: true, approve: false },
        dataScope: 'ALL',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  // Grant Warehouse User view on PRODUCT_MASTER only (No PRODUCT_QUOTATION_TRACKING)
  await UserPermission.findOneAndUpdate(
    { user: warehouseUser._id, module: prodMasterMod._id },
    {
      $set: {
        actions: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
        dataScope: 'ALL',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  // Step 2: Setup Client's Documented Worked Example
  // SKU: 882IN-AF, Product: AQUA TURBO 235 MANUAL VALVE
  logSection("STEP 2: Setup Client's Documented Worked Example (SKU 882IN-AF)");
  const company = (await Company.findOne({ companyType: 'OWN', isActive: true })) || (await Company.create({
    companyName: 'Maitri Ceramic Own',
    companyType: 'OWN',
    brandName: 'Maitri Sanitary',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const unit = (await Unit.findOne({ isActive: true })) || (await Unit.create({
    unitName: 'Pieces',
    unitCode: 'PCS',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const format = (await QuotationFormat.findOne({ isActive: true })) || (await QuotationFormat.create({
    formatName: 'Default Format',
    formatType: 'TILES_SQFT',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const valveProduct = await Product.create({
    productName: 'AQUA TURBO 235 MANUAL VALVE',
    companySkuCode: `882IN-AF-${Date.now().toString().slice(-4)}`,
    company: company._id,
    unit: unit._id,
    mrp: 6000,
    salePrice: 6000,
    gstPct: 0,
    currentStock: 100,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const customerA = await Customer.create({
    customerName: 'Customer A',
    mobile: `91${Date.now().toString().slice(-8)}`,
    city: 'Morbi',
    customerType: 'RETAIL',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const customerB = await Customer.create({
    customerName: 'Customer B',
    mobile: `92${Date.now().toString().slice(-8)}`,
    city: 'Rajkot',
    customerType: 'DEALER',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const customerC = await Customer.create({
    customerName: 'Customer C',
    mobile: `93${Date.now().toString().slice(-8)}`,
    city: 'Ahmedabad',
    customerType: 'CONTRACTOR',
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Quotation 1: Q-001 | Customer A | Qty: 2 | Amount: ₹12,000 | Status: CONFIRMED | Created by Sales Exec A
  const q1 = await Quotation.create({
    quotationNumber: `Q-001-${Date.now().toString().slice(-4)}`,
    customer: customerA._id,
    company: company._id,
    format: format._id,
    salesperson: salesExecUser._id,
    quotationDate: new Date('2026-09-01'),
    items: [{
      product: valveProduct._id,
      productNameSnapshot: valveProduct.productName,
      skuCodeSnapshot: valveProduct.companySkuCode,
      quantity: 2,
      quotedRate: 6000,
      mrpSnapshot: 6000,
      grossAmount: 12000,
      discountPct: 0,
      discountAmount: 0,
      taxPct: 0,
      gstAmount: 0,
      netAmount: 12000,
      totalAmount: 12000
    }],
    subTotal: 12000,
    totalTax: 0,
    grandTotal: 12000,
    status: 'CONFIRMED',
    isActive: true,
    createdBy: salesExecUser._id
  });

  // Quotation 2: Q-015 | Customer B | Qty: 1 | Amount: ₹6,000 | Status: PENDING | Created by Sales Exec A (No Confirmation)
  const q2 = await Quotation.create({
    quotationNumber: `Q-015-${Date.now().toString().slice(-4)}`,
    customer: customerB._id,
    company: company._id,
    format: format._id,
    salesperson: salesExecUser._id,
    quotationDate: new Date('2026-09-04'),
    items: [{
      product: valveProduct._id,
      productNameSnapshot: valveProduct.productName,
      skuCodeSnapshot: valveProduct.companySkuCode,
      quantity: 1,
      quotedRate: 6000,
      mrpSnapshot: 6000,
      grossAmount: 6000,
      discountPct: 0,
      discountAmount: 0,
      taxPct: 0,
      gstAmount: 0,
      netAmount: 6000,
      totalAmount: 6000
    }],
    subTotal: 6000,
    totalTax: 0,
    grandTotal: 6000,
    status: 'FOLLOW_UP_PENDING',
    isActive: true,
    createdBy: salesExecUser._id
  });

  // Quotation 3: Q-022 | Customer C | Qty: 3 | Amount: ₹18,000 | Status: CLOSED | Created by Super Admin
  const q3 = await Quotation.create({
    quotationNumber: `Q-022-${Date.now().toString().slice(-4)}`,
    customer: customerC._id,
    company: company._id,
    format: format._id,
    salesperson: superAdminUser._id,
    quotationDate: new Date('2026-09-08'),
    items: [{
      product: valveProduct._id,
      productNameSnapshot: valveProduct.productName,
      skuCodeSnapshot: valveProduct.companySkuCode,
      quantity: 3,
      quotedRate: 6000,
      mrpSnapshot: 6000,
      grossAmount: 18000,
      discountPct: 0,
      discountAmount: 0,
      taxPct: 0,
      gstAmount: 0,
      netAmount: 18000,
      totalAmount: 18000
    }],
    subTotal: 18000,
    totalTax: 0,
    grandTotal: 18000,
    status: 'CLOSED',
    isActive: true,
    createdBy: superAdminUser._id
  });

  // QuotationConfirmation for Q-001 (Confirmed Qty: 2, Confirmed Amount: ₹12,000)
  const conf1 = await QuotationConfirmation.create({
    quotation: q1._id,
    customer: customerA._id,
    confirmationNumber: `CONF-Q1-${Date.now().toString().slice(-4)}`,
    confirmationStatus: 'FULLY_CONFIRMED',
    confirmedBy: superAdminUser._id,
    confirmedItems: [{
      originalQuotationItemId: q1.items[0]._id,
      product: valveProduct._id,
      productNameSnapshot: valveProduct.productName,
      skuCodeSnapshot: valveProduct.companySkuCode,
      quotedQuantity: 2,
      confirmedQuantity: 2,
      unitPriceSnapshot: 6000,
      gstPctSnapshot: 0,
      confirmedAmount: 12000
    }],
    totalConfirmedAmount: 12000,
    confirmedAmount: 12000,
    isActive: true,
    createdBy: superAdminUser._id
  });

  logPass('Documented worked example fixtures created successfully.');

  // Step 3 & 4: Live Aggregation & Summary Figures Verification
  logSection('STEP 3 & 4: Live Aggregation, Confirmed-Quantity & Summary Figures');
  const usageRes = await api(`/product-tracking/${valveProduct._id}/quotation-usage`, {
    token: superAdminToken
  });

  if (usageRes.status !== 200) logFail('Failed to fetch product quotation usage', usageRes.data);
  const usageData = usageRes.data.data;

  if (usageData.usage.length !== 3) {
    logFail(`Expected 3 quotation usage rows for super admin, got ${usageData.usage.length}`);
  }
  logPass(`Retrieved all 3 quotation usage rows matching documented worked example.`);

  // Verify Q-001 has confirmedQuantity: 2
  const row1 = usageData.usage.find((r) => r.quotationId === String(q1._id));
  if (!row1 || row1.confirmedQuantity !== 2 || row1.actualTransactionValue !== 12000) {
    logFail(`Row 1 mismatch: confirmedQuantity ${row1?.confirmedQuantity}, actualVal ${row1?.actualTransactionValue}`);
  }
  logPass('Verified Q-001 shows confirmedQuantity: 2 and actualTransactionValue: ₹12,000.');

  // Verify Q-015 has confirmedQuantity: null (Rule 4: Not yet confirmed is null, not 0)
  const row2 = usageData.usage.find((r) => r.quotationId === String(q2._id));
  if (!row2 || row2.confirmedQuantity !== null || row2.actualTransactionValue !== null) {
    logFail(`Row 2 mismatch: confirmedQuantity expected null, got ${row2?.confirmedQuantity}`);
  }
  logPass('Verified Q-015 (unconfirmed) shows confirmedQuantity: null and actualTransactionValue: null.');

  // Verify Summary Totals
  if (
    usageData.summary.totalQuotationCount !== 3 ||
    usageData.summary.totalQuotedQuantity !== 6 ||
    usageData.summary.totalQuotedValue !== 36000 ||
    usageData.summary.totalConfirmedQuantity !== 2 ||
    usageData.summary.totalConfirmedValue !== 12000
  ) {
    logFail('Summary totals mismatch with documented example', usageData.summary);
  }
  logPass('Summary totals verified: 3 quotations, 6 quoted qty, ₹36,000 quoted val, 2 confirmed qty, ₹12,000 confirmed val.');

  // Zero quotations product graceful fallback
  const zeroProduct = await Product.create({
    productName: 'Zero Quoted Tile',
    companySkuCode: `ZERO-${Date.now().toString().slice(-4)}`,
    company: company._id,
    unit: unit._id,
    mrp: 100,
    salePrice: 100,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const zeroUsageRes = await api(`/product-tracking/${zeroProduct._id}/quotation-usage`, {
    token: superAdminToken
  });
  if (zeroUsageRes.status !== 200 || zeroUsageRes.data.data.usage.length !== 0 || zeroUsageRes.data.data.summary.totalQuotationCount !== 0) {
    logFail('Zero-quoted product should return empty array and 0 summary gracefully', zeroUsageRes.data);
  }
  logPass('Verified product with zero quotations returns empty array and zeroed summary gracefully.');

  // Step 5: dataScope Aware Querying (Sales Exec with OWN scope)
  logSection('STEP 5: dataScope Aware Querying (Sales Exec with dataScope: OWN)');
  const salesUsageRes = await api(`/product-tracking/${valveProduct._id}/quotation-usage`, {
    token: salesExecToken
  });

  if (salesUsageRes.status !== 200) logFail('Sales Exec failed to query usage', salesUsageRes.data);
  const salesUsageData = salesUsageRes.data.data;

  // Sales Exec created Q-001 and Q-015, but NOT Q-022
  if (salesUsageData.usage.length !== 2) {
    logFail(`Sales Exec with OWN scope should see only 2 quotations, got ${salesUsageData.usage.length}`);
  }
  if (salesUsageData.summary.totalQuotationCount !== 2 || salesUsageData.summary.totalQuotedQuantity !== 3 || salesUsageData.summary.totalQuotedValue !== 18000) {
    logFail('Sales Exec summary figures should reflect only their OWN quotations', salesUsageData.summary);
  }
  logPass('Verified Sales Exec with dataScope: OWN sees ONLY their 2 quotations (Q-001, Q-015) and ₹18,000 total.');

  // Step 6: Module 2 Proxy Route Wiring
  logSection('STEP 6: Module 2 Proxy Route (/api/products/:id/quotation-usage)');
  const proxyRes = await api(`/products/${valveProduct._id}/quotation-usage`, {
    token: superAdminToken
  });

  if (proxyRes.status !== 200) logFail('Module 2 proxy route failed', proxyRes.data);
  if (proxyRes.data.data.usage.length !== 3 || proxyRes.data.data.summary.totalQuotedValue !== 36000) {
    logFail('Module 2 proxy route returned mismatched payload', proxyRes.data);
  }
  logPass('Module 2 proxy route `/api/products/:id/quotation-usage` successfully returns live tracking data!');

  // Step 7: Cross-Product Reports (Most Quoted & Customer List)
  logSection('STEP 7: Cross-Product Reports (Most Quoted & Customer List)');
  const mostQuotedRes = await api('/product-tracking/most-quoted?limit=5', {
    token: superAdminToken
  });

  if (mostQuotedRes.status !== 200 || !Array.isArray(mostQuotedRes.data.data)) {
    logFail('Failed to get most quoted products', mostQuotedRes.data);
  }
  const topProduct = mostQuotedRes.data.data.find((p) => String(p.productId) === String(valveProduct._id));
  if (!topProduct || topProduct.quotationCount !== 3) {
    logFail('Most quoted ranking failed to include target product with 3 quotations', topProduct);
  }
  logPass(`Verified /most-quoted correctly ranked product with ${topProduct.quotationCount} quotations (₹${topProduct.totalQuotedValue}).`);

  const custListRes = await api(`/product-tracking/${valveProduct._id}/customer-list`, {
    token: superAdminToken
  });
  if (custListRes.status !== 200 || custListRes.data.data.length !== 3) {
    logFail(`Expected 3 distinct customers, got ${custListRes.data.data?.length}`);
  }
  logPass(`Verified /customer-list returned ${custListRes.data.data.length} distinct customers (Customer A, B, C).`);

  // Step 8: Optional Summary Cache + Recompute Utility
  logSection('STEP 8: Optional Summary Cache & Recompute Utility');
  const recomputeRes = await api(`/product-tracking/${valveProduct._id}/recompute-summary`, {
    method: 'POST',
    token: superAdminToken,
    body: {}
  });

  if (recomputeRes.status !== 200) logFail('Recompute summary failed', recomputeRes.data);
  const cacheDoc = await ProductQuotationSummaryCache.findOne({ product: valveProduct._id });
  if (!cacheDoc || cacheDoc.totalQuotationCount !== 3 || cacheDoc.totalQuotedValue !== 36000) {
    logFail('ProductQuotationSummaryCache mismatch after recompute', cacheDoc);
  }
  logPass('ProductQuotationSummaryCache successfully recomputed and verified in database.');

  // Step 9: Cancelled Quotation Inclusion Behavior
  logSection('STEP 9: Cancelled Quotation Inclusion & ?activeOnly Filter');
  const qCancelled = await Quotation.create({
    quotationNumber: `Q-CAN-${Date.now().toString().slice(-4)}`,
    customer: customerA._id,
    company: company._id,
    format: format._id,
    salesperson: superAdminUser._id,
    quotationDate: new Date(),
    items: [{
      product: valveProduct._id,
      productNameSnapshot: valveProduct.productName,
      skuCodeSnapshot: valveProduct.companySkuCode,
      quantity: 5,
      quotedRate: 6000,
      mrpSnapshot: 6000,
      grossAmount: 30000,
      discountPct: 0,
      discountAmount: 0,
      taxPct: 0,
      gstAmount: 0,
      netAmount: 30000,
      totalAmount: 30000
    }],
    subTotal: 30000,
    totalTax: 0,
    grandTotal: 30000,
    status: 'REJECTED',
    isActive: false,
    createdBy: superAdminUser._id
  });

  // Default query should include cancelled quotations (Rule 6)
  const defaultUsageRes = await api(`/product-tracking/${valveProduct._id}/quotation-usage`, {
    token: superAdminToken
  });
  if (defaultUsageRes.data.data.usage.length !== 4) {
    logFail(`Default usage query should include cancelled quotation (expected 4 rows, got ${defaultUsageRes.data.data.usage.length})`);
  }
  logPass('Default query correctly includes cancelled quotation (showing 4 historical quotations).');

  // ?activeOnly=true should exclude cancelled quotations
  const activeOnlyUsageRes = await api(`/product-tracking/${valveProduct._id}/quotation-usage?activeOnly=true`, {
    token: superAdminToken
  });
  if (activeOnlyUsageRes.data.data.usage.length !== 3) {
    logFail(`?activeOnly=true query should exclude cancelled quotation (expected 3 rows, got ${activeOnlyUsageRes.data.data.usage.length})`);
  }
  logPass('?activeOnly=true query correctly excludes cancelled quotation (showing 3 active quotations).');

  // Step 10: Permissions Gate Check
  logSection('STEP 10: Granular Permissions Gate Check');
  // Warehouse user has PRODUCT_MASTER: view, but NO PRODUCT_QUOTATION_TRACKING: view
  const blockedProxyRes = await api(`/products/${valveProduct._id}/quotation-usage`, {
    token: warehouseToken
  });
  if (blockedProxyRes.status !== 403) {
    logFail(`Warehouse staff without PRODUCT_QUOTATION_TRACKING:view should be blocked with 403, got ${blockedProxyRes.status}`);
  }
  logPass('Warehouse staff without PRODUCT_QUOTATION_TRACKING permission is blocked (403) from quotation-usage section.');

  // Warehouse user accessing direct product-tracking route should also be blocked
  const blockedDirectRes = await api(`/product-tracking/${valveProduct._id}/quotation-usage`, {
    token: warehouseToken
  });
  if (blockedDirectRes.status !== 403) {
    logFail(`Direct product-tracking route should block warehouse user with 403, got ${blockedDirectRes.status}`);
  }
  logPass('Direct `/api/product-tracking/:productId/quotation-usage` correctly blocked warehouse user (403).');

  // Step 11: Export to Excel (.xlsx)
  logSection('STEP 11: Export to Excel (.xlsx)');
  const exportRes = await api(`/product-tracking/export?productId=${valveProduct._id}&reportType=usage`, {
    token: superAdminToken
  });
  if (exportRes.status !== 200 || !exportRes.data || exportRes.data.byteLength === 0) {
    logFail('Failed to download Excel usage spreadsheet');
  }
  logPass(`Successfully downloaded Excel usage workbook (${exportRes.data.byteLength} bytes).`);

  const exportRankingRes = await api('/product-tracking/export?reportType=most-quoted', {
    token: superAdminToken
  });
  if (exportRankingRes.status !== 200 || !exportRankingRes.data || exportRankingRes.data.byteLength === 0) {
    logFail('Failed to download Excel most-quoted spreadsheet');
  }
  logPass(`Successfully downloaded Excel most-quoted workbook (${exportRankingRes.data.byteLength} bytes).`);

  console.log(`\n${colors.green}${colors.bold}====================================================`);
  console.log(`🎉 ALL MODULE 14 (PRODUCT-QUOTATION TRACKING) TESTS PASSED! (${passed} Passed, ${failed} Failed)`);
  console.log(`====================================================${colors.reset}\n`);

  server.close(() => process.exit(0));
}

runTests().catch((err) => {
  console.error(`\n${colors.red}❌ MODULE 14 TEST RUNNER FAILED:${colors.reset}`, err);
  if (server) server.close();
  process.exit(1);
});
