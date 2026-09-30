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
const Challan = require('../models/Challan');
const ChallanNumberSequence = require('../models/ChallanNumberSequence');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const challanService = require('../services/challan.service');
const stockService = require('../services/stock.service');
const customerHistoryService = require('../services/customerHistory.service');

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;
let salesUserToken;
let salesUserId;
let viewOnlyToken;
let viewOnlyUserId;

let testCompany;
let testUnit;
let testProductGroup;
let testFormat;
let testProduct;
let testCustomer;
let testQuotation;
let testConfirmation;

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

  // 1. Ensure CHALLAN and STOCK SystemModules exist
  for (const key of ['CHALLAN', 'STOCK', 'QUOTATION_CONFIRMATION', 'QUOTATION', 'CUSTOMER']) {
    let mod = await SystemModule.findOne({ moduleKey: key });
    if (!mod) {
      await SystemModule.create({
        moduleKey: key,
        moduleName: `${key} Management`,
        parentModule: 'INVENTORY',
        isActive: true
      });
    }
  }

  // 2. Super Admin Login
  const adminLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825702369', password: 'Laksh@2508' }
  });

  if (adminLoginRes.status !== 200 || !adminLoginRes.body?.data?.accessToken) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginRes.body)}`);
  }
  superAdminToken = adminLoginRes.body.data.accessToken;
  superAdminUser = adminLoginRes.body.data.user;

  // 3. Create Sales User (create, edit, view, but NO approve)
  let salesRole = await Role.findOne({ roleName: 'Sales Executive' });
  if (!salesRole) {
    salesRole = await Role.create({ roleName: 'Sales Executive', isSystemRole: false });
  }

  const pwHash = await User.hashPassword('Password@123');
  await User.deleteOne({ mobile: '9870009901' });
  const salesUser = await User.create({
    name: 'Sales Rep Jayesh',
    mobile: '9870009901',
    email: 'jayesh@maitriceramic.com',
    passwordHash: pwHash,
    role: salesRole._id,
    isActive: true
  });
  salesUserId = salesUser._id;

  const challanMod = await SystemModule.findOne({ moduleKey: 'CHALLAN' });

  await UserPermission.findOneAndUpdate(
    { user: salesUser._id, module: challanMod._id },
    {
      $set: {
        actions: { view: true, create: true, edit: true, delete: true, export: false, approve: false },
        dataScope: 'OWN',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  const salesLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9870009901', password: 'Password@123' }
  });
  salesUserToken = salesLoginRes.body.data.accessToken;

  // 4. Create View-Only User
  await User.deleteOne({ mobile: '9870009902' });
  const viewUser = await User.create({
    name: 'Auditor ViewOnly',
    mobile: '9870009902',
    email: 'auditor.view@maitriceramic.com',
    passwordHash: pwHash,
    role: salesRole._id,
    isActive: true
  });
  viewOnlyUserId = viewUser._id;

  await UserPermission.findOneAndUpdate(
    { user: viewUser._id, module: challanMod._id },
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
    body: { mobile: '9870009902', password: 'Password@123' }
  });
  viewOnlyToken = viewLoginRes.body.data.accessToken;

  // 5. Setup Master Data
  testCompany = await Company.findOneAndUpdate(
    { companyName: 'Maitri Challan Brand' },
    {
      companyName: 'Maitri Challan Brand',
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
    { groupName: 'PGVT Glazed Vitrified' },
    { groupName: 'PGVT Glazed Vitrified', isActive: true, createdBy: superAdminUser._id },
    { upsert: true, new: true }
  );

  testFormat = await QuotationFormatMaster.findOneAndUpdate(
    { formatKey: 'FORMAT_1' },
    { formatKey: 'FORMAT_1', formatName: 'Standard Format 1', isActive: true },
    { upsert: true, new: true }
  );

  // Initial Product Stock = 0, then stockIn of 120 (per documented worked example)
  testProduct = await Product.create({
    productName: 'Maitri Carrara White 600x1200',
    companySkuCode: 'MCW-6012',
    company: testCompany._id,
    unit: testUnit._id,
    productGroup: testProductGroup._id,
    mrp: 1500,
    currentStock: 0,
    reorderAlertQty: 10,
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Create Opening Stock Ledger Entry in Module 8
  await stockService.stockIn(
    {
      productId: testProduct._id,
      quantity: 120,
      reason: 'OPENING_STOCK',
      remarks: 'Initial stock setup for Challan testing'
    },
    superAdminUser
  );

  // Create Customer
  testCustomer = await Customer.create({
    customerName: 'Dharmanandan Villa Project',
    mobile: '9825112233',
    billingAddress: '402, Royal Heights, Surat',
    shippingAddress: 'Plot 12, Dharmanandan Villa, Vesu, Surat',
    city: 'Surat',
    state: 'Gujarat',
    customerType: 'CONTRACTOR',
    createdBy: superAdminUser._id
  });

  // Create Quotation
  testQuotation = await Quotation.create({
    quotationNumber: 'QT-CH-001',
    customer: testCustomer._id,
    salesperson: superAdminUser._id,
    company: testCompany._id,
    format: testFormat._id,
    quotationType: 'FORMAT_1',
    status: 'CONFIRMED',
    items: [{
      product: testProduct._id,
      productNameSnapshot: testProduct.productName,
      skuCodeSnapshot: testProduct.companySkuCode,
      mrpSnapshot: 1500,
      quantity: 50,
      discountPct: 0,
      discountAmount: 0,
      taxableAmount: 75000,
      gstPctSnapshot: 0,
      gstAmount: 0,
      grossAmount: 75000,
      netAmount: 75000
    }],
    subTotal: 75000,
    totalTaxableAmount: 75000,
    totalGstAmount: 0,
    grandTotal: 75000,
    createdBy: superAdminUser._id
  });

  // Create QuotationConfirmation (50 confirmed, 0 delivered, pending 50)
  testConfirmation = await QuotationConfirmation.create({
    quotation: testQuotation._id,
    customer: testCustomer._id,
    confirmationNumber: 'QC-CH-001',
    confirmationStatus: 'FULLY_CONFIRMED',
    confirmedItems: [{
      originalQuotationItemId: testQuotation.items[0]._id,
      product: testProduct._id,
      productNameSnapshot: testProduct.productName,
      skuCodeSnapshot: testProduct.companySkuCode,
      unitPriceSnapshot: 1500,
      quotedQuantity: 50,
      confirmedQuantity: 50,
      confirmedAmount: 75000,
      extraQuantity: 0,
      deliveredQuantity: 0,
      pendingQuantity: 50,
      rate: 1500,
      taxableAmount: 75000,
      totalAmount: 75000,
      deliveryStatus: 'PENDING'
    }],
    originalQuotationAmount: 75000,
    confirmedAmount: 75000,
    totalActualAmount: 75000,
    differenceAmount: 0,
    overallDeliveryStatus: 'PENDING',
    isFullyDelivered: false,
    pendingApproval: false,
    approvedAt: new Date(),
    confirmedBy: superAdminUser._id,
    isActive: true,
    createdBy: superAdminUser._id
  });

  console.log(`  Test setup complete. Confirmation: ${testConfirmation.confirmationNumber}`);
}

async function runTests() {
  console.log(`\n${colors.cyan}${colors.bold}=== STEP 1: SYSTEM MODULE REGISTRATION ===${colors.reset}`);
  const challanMod = await SystemModule.findOne({ moduleKey: 'CHALLAN' });
  if (challanMod && challanMod.isActive) {
    logPass("SystemModule 'CHALLAN' registered and active in database");
  } else {
    logFail("SystemModule 'CHALLAN' not found");
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 2: AUTO-NUMBERING SEQUENCE GENERATOR ===${colors.reset}`);
  const num1 = await ChallanNumberSequence.generateNextNumber();
  const num2 = await ChallanNumberSequence.generateNextNumber();
  if (num1.startsWith('CH-') && num2.startsWith('CH-') && num1 !== num2) {
    logPass(`Atomic sequential number generation verified: ${num1} -> ${num2}`);
  } else {
    logFail(`Atomic sequential number generation failed: ${num1}, ${num2}`);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 3: DRAFT CHALLAN CREATION & VALIDATION ===${colors.reset}`);
  const confirmedItem = testConfirmation.confirmedItems[0];

  // 1. Validation: Reject quantity exceeding pendingDelivery (requested 60, pending 50)
  const overflowRes = await api('/challans', {
    method: 'POST',
    token: superAdminToken,
    body: {
      confirmationId: testConfirmation._id,
      items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 60 }]
    }
  });

  if (overflowRes.status === 400 && overflowRes.body.message.includes('exceeds remaining pending delivery')) {
    logPass('Challan creation rejects quantity exceeding pending delivery (HTTP 400)');
  } else {
    logFail('Overflow pending delivery check failed', overflowRes.body);
  }

  // 2. Validation: Reject confirmedItemId belonging to another confirmation
  const fakeItemId = new mongoose.Types.ObjectId();
  const invalidItemRes = await api('/challans', {
    method: 'POST',
    token: superAdminToken,
    body: {
      confirmationId: testConfirmation._id,
      items: [{ confirmedItemId: fakeItemId, quantityToIssue: 10 }]
    }
  });

  if (invalidItemRes.status === 400) {
    logPass('Challan creation rejects foreign / unconfirmed confirmedItemId (HTTP 400)');
  } else {
    logFail('Foreign confirmedItemId check failed', invalidItemRes.body);
  }

  // 3. Create Valid DRAFT Challan requesting 30 units
  const createRes = await api('/challans', {
    method: 'POST',
    token: superAdminToken,
    body: {
      confirmationId: testConfirmation._id,
      deliveryDetails: 'Tata Ace (GJ-05-BX-4321) Driver: Naresh Bhai',
      remarks: 'First phase delivery for ground floor living room',
      items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 30 }]
    }
  });

  let draftChallanId;
  if (createRes.status === 201 && createRes.body.data.status === 'DRAFT') {
    draftChallanId = createRes.body.data._id;
    logPass(`POST /api/challans creates Challan in DRAFT status: ${createRes.body.data.challanNumber}`);
  } else {
    logFail('Draft Challan creation failed', createRes.body);
  }

  // 4. Verify DRAFT Challan has ZERO effect on physical stock or confirmation delivered quantity
  const productCheck1 = await Product.findById(testProduct._id);
  const confirmationCheck1 = await QuotationConfirmation.findById(testConfirmation._id);
  if (
    productCheck1.currentStock === 120 &&
    confirmationCheck1.confirmedItems[0].deliveredQuantity === 0
  ) {
    logPass('DRAFT Challan has ZERO effect on physical stock (120) and deliveredQuantity (0)');
  } else {
    logFail('DRAFT Challan prematurely altered stock or delivery', { productCheck1, confirmationCheck1 });
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 4: DRAFT CHALLAN EDIT & CANCEL OPERATIONS ===${colors.reset}`);
  // 1. Edit DRAFT Challan items (modify quantityToIssue from 30 -> 25)
  const editRes = await api(`/challans/${draftChallanId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: {
      deliveryDetails: 'Mahindra Bolero (GJ-05-ZZ-9999)',
      items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 25 }]
    }
  });

  if (editRes.status === 200 && editRes.body.data.items[0].quantityToIssue === 25) {
    logPass('PUT /api/challans/:id modifies DRAFT Challan quantity to 25 successfully');
  } else {
    logFail('DRAFT Challan edit failed', editRes.body);
  }

  // 2. Create another draft and test cancellation
  const cancelTestRes = await api('/challans', {
    method: 'POST',
    token: superAdminToken,
    body: {
      confirmationId: testConfirmation._id,
      items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 5 }]
    }
  });
  const cancelChallanId = cancelTestRes.body.data._id;

  const cancelRes = await api(`/challans/${cancelChallanId}/cancel`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (cancelRes.status === 200 && cancelRes.body.data.status === 'CANCELLED') {
    logPass('PUT /api/challans/:id/cancel successfully cancels DRAFT Challan');
  } else {
    logFail('DRAFT Challan cancel failed', cancelRes.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 5: FINALIZATION: THE ATOMIC DUAL-WRITE ===${colors.reset}`);
  // Finalize the 25-unit Challan
  const finalizeRes = await api(`/challans/${draftChallanId}/finalize`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (finalizeRes.status === 200 && finalizeRes.body.data.status === 'FINALIZED') {
    logPass('PUT /api/challans/:id/finalize transitions Challan to FINALIZED');
  } else {
    logFail('Challan finalization failed', finalizeRes.body);
  }

  // 1. Confirm physical stock dropped atomically (120 - 25 = 95)
  const productAfterFinalize = await Product.findById(testProduct._id);
  if (productAfterFinalize.currentStock === 95) {
    logPass('Product.currentStock cache atomically deducted from 120 -> 95');
  } else {
    logFail(`Product.currentStock is ${productAfterFinalize.currentStock}, expected 95`);
  }

  // 2. Confirm StockLedgerEntry in Module 8 was appended with CHALLAN_ISSUE and running balance 95
  const ledgerEntries = await StockLedgerEntry.find({
    product: testProduct._id,
    reason: 'CHALLAN_ISSUE',
    referenceDocId: draftChallanId
  });

  if (ledgerEntries.length === 1 && ledgerEntries[0].balanceAfter === 95 && ledgerEntries[0].quantity === 25) {
    logPass('StockLedgerEntry created with reason CHALLAN_ISSUE, quantity 25, and balanceAfter 95');
  } else {
    logFail('Stock ledger entry verification failed', ledgerEntries);
  }

  // 3. Confirm QuotationConfirmation deliveredQuantity updated to 25 and pending to 25
  const confirmationAfterFinalize = await QuotationConfirmation.findById(testConfirmation._id);
  const cItemAfter = confirmationAfterFinalize.confirmedItems[0];
  const pendingAfter = ((Number(cItemAfter.confirmedQuantity) || 0) + (Number(cItemAfter.extraQuantity) || 0)) - Number(cItemAfter.deliveredQuantity);
  if (cItemAfter.deliveredQuantity === 25 && pendingAfter === 25) {
    logPass('QuotationConfirmation recorded deliveredQuantity: 25, pending quantity: 25');
  } else {
    logFail('Confirmation delivered quantity update failed', cItemAfter);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 6: IMMUTABILITY LOCK ON FINALIZED CHALLAN ===${colors.reset}`);
  // Attempt to edit finalized challan -> must fail
  const editFinalizedRes = await api(`/challans/${draftChallanId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { remarks: 'Attempting illegal post-finalization edit' }
  });

  if (editFinalizedRes.status === 400 && editFinalizedRes.body.message.includes('FINALIZED')) {
    logPass('Editing a FINALIZED Challan is strictly rejected (HTTP 400)');
  } else {
    logFail('Finalized Challan edit was not blocked', editFinalizedRes.body);
  }

  // Attempt to cancel finalized challan -> must fail
  const cancelFinalizedRes = await api(`/challans/${draftChallanId}/cancel`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (cancelFinalizedRes.status === 400 && cancelFinalizedRes.body.message.includes('FINALIZED')) {
    logPass('Cancelling a FINALIZED Challan is strictly rejected (HTTP 400)');
  } else {
    logFail('Finalized Challan cancel was not blocked', cancelFinalizedRes.body);
  }

  // Attempt to re-finalize -> must fail
  const reFinalizeRes = await api(`/challans/${draftChallanId}/finalize`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (reFinalizeRes.status === 400 && reFinalizeRes.body.message.includes('already FINALIZED')) {
    logPass('Re-finalizing an already FINALIZED Challan is rejected (HTTP 400)');
  } else {
    logFail('Re-finalization check failed', reFinalizeRes.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 7: MULTI-CHALLAN PARTIAL DELIVERY & RACE PROTECTION ===${colors.reset}`);
  // Pending remaining is now 25 units.
  // Create Draft Challan A for 15 units (Valid)
  const challanARes = await api('/challans', {
    method: 'POST',
    token: superAdminToken,
    body: {
      confirmationId: testConfirmation._id,
      items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 15 }]
    }
  });
  const challanAId = challanARes.body.data._id;

  // Create Draft Challan B for 20 units (Valid at creation time because A is still DRAFT)
  const challanBRes = await api('/challans', {
    method: 'POST',
    token: superAdminToken,
    body: {
      confirmationId: testConfirmation._id,
      items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 20 }]
    }
  });
  const challanBId = challanBRes.body.data._id;

  // Finalize Challan A (15 units) -> succeeds (delivered becomes 25 + 15 = 40, pending becomes 10)
  const finalizeARes = await api(`/challans/${challanAId}/finalize`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (finalizeARes.status === 200) {
    logPass('Challan A (15 units) finalized successfully; cumulative delivered is now 40');
  } else {
    logFail('Challan A finalization failed', finalizeARes.body);
  }

  // Finalize Challan B (requesting 20 units, but only 10 pending remain) -> MUST BE REJECTED AT FINALIZATION TIME
  const finalizeBRes = await api(`/challans/${challanBId}/finalize`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (finalizeBRes.status === 400 && finalizeBRes.body.message.includes('overflow rejected')) {
    logPass('Challan B (20 units) correctly rejected at FINALIZATION time due to concurrent delivery race');
  } else {
    logFail('Concurrent multi-challan race protection failed', finalizeBRes.body);
  }

  // Finalize remaining 10 units via edited Challan B
  await api(`/challans/${challanBId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { items: [{ confirmedItemId: confirmedItem._id, quantityToIssue: 10 }] }
  });

  const finalizeB2Res = await api(`/challans/${challanBId}/finalize`, {
    method: 'PUT',
    token: superAdminToken
  });

  const confFinal = await QuotationConfirmation.findById(testConfirmation._id);
  if (finalizeB2Res.status === 200 && confFinal.isFullyDelivered === true) {
    logPass('Final Challan delivered remaining 10 units; QuotationConfirmation is now isFullyDelivered: true');
  } else {
    logFail('Final delivery completion check failed', { finalizeB2Res, confFinal });
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 8: GRANULAR PERMISSIONS & APPROVAL GATE ===${colors.reset}`);
  // Create a new confirmation for sales rep testing
  const salesConf = await QuotationConfirmation.create({
    quotation: testQuotation._id,
    customer: testCustomer._id,
    confirmationNumber: 'QC-SALES-001',
    confirmationStatus: 'FULLY_CONFIRMED',
    confirmedItems: [{
      originalQuotationItemId: testQuotation.items[0]._id,
      product: testProduct._id,
      productNameSnapshot: testProduct.productName,
      unitPriceSnapshot: 1500,
      quotedQuantity: 10,
      confirmedQuantity: 10,
      confirmedAmount: 15000,
      extraQuantity: 0,
      deliveredQuantity: 0,
      pendingQuantity: 10,
      rate: 1500,
      taxableAmount: 15000,
      totalAmount: 15000,
      deliveryStatus: 'PENDING'
    }],
    originalQuotationAmount: 15000,
    confirmedAmount: 15000,
    totalActualAmount: 15000,
    differenceAmount: 0,
    overallDeliveryStatus: 'PENDING',
    isFullyDelivered: false,
    pendingApproval: false,
    approvedAt: new Date(),
    confirmedBy: superAdminUser._id,
    isActive: true,
    createdBy: salesUserId
  });

  // Sales user creates draft challan -> succeeds with CHALLAN.create
  const salesCreateRes = await api('/challans', {
    method: 'POST',
    token: salesUserToken,
    body: {
      confirmationId: salesConf._id,
      items: [{ confirmedItemId: salesConf.confirmedItems[0]._id, quantityToIssue: 5 }]
    }
  });

  let salesChallanId;
  if (salesCreateRes.status === 201) {
    salesChallanId = salesCreateRes.body.data._id;
    logPass('Sales User with CHALLAN:create successfully creates DRAFT Challan');
  } else {
    logFail('Sales user draft creation failed', salesCreateRes.body);
  }

  // Sales user attempts to finalize (requires CHALLAN:approve) -> BLOCKED
  const salesFinalizeRes = await api(`/challans/${salesChallanId}/finalize`, {
    method: 'PUT',
    token: salesUserToken
  });

  if (salesFinalizeRes.status === 403) {
    logPass('Finalize action blocked (HTTP 403) for user without CHALLAN:approve permission');
  } else {
    logFail('Approval gate on finalization failed', salesFinalizeRes.body);
  }

  // View-Only user blocked from creation
  const viewCreateRes = await api('/challans', {
    method: 'POST',
    token: viewOnlyToken,
    body: {
      confirmationId: salesConf._id,
      items: [{ confirmedItemId: salesConf.confirmedItems[0]._id, quantityToIssue: 2 }]
    }
  });

  if (viewCreateRes.status === 403) {
    logPass('View-only user strictly blocked from creating Challans (HTTP 403)');
  } else {
    logFail('View-only permission check failed', viewCreateRes.body);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 9: DOCUMENTS, PRINT DATA & EXCEL EXPORT ===${colors.reset}`);
  // Print / Delivery Note View
  const printRes = await api(`/challans/${draftChallanId}/print`, { token: superAdminToken });
  if (
    printRes.status === 200 &&
    printRes.body.data.customer?.name &&
    Array.isArray(printRes.body.data.items) &&
    printRes.body.data.items.length > 0
  ) {
    logPass('GET /api/challans/:id/print returns delivery note document dataset');
  } else {
    logFail('Print delivery note data failed', printRes.body);
  }

  // Excel Export
  const exportRes = await api('/challans/export', { token: superAdminToken });
  if (exportRes.status === 200 && exportRes.headers.get('content-type').includes('spreadsheetml')) {
    logPass('GET /api/challans/export returns valid .xlsx binary workbook');
  } else {
    logFail('Excel export failed', exportRes);
  }

  console.log(`\n${colors.cyan}${colors.bold}=== STEP 10: FORWARD-REFERENCE SERVICES FOR DOWNSTREAM MODULES ===${colors.reset}`);
  // 1. Customer 360° History Integration (Module 4)
  const cust360 = await customerHistoryService.getCustomer360History(testCustomer);
  if (
    cust360 &&
    cust360.salesHistory &&
    Array.isArray(cust360.salesHistory.challans) &&
    cust360.salesHistory.challans.length >= 2
  ) {
    logPass('challanService.getByCustomer() seamlessly populates Module 4 Customer 360° History');
  } else {
    logFail('Customer 360 history integration failed', cust360);
  }

  // 2. Invoice Generation Ingest (Module 10 forward contract)
  const finalizedForConf = await challanService.getByConfirmation(testConfirmation._id);
  if (Array.isArray(finalizedForConf) && finalizedForConf.length >= 2) {
    logPass('challanService.getByConfirmation() returns all FINALIZED Challans for downstream Invoice generation');
  } else {
    logFail('getByConfirmation forward contract failed', finalizedForConf);
  }

  // Cleanup sales confirmation
  await Challan.deleteOne({ _id: salesChallanId });
  await QuotationConfirmation.deleteOne({ _id: salesConf._id });
}

async function teardown() {
  console.log(`\n${colors.cyan}${colors.bold}=== CLEANUP TEST DATA ===${colors.reset}`);
  if (testProduct) {
    await StockLedgerEntry.deleteMany({ product: testProduct._id });
    await Product.deleteOne({ _id: testProduct._id });
  }
  if (testConfirmation) {
    await Challan.deleteMany({ confirmation: testConfirmation._id });
    await QuotationConfirmation.deleteOne({ _id: testConfirmation._id });
  }
  if (testQuotation) await Quotation.deleteOne({ _id: testQuotation._id });
  if (testCustomer) await Customer.deleteOne({ _id: testCustomer._id });
  if (salesUserId) await User.deleteOne({ _id: salesUserId });
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
    console.log(`${colors.bold}📊 MODULE 9 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED${colors.reset}`);
    console.log(`${colors.bold}================================================================\n${colors.reset}`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

main();
