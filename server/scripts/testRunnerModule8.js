const http = require('http');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const app = require('../server');
const SystemModule = require('../models/SystemModule');
const User = require('../models/User');
const Role = require('../models/Role');
const UserPermission = require('../models/UserPermission');
const Company = require('../models/Company');
const ProductGroup = require('../models/ProductGroup');
const UnitMaster = require('../models/UnitMaster');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const StockEntryNumberSequence = require('../models/StockEntryNumberSequence');
const stockService = require('../services/stock.service');

let server;
let baseUrl;
let superAdminToken;
let staffUserToken;
let staffUserId;
let viewOnlyToken;
let viewOnlyUserId;
let testCompany;
let testUnit;
let testProductGroup;
let testProduct;
let testCustomer;
let testQuotation;
let testConfirmation;
let testFormat;
let superAdminUser;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
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

async function setup() {
  console.log(`\n${colors.cyan}${colors.bold}=== SETUP & DATABASE CONNECTION ===${colors.reset}`);
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`  Test server listening on: ${baseUrl}`);
      resolve();
    });
  });

  // Ensure STOCK SystemModule exists
  let stockModule = await SystemModule.findOne({ moduleKey: 'STOCK' });
  if (!stockModule) {
    stockModule = await SystemModule.create({
      moduleKey: 'STOCK',
      moduleName: 'Stock Management',
      parentModule: 'INVENTORY',
      isActive: true
    });
  }

  // Super Admin login
  const adminLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825702369', password: 'Laksh@2508' }
  });

  if (adminLoginRes.status !== 200 || !adminLoginRes.body?.data?.accessToken) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
  }
  superAdminToken = adminLoginRes.body.data.accessToken;
  superAdminUser = adminLoginRes.body.data.user;

  // Create Staff User (create + delete + view, but NO approve, NO export)
  let staffRole = await Role.findOne({ roleName: 'Inventory Staff' });
  if (!staffRole) {
    staffRole = await Role.create({ roleName: 'Inventory Staff', isSystemRole: false });
  }

  const pwHash = await User.hashPassword('Password@123');
  await User.deleteOne({ mobile: '9898980008' });
  const staff = await User.create({
    name: 'Stock Clerk',
    mobile: '9898980008',
    email: 'clerk@maitriceramic.com',
    passwordHash: pwHash,
    role: staffRole._id,
    isActive: true
  });
  staffUserId = staff._id;

  await UserPermission.findOneAndUpdate(
    { user: staff._id, module: stockModule._id },
    {
      $set: {
        actions: { view: true, create: true, edit: false, delete: true, export: false, approve: false },
        dataScope: 'ALL',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  const staffLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9898980008', password: 'Password@123' }
  });
  staffUserToken = staffLoginRes.body.data.accessToken;

  // Create View-Only User (view ONLY)
  await User.deleteOne({ mobile: '9898980009' });
  const viewUser = await User.create({
    name: 'Auditor Viewer',
    mobile: '9898980009',
    email: 'auditor@maitriceramic.com',
    passwordHash: pwHash,
    role: staffRole._id,
    isActive: true
  });
  viewOnlyUserId = viewUser._id;

  await UserPermission.findOneAndUpdate(
    { user: viewUser._id, module: stockModule._id },
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

  const viewLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9898980009', password: 'Password@123' }
  });
  viewOnlyToken = viewLoginRes.body.data.accessToken;

  // Setup Masters
  testCompany = await Company.findOneAndUpdate(
    { companyName: 'Maitri Stock Tiles' },
    {
      companyName: 'Maitri Stock Tiles',
      companyType: 'BRAND_MANUFACTURER',
      isActive: true,
      createdBy: superAdminUser._id
    },
    { upsert: true, new: true }
  );

  testUnit = await UnitMaster.findOneAndUpdate(
    { unitCode: 'BOX' },
    { unitName: 'Box', unitCode: 'BOX', isActive: true, createdBy: superAdminUser._id },
    { upsert: true, new: true }
  );

  testProductGroup = await ProductGroup.findOneAndUpdate(
    { groupName: 'GVT Tiles' },
    { groupName: 'GVT Tiles', isActive: true, createdBy: superAdminUser._id },
    { upsert: true, new: true }
  );

  testFormat = await QuotationFormatMaster.findOneAndUpdate(
    { formatKey: 'FORMAT_1' },
    { formatKey: 'FORMAT_1', formatName: 'Standard Format 1', isActive: true },
    { upsert: true, new: true }
  );

  testProduct = await Product.create({
    productName: 'Maitri Onyx Marble 600x1200',
    companySkuCode: 'MOM-6012-01',
    company: testCompany._id,
    unit: testUnit._id,
    productGroup: testProductGroup._id,
    mrp: 1450,
    currentStock: 0,
    reorderAlertQty: 10,
    isActive: true,
    createdBy: superAdminUser._id
  });

  console.log(`  Test setup ready. Product created: ${testProduct.productName} (${testProduct._id})`);
}

