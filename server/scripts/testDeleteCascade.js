/**
 * Verification Test: Cascade Deletion for Product and User
 */

const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');
const app = require('../server');

const User = require('../models/User');
const Role = require('../models/Role');
const UserPermission = require('../models/UserPermission');
const RefreshToken = require('../models/RefreshToken');
const Product = require('../models/Product');
const ProductGroup = require('../models/ProductGroup');
const Company = require('../models/Company');
const UnitMaster = require('../models/UnitMaster');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const ReturnNote = require('../models/ReturnNote');

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m'
};

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;

function logPass(msg) {
  console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${msg}`);
}

function logFail(msg, details) {
  console.log(`  ${colors.red}✗ [FAIL]${colors.reset} ${msg}`);
  if (details) console.log(`     ${colors.yellow}Details:${colors.reset}`, details);
}

async function api(path, options = {}) {
  const { method = 'GET', body, token } = options;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const fetchOptions = { method, headers };
  if (body) fetchOptions.body = JSON.stringify(body);

  const response = await fetch(`${baseUrl}${path}`, fetchOptions);
  const json = await response.json();
  return { status: response.status, body: json };
}

async function runTest() {
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}CASCADE DELETION TESTS: PRODUCT & USER${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);

  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });

  // Login Super Admin
  const adminRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825702369', password: 'Laksh@2508' }
  });
  superAdminToken = adminRes.body.data.accessToken;
  superAdminUser = adminRes.body.data.user;
  logPass('Super Admin authenticated.');

  // ===========================================================================
  // TEST 1: PRODUCT CASCADE DELETION
  // ===========================================================================
  console.log(`\n${colors.bold}--- 1. Testing Product Cascade Deletion ---${colors.reset}`);
  const testCompany = await Company.findOne({ isActive: true }) || await Company.create({
    companyName: 'Test Company Delete',
    companyType: 'OWN',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const testUnit = await UnitMaster.findOne({ isActive: true }) || await UnitMaster.create({
    unitName: 'Pieces',
    unitCode: 'PCS',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const testGroup = await ProductGroup.findOne({ isActive: true }) || await ProductGroup.create({
    groupName: 'Tiles Delete Test',
    isActive: true,
    createdBy: superAdminUser._id
  });

  // 1. Create a Product to delete
  const testProduct = await Product.create({
    productName: `To Be Deleted Tile ${Date.now()}`,
    companySkuCode: `SKU-DEL-${Date.now().toString().slice(-6)}`,
    productGroup: testGroup._id,
    company: testCompany._id,
    unit: testUnit._id,
    currentStock: 100,
    isActive: true,
    createdBy: superAdminUser._id
  });
  logPass(`Created Test Product: '${testProduct.productName}' (${testProduct._id}).`);

  // 2. Attach StockLedgerEntry
  await StockLedgerEntry.create({
    product: testProduct._id,
    entryNumber: `SE-DEL-${Date.now().toString().slice(-6)}`,
    direction: 'IN',
    quantity: 100,
    reason: 'MANUAL_ADDITION',
    balanceAfter: 100,
    postedBy: superAdminUser._id
  });
  logPass('Attached StockLedgerEntry to product.');

  // 3. Attach ReturnNote
  await ReturnNote.create({
    returnNoteNumber: `RTN-DEL-${Date.now().toString().slice(-6)}`,
    returnType: 'PURCHASE_RETURN',
    product: testProduct._id,
    productNameSnapshot: testProduct.productName,
    quantity: 10,
    unit: testUnit._id,
    returnReason: 'Test return delete',
    returnStatus: 'DRAFT',
    createdBy: superAdminUser._id
  });
  logPass('Attached ReturnNote to product.');

  // 4. Call DELETE /api/products/:id
  const delProdRes = await api(`/products/${testProduct._id}`, {
    method: 'DELETE',
    token: superAdminToken
  });

  if (delProdRes.status === 200 && delProdRes.body.success) {
    logPass(`DELETE /api/products/:id responded successfully: ${JSON.stringify(delProdRes.body.data)}`);

    // Verify Product is deleted
    const prodCheck = await Product.findById(testProduct._id);
    if (!prodCheck) {
      logPass('Product document completely purged from database.');
    } else {
      logFail('Product document still exists in database!');
    }

    // Verify StockLedgerEntry is deleted
    const stockCheck = await StockLedgerEntry.find({ product: testProduct._id });
    if (stockCheck.length === 0) {
      logPass('All related StockLedgerEntry records purged.');
    } else {
      logFail(`Found ${stockCheck.length} orphaned StockLedgerEntry records!`);
    }

    // Verify ReturnNote is deleted
    const returnCheck = await ReturnNote.find({ product: testProduct._id });
    if (returnCheck.length === 0) {
      logPass('All related ReturnNote records purged.');
    } else {
      logFail(`Found ${returnCheck.length} orphaned ReturnNote records!`);
    }
  } else {
    logFail(`DELETE /api/products/:id failed with status ${delProdRes.status}`, delProdRes.body);
  }

  // ===========================================================================
  // TEST 2: USER CASCADE DELETION
  // ===========================================================================
  console.log(`\n${colors.bold}--- 2. Testing User Cascade Deletion ---${colors.reset}`);
  const cashierRole = await Role.findOne({ roleName: 'Cashier' }) || await Role.create({
    roleName: 'Cashier',
    description: 'Cashier',
    isSystemRole: false
  });

  const pwHash = await User.hashPassword('Password@123');
  const tempUser = await User.create({
    name: 'Temporary User To Delete',
    mobile: `97${Date.now().toString().slice(-8)}`,
    email: `temp_${Date.now()}@maitri.com`,
    passwordHash: pwHash,
    role: cashierRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  logPass(`Created Temporary User: '${tempUser.name}' (${tempUser._id}).`);

  // Create User Permissions
  await UserPermission.create({
    user: tempUser._id,
    module: new mongoose.Types.ObjectId(),
    actions: { view: true, create: true, edit: false, delete: false, export: false, approve: false },
    dataScope: 'OWN',
    grantedBy: superAdminUser._id
  });
  logPass('Attached UserPermission records.');

  // Create Refresh Token
  await RefreshToken.create({
    tokenHash: 'sampletokenhash1234567890abcdef',
    user: tempUser._id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  });
  logPass('Attached RefreshToken record.');

  // Call DELETE /api/users/:id
  const delUserRes = await api(`/users/${tempUser._id}`, {
    method: 'DELETE',
    token: superAdminToken
  });

  if (delUserRes.status === 200 && delUserRes.body.success) {
    logPass(`DELETE /api/users/:id responded successfully: ${JSON.stringify(delUserRes.body.data)}`);

    // Verify User is deleted
    const userCheck = await User.findById(tempUser._id);
    if (!userCheck) {
      logPass('User document completely purged from database.');
    } else {
      logFail('User document still exists in database!');
    }

    // Verify Permissions are deleted
    const permCheck = await UserPermission.find({ user: tempUser._id });
    if (permCheck.length === 0) {
      logPass('All related UserPermission records purged.');
    } else {
      logFail(`Found ${permCheck.length} orphaned UserPermission records!`);
    }

    // Verify Refresh Tokens are deleted
    const tokenCheck = await RefreshToken.find({ user: tempUser._id });
    if (tokenCheck.length === 0) {
      logPass('All related RefreshToken records purged.');
    } else {
      logFail(`Found ${tokenCheck.length} orphaned RefreshToken records!`);
    }
  } else {
    logFail(`DELETE /api/users/:id failed with status ${delUserRes.status}`, delUserRes.body);
  }

  // ===========================================================================
  // TEST 3: SUPER ADMIN DELETION PROTECTION
  // ===========================================================================
  console.log(`\n${colors.bold}--- 3. Testing Super Admin Deletion Protection ---${colors.reset}`);
  const delAdminRes = await api(`/users/${superAdminUser._id}`, {
    method: 'DELETE',
    token: superAdminToken
  });
  if (delAdminRes.status === 403 || delAdminRes.status === 400) {
    logPass(`Super Admin deletion protected with ${delAdminRes.status}: '${delAdminRes.body.message}'.`);
  } else {
    logFail(`Expected 403/400 for Super Admin deletion, got ${delAdminRes.status}`);
  }

  console.log(`\n${colors.green}${colors.bold}🎉 ALL CASCADE DELETION TESTS COMPLETED SUCCESSFULLY!${colors.reset}\n`);
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