async function runTests() {
  console.log(`\n${colors.cyan}${colors.bold}=== STEP 1: SYSTEM MODULE REGISTRATION ===${colors.reset}`);
  const stockMod = await SystemModule.findOne({ moduleKey: 'STOCK' });
  if (stockMod && stockMod.isActive) {
    logPass("SystemModule 'STOCK' registered and active in database");
  } else {
    logFail("SystemModule 'STOCK' not found");
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 2 & 3: AUTO-NUMBERING SEQUENCE GENERATOR ===${colors.reset}`);
  const num1 = await StockEntryNumberSequence.generateNextNumber();
  const num2 = await StockEntryNumberSequence.generateNextNumber();
  if (num1.startsWith('SE-') && num2.startsWith('SE-') && num1 !== num2) {
    logPass(`Atomic sequential number generation verified: ${num1} -> ${num2}`);
  } else {
    logFail(`Atomic sequential number generation failed: ${num1}, ${num2}`);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 4: MANUAL STOCK-IN & ATOMIC PRODUCT CACHE UPDATE ===${colors.reset}`);
  // 1. Opening Stock = 100
  const stockInRes1 = await api('/stock/entries/in', {
    method: 'POST',
    token: superAdminToken,
    body: {
      productId: testProduct._id,
      quantity: 100,
      reason: 'OPENING_STOCK',
      remarks: 'Warehouse stock count verification'
    }
  });

  if (stockInRes1.status === 201 && stockInRes1.body.data.balanceAfter === 100) {
    logPass('POST /api/stock/entries/in (Opening Stock: 100) -> balanceAfter: 100');
  } else {
    logFail('Opening stock in failed', stockInRes1.body);
  }

  const pAfterIn1 = await Product.findById(testProduct._id);
  if (pAfterIn1.currentStock === 100) {
    logPass(`Product.currentStock cache atomically updated to 100`);
  } else {
    logFail(`Product.currentStock cache is ${pAfterIn1.currentStock}, expected 100`);
  }

  // 2. Purchase Entry = 50
  const stockInRes2 = await api('/stock/entries/in', {
    method: 'POST',
    token: superAdminToken,
    body: {
      productId: testProduct._id,
      quantity: 50,
      reason: 'PURCHASE_ENTRY',
      referenceDocNote: 'PO-2026-991 / Vendor Invoice 4401'
    }
  });

  if (stockInRes2.status === 201 && stockInRes2.body.data.balanceAfter === 150) {
    logPass('POST /api/stock/entries/in (Purchase Entry: 50) -> balanceAfter: 150');
  } else {
    logFail('Purchase entry in failed', stockInRes2.body);
  }

  const pAfterIn2 = await Product.findById(testProduct._id);
  if (pAfterIn2.currentStock === 150) {
    logPass(`Product.currentStock cache atomically updated to 150`);
  } else {
    logFail(`Product.currentStock cache is ${pAfterIn2.currentStock}, expected 150`);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 5: STOCK SUMMARY & 3-FIGURE STOCK CALCULATION ===${colors.reset}`);
  // Initial summary before quotations (Actual=150, Management=0, Available=150)
  const sumRes1 = await api(`/stock/${testProduct._id}/summary`, { token: superAdminToken });
  if (
    sumRes1.status === 200 &&
    sumRes1.body.data.actualStock === 150 &&
    sumRes1.body.data.managementStock === 0 &&
    sumRes1.body.data.availableStock === 150
  ) {
    logPass('Initial Summary: Actual=150, Management=0, Available=150 verified');
  } else {
    logFail('Initial summary calculation failed', sumRes1.body);
  }

  // Simulate Module 7 Quotation Confirmation (Commitment: 50 units, 0 delivered -> Management Stock = 50)
  testCustomer = await Customer.create({
    customerName: 'Shreeji Builders',
    mobile: '9876543210',
    customerType: 'RETAIL',
    createdBy: superAdminUser._id
  });

  testQuotation = await Quotation.create({
    quotationNumber: 'QT-STK-TST01',
    customer: testCustomer._id,
    salesperson: superAdminUser._id,
    company: testCompany._id,
    format: testFormat._id,
    quotationType: 'FORMAT_1',
    status: 'CONFIRMED',
    items: [{
      product: testProduct._id,
      productNameSnapshot: testProduct.productName,
      mrpSnapshot: 1400,
      quantity: 50,
      discountPct: 0,
      discountAmount: 0,
      taxableAmount: 70000,
      gstPctSnapshot: 0,
      gstAmount: 0,
      grossAmount: 70000,
      netAmount: 70000
    }],
    subTotal: 70000,
    totalTaxableAmount: 70000,
    totalGstAmount: 0,
    grandTotal: 70000,
    createdBy: superAdminUser._id
  });

  testConfirmation = await QuotationConfirmation.create({
    quotation: testQuotation._id,
    customer: testCustomer._id,
    confirmationNumber: 'QC-STK-TST01',
    confirmationStatus: 'FULLY_CONFIRMED',
    confirmedItems: [{
      originalQuotationItemId: testQuotation.items[0]._id,
      product: testProduct._id,
      productNameSnapshot: testProduct.productName,
      unitPriceSnapshot: 1400,
      quotedQuantity: 50,
      confirmedQuantity: 50,
      confirmedAmount: 70000,
      extraQuantity: 0,
      deliveredQuantity: 0,
      pendingQuantity: 50,
      rate: 1400,
      taxableAmount: 70000,
      totalAmount: 82600,
      deliveryStatus: 'PENDING'
    }],
    originalQuotationAmount: 70000,
    confirmedAmount: 70000,
    totalActualAmount: 70000,
    differenceAmount: 0,
    overallDeliveryStatus: 'PENDING',
    isFullyDelivered: false,
    pendingApproval: false,
    approvedAt: new Date(),
    confirmedBy: superAdminUser._id,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const sumRes2 = await api(`/stock/${testProduct._id}/summary`, { token: superAdminToken });
  if (
    sumRes2.status === 200 &&
    sumRes2.body.data.actualStock === 150 &&
    sumRes2.body.data.managementStock === 50 &&
    sumRes2.body.data.availableStock === 100
  ) {
    logPass('Live Management Stock computation: Actual=150, Management=50, Available=100 (150 - 50)');
  } else {
    logFail('Management Stock computation failed', sumRes2.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 6: FORWARD-REFERENCE SERVICES (Module 9 & 12) ===${colors.reset}`);
  // Simulate Module 9 Challan deduction (deduct 30 units)
  const mockChallanId = new mongoose.Types.ObjectId();
  const deductEntry = await stockService.deductStock(
    testProduct._id,
    30,
    'CHALLAN_ISSUE',
    'CHALLAN',
    mockChallanId,
    { referenceDocNote: 'CH-2026-0044', postedBy: superAdminUser._id }
  );

  if (deductEntry && deductEntry.balanceAfter === 120 && deductEntry.direction === 'OUT') {
    logPass('stockService.deductStock(CHALLAN_ISSUE, 30) -> balanceAfter: 120');
  } else {
    logFail('deductStock failed', deductEntry);
  }

  // Update QuotationConfirmation delivery state (delivered 30, pending 20)
  testConfirmation.confirmedItems[0].deliveredQuantity = 30;
  testConfirmation.confirmedItems[0].pendingQuantity = 20;
  await testConfirmation.save();

  const sumRes3 = await api(`/stock/${testProduct._id}/summary`, { token: superAdminToken });
  if (
    sumRes3.status === 200 &&
    sumRes3.body.data.actualStock === 120 &&
    sumRes3.body.data.managementStock === 20 &&
    sumRes3.body.data.availableStock === 100
  ) {
    logPass('Summary after Challan Delivery: Actual=120, Management=20, Available=100 (120 - 20)');
  } else {
    logFail('Summary after delivery failed', sumRes3.body);
  }

  // Validate reference document requirement on automated reasons
  let automatedValidationFailed = false;
  try {
    await stockService.deductStock(testProduct._id, 10, 'CHALLAN_ISSUE', null, null);
  } catch (err) {
    automatedValidationFailed = true;
  }
  if (automatedValidationFailed) {
    logPass('Automated stock deduction rejected when referenceDocType/Id is missing');
  } else {
    logFail('Missing referenceDoc check failed');
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 7: NEGATIVE BALANCE PROTECTION & OVERRIDE ===${colors.reset}`);
  // Over deduction without allowNegative must be rejected
  const overDeductRes = await api('/stock/entries/out', {
    method: 'POST',
    token: superAdminToken,
    body: {
      productId: testProduct._id,
      quantity: 500,
      reason: 'OTHER',
      remarks: 'Attempting excessive deduction'
    }
  });

  if (overDeductRes.status === 400 && overDeductRes.body.message.includes('negative stock')) {
    logPass('Negative stock deduction rejected with HTTP 400');
  } else {
    logFail('Negative stock deduction was not rejected', overDeductRes.body);
  }

  // Emergency override with allowNegative: true
  const overrideRes = await api('/stock/entries/out', {
    method: 'POST',
    token: superAdminToken,
    body: {
      productId: testProduct._id,
      quantity: 130, // 120 - 130 = -10
      reason: 'OTHER',
      allowNegative: true,
      remarks: 'Emergency authorized stock deduction'
    }
  });

  if (overrideRes.status === 201 && overrideRes.body.data.balanceAfter === -10) {
    logPass('Emergency deduction with allowNegative:true succeeds with balanceAfter: -10');
  } else {
    logFail('allowNegative override failed', overrideRes.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 8: GRANULAR PERMISSIONS & CONDITIONAL APPROVAL GATE ===${colors.reset}`);
  // Staff user has delete permission, but NOT approve -> MANUAL_DEDUCTION should be blocked
  const staffManualDeductRes = await api('/stock/entries/out', {
    method: 'POST',
    token: staffUserToken,
    body: {
      productId: testProduct._id,
      quantity: 5,
      reason: 'MANUAL_DEDUCTION',
      remarks: 'Attempting manual deduction without approve permission'
    }
  });

  if (staffManualDeductRes.status === 403) {
    logPass('MANUAL_DEDUCTION blocked with HTTP 403 for user lacking STOCK:approve permission');
  } else {
    logFail('MANUAL_DEDUCTION approval gate failed', staffManualDeductRes.body);
  }

  // Staff user posting OTHER reason succeeds (needs only delete permission)
  const staffOtherDeductRes = await api('/stock/entries/out', {
    method: 'POST',
    token: staffUserToken,
    body: {
      productId: testProduct._id,
      quantity: 5,
      reason: 'OTHER',
      allowNegative: true,
      remarks: 'Standard deduction'
    }
  });

  if (staffOtherDeductRes.status === 201) {
    logPass('Stock Out with reason OTHER succeeds for user with STOCK:delete permission');
  } else {
    logFail('Stock Out with OTHER reason failed', staffOtherDeductRes.body);
  }

  // View-Only user blocked from creating or deducting stock
  const viewInRes = await api('/stock/entries/in', {
    method: 'POST',
    token: viewOnlyToken,
    body: { productId: testProduct._id, quantity: 10, reason: 'OPENING_STOCK' }
  });

  const viewOutRes = await api('/stock/entries/out', {
    method: 'POST',
    token: viewOnlyToken,
    body: { productId: testProduct._id, quantity: 10, reason: 'OTHER' }
  });

  if (viewInRes.status === 403 && viewOutRes.status === 403) {
    logPass('View-only user strictly blocked from both Stock In and Stock Out (HTTP 403)');
  } else {
    logFail('View-only user permission boundary failed', { viewInRes, viewOutRes });
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 9: MOVEMENT HISTORY (LEDGER) & REPORTS ===${colors.reset}`);
  // Movement History
  const historyRes = await api(`/stock/${testProduct._id}/movement-history`, { token: superAdminToken });
  if (
    historyRes.status === 200 &&
    historyRes.body.data.totalMovements >= 4 &&
    Array.isArray(historyRes.body.data.movementHistory)
  ) {
    logPass(`GET /api/stock/:productId/movement-history returns ${historyRes.body.data.totalMovements} immutable ledger movements`);
  } else {
    logFail('Movement history retrieval failed', historyRes.body);
  }

  // Low Stock Report
  const lowStockRes = await api('/stock/low-stock-report', { token: superAdminToken });
  const foundInLowStock = (lowStockRes.body.data?.products || []).some(
    (p) => String(p._id) === String(testProduct._id)
  );
  if (lowStockRes.status === 200 && foundInLowStock) {
    logPass('GET /api/stock/low-stock-report correctly includes product with currentStock <= reorderAlertQty');
  } else {
    logFail('Low stock report check failed', lowStockRes.body);
  }

  // Purchase Alerts
  const purchaseAlertsRes = await api('/stock/purchase-alerts', { token: superAdminToken });
  const foundInAlerts = (purchaseAlertsRes.body.data?.alerts || []).some(
    (a) => String(a.productId) === String(testProduct._id) && a.shortfallQuantity > 0
  );
  if (purchaseAlertsRes.status === 200 && foundInAlerts) {
    logPass('GET /api/stock/purchase-alerts correctly identifies Available Stock shortfall and suggested purchase quantity');
  } else {
    logFail('Purchase alerts calculation failed', purchaseAlertsRes.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 10: RECONCILIATION UTILITY & DRIFT FIX ===${colors.reset}`);
  // Deliberately corrupt Product.currentStock cache to 8888
  await Product.updateOne({ _id: testProduct._id }, { $set: { currentStock: 8888 } });

  const reconcileRes = await api(`/stock/${testProduct._id}/reconcile`, {
    method: 'POST',
    token: superAdminToken
  });

  const fixedProduct = await Product.findById(testProduct._id);
  if (
    reconcileRes.status === 200 &&
    reconcileRes.body.data.driftIdentified !== 0 &&
    fixedProduct.currentStock === reconcileRes.body.data.reconciledStock
  ) {
    logPass(`POST /api/stock/:productId/reconcile identified drift (${reconcileRes.body.data.driftIdentified}) and fixed cache to ${fixedProduct.currentStock}`);
  } else {
    logFail('Stock reconciliation failed', reconcileRes.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 11: EXCEL EXPORT ===${colors.reset}`);
  const exportRes = await api('/stock/export?reportType=movement', { token: superAdminToken });
  if (exportRes.status === 200 && exportRes.headers.get('content-type').includes('spreadsheetml')) {
    logPass('GET /api/stock/export (movement) generates valid .xlsx binary workbook');
  } else {
    logFail('Excel export failed', exportRes);
  }
}

async function teardown() {
  console.log(`\n${colors.cyan}${colors.bold}=== CLEANUP TEST DATA ===${colors.reset}`);
  if (testProduct) {
    await StockLedgerEntry.deleteMany({ product: testProduct._id });
    await Product.deleteOne({ _id: testProduct._id });
  }
  if (testConfirmation) await QuotationConfirmation.deleteOne({ _id: testConfirmation._id });
  if (testQuotation) await Quotation.deleteOne({ _id: testQuotation._id });
  if (testCustomer) await Customer.deleteOne({ _id: testCustomer._id });
  if (staffUserId) await User.deleteOne({ _id: staffUserId });
  if (viewOnlyUserId) await User.deleteOne({ _id: viewOnlyUserId });

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('  Cleanup completed.');
}

async function main() {
  try {
    await setup();
    await runTests();
  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    await teardown();
    console.log(`\n${colors.bold}================================================================${colors.reset}`);
    console.log(`${colors.bold}📊 MODULE 8 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED${colors.reset}`);
    console.log(`${colors.bold}================================================================\n${colors.reset}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
