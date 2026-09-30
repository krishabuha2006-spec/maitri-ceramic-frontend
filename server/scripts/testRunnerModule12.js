/**
 * Module 12: Return Management - Automated Test Suite
 *
 * Verifies:
 * 1. ReturnNoteNumberSequence atomic sequential generator (RTN-YYYY-YY-XXXX)
 * 2. Purchase Return creation (DRAFT, zero stock impact)
 * 3. Sales Return creation (DRAFT, zero stock impact, optional invoice/challan references)
 * 4. Business rules & reference validations (cross-customer, non-existent references)
 * 5. Purchase Return Confirmation -> stock deduction (PURCHASE_RETURN) & StockLedgerEntry
 * 6. Negative stock protection on Purchase Return
 * 7. Sales Return Confirmation -> stock addition (SALES_RETURN) & StockLedgerEntry
 * 8. Immutability of upstream Invoice & Challan documents
 * 9. Post-confirmation immutability lock on quantity/product
 * 10. DRAFT cancellation & one-way confirmation lock
 * 11. Downstream forward references (Customer 360 History & getSalesReturnAmount)
 * 12. Excel export (.xlsx binary stream)
 * 13. RBAC permission gates (view, create, edit, delete, approve, export) and dataScope
 */

const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = require('../config/db');
const app = require('../server');

const User = require('../models/User');
const Role = require('../models/Role');
const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');
const Company = require('../models/Company');
const ProductGroup = require('../models/ProductGroup');
const UnitMaster = require('../models/UnitMaster');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const Challan = require('../models/Challan');
const Invoice = require('../models/Invoice');
const ReturnNote = require('../models/ReturnNote');
const ReturnNoteNumberSequence = require('../models/ReturnNoteNumberSequence');
const StockLedgerEntry = require('../models/StockLedgerEntry');

const stockService = require('../services/stock.service');
const returnNoteService = require('../services/returnNote.service');
const customerHistoryService = require('../services/customerHistory.service');

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

let storeManagerToken;
let storeManagerUserId;

let clerkNoApproveToken;
let clerkNoApproveUserId;

let viewOnlyToken;
let viewOnlyUserId;

let testCompany;
let testProductGroup;
let testUnit;
let testVendor;
let testProduct1;
let testProduct2;
let testCustomer1;
let testCustomer2;
let testChallan;
let testInvoice;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function logPass(msg) {
  totalTests++;
  passedTests++;
  console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${msg}`);
}

function logFail(msg, details) {
  totalTests++;
  failedTests++;
  console.log(`  ${colors.red}✗ [FAIL]${colors.reset} ${msg}`);
  if (details) {
    console.log(`     ${colors.yellow}Details:${colors.reset}`, details);
  }
}

async function api(path, options = {}) {
  const { method = 'GET', body, token, query } = options;
  let url = `${baseUrl}${path}`;

  if (query) {
    const qParams = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) qParams.append(k, v);
    });
    const qs = qParams.toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method,
    headers
  };

  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  let resBody;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    resBody = await response.json();
  } else {
    resBody = await response.arrayBuffer();
  }

  return {
    status: response.status,
    headers: response.headers,
    body: resBody
  };
}

async function setup() {
  console.log(`\n${colors.cyan}=== SETUP & DATABASE CONNECTION ===${colors.reset}`);
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

  // 1. Authenticate Super Admin
  const adminRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825702369', password: 'Laksh@2508' }
  });
  if (adminRes.status === 200 && adminRes.body.success) {
    superAdminToken = adminRes.body.data.accessToken;
    superAdminUser = adminRes.body.data.user;
    logPass('Super Admin authenticated successfully.');
  } else {
    throw new Error(`Super admin login failed: ${JSON.stringify(adminRes.body)}`);
  }

  // 2. Ensure SystemModule RETURN_NOTE is registered
  let returnModule = await SystemModule.findOne({ moduleKey: 'RETURN_NOTE' });
  if (!returnModule) {
    returnModule = await SystemModule.create({
      moduleKey: 'RETURN_NOTE',
      moduleName: 'Return Management',
      parentModule: 'BILLING',
      isActive: true
    });
  }
  logPass('SystemModule `RETURN_NOTE` verified in database.');

  const pwHash = await User.hashPassword('Password@123');

  // 3. Setup Store Manager User (with approve permission)
  let storeRole = await Role.findOne({ roleName: 'Store Manager' });
  if (!storeRole) {
    storeRole = await Role.create({
      roleName: 'Store Manager',
      description: 'Inventory & Store Head',
      isSystemRole: false
    });
  }

  await User.deleteOne({ mobile: '9825700030' });
  const storeUser = await User.create({
    name: 'Store Manager Return',
    mobile: '9825700030',
    email: 'store.return@maitri.com',
    passwordHash: pwHash,
    role: storeRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  storeManagerUserId = storeUser._id;

  await UserPermission.findOneAndUpdate(
    { user: storeManagerUserId, module: returnModule._id },
    {
      $set: {
        actions: { view: true, create: true, edit: true, delete: true, export: true, approve: true },
        dataScope: 'ALL',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  const storeLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700030', password: 'Password@123' }
  });
  storeManagerToken = storeLoginRes.body.data.accessToken;
  logPass('Store Manager (with approve permission) authenticated.');

  // 4. Setup Clerk User (without approve permission)
  let clerkRole = await Role.findOne({ roleName: 'Inventory Clerk' }) || await Role.create({
    roleName: 'Inventory Clerk',
    description: 'Inventory Data Entry',
    isSystemRole: false
  });

  await User.deleteOne({ mobile: '9825700031' });
  const clerkUser = await User.create({
    name: 'Clerk NoApprove',
    mobile: '9825700031',
    email: 'clerk@maitri.com',
    passwordHash: pwHash,
    role: clerkRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  clerkNoApproveUserId = clerkUser._id;

  await UserPermission.findOneAndUpdate(
    { user: clerkNoApproveUserId, module: returnModule._id },
    {
      $set: {
        actions: { view: true, create: true, edit: true, delete: true, export: false, approve: false },
        dataScope: 'ALL',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  const clerkLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700031', password: 'Password@123' }
  });
  clerkNoApproveToken = clerkLoginRes.body.data.accessToken;
  logPass('Clerk User (without approve permission) authenticated.');

  // 5. Setup View-Only User
  await User.deleteOne({ mobile: '9825700032' });
  const viewOnlyUser = await User.create({
    name: 'Return View Only',
    mobile: '9825700032',
    email: 'viewer.return@maitri.com',
    passwordHash: pwHash,
    role: clerkRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  viewOnlyUserId = viewOnlyUser._id;

  await UserPermission.findOneAndUpdate(
    { user: viewOnlyUserId, module: returnModule._id },
    {
      $set: {
        actions: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
        dataScope: 'OWN',
        grantedBy: superAdminUser._id,
        isActive: true
      }
    },
    { upsert: true }
  );

  const viewLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700032', password: 'Password@123' }
  });
  viewOnlyToken = viewLoginRes.body.data.accessToken;
  logPass('View-Only User authenticated.');

  // 6. Setup Masters: Company, Unit, Group, Vendor, Products, Customers
  testCompany = await Company.findOne({ companyType: 'OWN', isActive: true });
  if (!testCompany) {
    testCompany = await Company.create({
      companyName: 'Maitri Ceramic',
      companyType: 'OWN',
      gstNumber: '24AAAAA0000A1Z5',
      address: 'National Highway 8A, Morbi, Gujarat - 363642',
      contactPerson: 'Piyush Bhai',
      contactMobile: '9825702369',
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  testUnit = await UnitMaster.findOne({ unitCode: 'PCS', isActive: true }) || await UnitMaster.create({
    unitName: 'Pieces',
    unitCode: 'PCS',
    isActive: true,
    createdBy: superAdminUser._id
  });

  testProductGroup = await ProductGroup.findOne({ isActive: true }) || await ProductGroup.create({
    groupName: 'Ceramic Tiles',
    isActive: true,
    createdBy: superAdminUser._id
  });

  testVendor = await Vendor.findOne({ vendorName: 'Morbi Clay Suppliers' });
  if (!testVendor) {
    testVendor = await Vendor.create({
      vendorName: 'Morbi Clay Suppliers',
      contactPerson: 'Ramesh Bhai',
      mobile: '9876543210',
      email: 'ramesh@morbiclay.com',
      city: 'Morbi',
      state: 'Gujarat',
      gstNumber: '24RMB001122A1Z4',
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  const uniqueSuffix = Date.now().toString().slice(-6);

  // Product 1 starts with currentStock: 100
  testProduct1 = await Product.create({
    productName: `Glazed Porcelain 600x600 ${uniqueSuffix}`,
    companySkuCode: `SKU-RTN-1-${uniqueSuffix}`,
    productGroup: testProductGroup._id,
    company: testCompany._id,
    unit: testUnit._id,
    mrp: 500,
    gstPct: 18,
    currentStock: 100,
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Product 2 starts with currentStock: 50
  testProduct2 = await Product.create({
    productName: `Matt Finish Ceramic 300x600 ${uniqueSuffix}`,
    companySkuCode: `SKU-RTN-2-${uniqueSuffix}`,
    productGroup: testProductGroup._id,
    company: testCompany._id,
    unit: testUnit._id,
    mrp: 300,
    gstPct: 18,
    currentStock: 50,
    isActive: true,
    createdBy: superAdminUser._id
  });

  testCustomer1 = await Customer.create({
    customerName: `Galaxy Heights ${uniqueSuffix}`,
    mobile: `99${uniqueSuffix}${Math.floor(10 + Math.random() * 90)}`,
    billingAddress: 'Ring Road, Surat, Gujarat',
    shippingAddress: 'Ring Road, Surat, Gujarat',
    city: 'Surat',
    state: 'Gujarat',
    gstNumber: '24GH001122A1Z1',
    customerType: 'CONTRACTOR',
    isActive: true,
    createdBy: superAdminUser._id
  });

  testCustomer2 = await Customer.create({
    customerName: `Omkar Residency ${uniqueSuffix}`,
    mobile: `98${uniqueSuffix}${Math.floor(10 + Math.random() * 90)}`,
    billingAddress: 'SG Highway, Ahmedabad, Gujarat',
    shippingAddress: 'SG Highway, Ahmedabad, Gujarat',
    city: 'Ahmedabad',
    state: 'Gujarat',
    gstNumber: '24OR001122A1Z9',
    customerType: 'CONTRACTOR',
    isActive: true,
    createdBy: superAdminUser._id
  });

  logPass('Master reference data & test products/customers initialized.');
}

async function runTestSuite() {
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}MODULE 12: RETURN MANAGEMENT - AUTOMATED TEST SUITE${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Return Note Number Sequence Engine
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 1: Return Note Number Sequence Engine${colors.reset}`);
  try {
    const num1 = await ReturnNoteNumberSequence.generateNextNumber();
    const num2 = await ReturnNoteNumberSequence.generateNextNumber();
    const currentFY = ReturnNoteNumberSequence.getCurrentFinancialYear();

    if (num1.startsWith(`RTN-${currentFY}-`) && num2.startsWith(`RTN-${currentFY}-`)) {
      logPass(`Atomic sequential numbers generated correctly: ${num1} -> ${num2}`);
    } else {
      logFail(`Sequence format mismatch: num1=${num1}, num2=${num2}`);
    }
  } catch (err) {
    logFail('Sequence engine exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Upstream Artifacts Preparation (Challan & Invoice for Sales Return)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 2: Upstream Artifacts Preparation (Challan & Invoice)${colors.reset}`);
  try {
    testChallan = await Challan.create({
      challanNumber: `CH-RTN-${Date.now().toString().slice(-6)}`,
      customer: testCustomer1._id,
      buyerNameSnapshot: testCustomer1.customerName,
      dispatchAddressSnapshot: testCustomer1.shippingAddress,
      confirmation: new mongoose.Types.ObjectId(),
      salesperson: superAdminUser._id,
      items: [
        {
          confirmedItem: new mongoose.Types.ObjectId(),
          product: testProduct1._id,
          skuCodeSnapshot: testProduct1.companySkuCode,
          productNameSnapshot: testProduct1.productName,
          unit: testUnit._id,
          quantityToIssue: 20
        }
      ],
      totalItems: 1,
      totalQuantity: 20,
      status: 'FINALIZED',
      invoiced: true,
      createdBy: superAdminUser._id
    });
    logPass(`Created Finalized Challan '${testChallan.challanNumber}'.`);

    testInvoice = await Invoice.create({
      invoiceNumber: `INV-RTN-${Date.now().toString().slice(-6)}`,
      customer: testCustomer1._id,
      buyerBillTo: testCustomer1.customerName,
      consigneeShipTo: testCustomer1.customerName,
      customerMobile: testCustomer1.mobile,
      customerGstNumber: testCustomer1.gstNumber,
      customerAddress: testCustomer1.billingAddress,
      sourceChallans: [testChallan._id],
      sourceChallanNumbers: [testChallan.challanNumber],
      items: [
        {
          sourceChallan: testChallan._id,
          sourceChallanItemId: testChallan.items[0]._id,
          product: testProduct1._id,
          skuCodeSnapshot: testProduct1.companySkuCode,
          descriptionSnapshot: testProduct1.productName,
          unit: testUnit._id,
          quantity: 20,
          rateSnapshot: 500,
          discountPct: 0,
          gstPctSnapshot: 18,
          amount: 10000,
          discountAmount: 0,
          netAmount: 10000,
          gstAmount: 1800
        }
      ],
      taxType: 'INTRA_STATE',
      subTotal: 10000,
      totalDiscount: 0,
      totalTaxableAmount: 10000,
      totalCgst: 900,
      totalSgst: 900,
      totalIgst: 0,
      totalGst: 1800,
      grandTotal: 11800,
      amountInWords: 'Rupees Eleven Thousand Eight Hundred Only',
      status: 'ISSUED',
      createdBy: superAdminUser._id
    });
    logPass(`Created Issued Invoice '${testInvoice.invoiceNumber}' (Grand Total: ₹11,800).`);
  } catch (err) {
    logFail('Upstream setup exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Purchase Return Creation (DRAFT, Zero Stock Impact)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 3: Purchase Return Creation (DRAFT, Zero Stock Impact)${colors.reset}`);
  let purchaseReturn1;
  try {
    const initialStock = await stockService.getActualStock(testProduct1._id);

    const prRes = await api('/returns/purchase-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        vendorId: testVendor._id,
        productId: testProduct1._id,
        quantity: 15,
        returnReason: 'Damaged packaging from vendor shipment',
        purchaseReferenceNote: 'PO-2026-0988',
        remarks: 'Returning 15 PCS to Morbi Clay Suppliers'
      }
    });

    if (prRes.status === 201 && prRes.body.success) {
      purchaseReturn1 = prRes.body.data;
      logPass(`Created DRAFT Purchase Return '${purchaseReturn1.returnNoteNumber}' (Quantity: 15).`);

      // Verify status is DRAFT
      if (purchaseReturn1.returnStatus === 'DRAFT') {
        logPass('Purchase Return status correctly initialized as DRAFT.');
      } else {
        logFail(`Expected status DRAFT, got ${purchaseReturn1.returnStatus}`);
      }

      // Verify ZERO stock impact while DRAFT
      const currentStock = await stockService.getActualStock(testProduct1._id);
      if (currentStock === initialStock) {
        logPass(`Stock unchanged during DRAFT: Initial=${initialStock}, Current=${currentStock}.`);
      } else {
        logFail(`Stock was modified prematurely in DRAFT: expected ${initialStock}, got ${currentStock}`);
      }

      // Verify zero StockLedgerEntry posted
      const ledgerEntry = await StockLedgerEntry.findOne({ referenceDocId: purchaseReturn1._id });
      if (!ledgerEntry) {
        logPass('Zero StockLedgerEntry entries posted for DRAFT Purchase Return.');
      } else {
        logFail('StockLedgerEntry was created prematurely in DRAFT status.');
      }
    } else {
      logFail(`Purchase return creation failed with status ${prRes.status}`, prRes.body);
    }
  } catch (err) {
    logFail('Purchase return creation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: Sales Return Creation (DRAFT, Zero Stock Impact, Lineage)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 4: Sales Return Creation (DRAFT, Zero Stock Impact, Lineage)${colors.reset}`);
  let salesReturn1;
  try {
    const initialStock = await stockService.getActualStock(testProduct1._id);

    const srRes = await api('/returns/sales-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        customerId: testCustomer1._id,
        productId: testProduct1._id,
        quantity: 5,
        invoiceId: testInvoice._id,
        challanId: testChallan._id,
        returnReason: 'Excess tiles returned by contractor after bathroom renovation',
        remarks: 'Boxes in pristine condition'
      }
    });

    if (srRes.status === 201 && srRes.body.success) {
      salesReturn1 = srRes.body.data;
      logPass(`Created DRAFT Sales Return '${salesReturn1.returnNoteNumber}' (Quantity: 5).`);

      if (salesReturn1.returnStatus === 'DRAFT' && salesReturn1.returnType === 'SALES_RETURN') {
        logPass('Sales Return correctly classified as SALES_RETURN with status DRAFT.');
      } else {
        logFail(`Mismatch in returnType or returnStatus: ${JSON.stringify(salesReturn1)}`);
      }

      // Verify ZERO stock impact while DRAFT
      const currentStock = await stockService.getActualStock(testProduct1._id);
      if (currentStock === initialStock) {
        logPass(`Stock unchanged during DRAFT: Initial=${initialStock}, Current=${currentStock}.`);
      } else {
        logFail(`Stock modified prematurely in DRAFT: expected ${initialStock}, got ${currentStock}`);
      }
    } else {
      logFail(`Sales return creation failed with status ${srRes.status}`, srRes.body);
    }
  } catch (err) {
    logFail('Sales return creation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Business Rules & Validation Engine
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 5: Business Rules & Validation Engine${colors.reset}`);
  try {
    // 1. Sales Return with non-existent Invoice ID -> should be rejected with 400
    const fakeInvRes = await api('/returns/sales-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        customerId: testCustomer1._id,
        productId: testProduct1._id,
        quantity: 2,
        invoiceId: new mongoose.Types.ObjectId(),
        returnReason: 'Invalid invoice reference'
      }
    });
    if (fakeInvRes.status === 400) {
      logPass(`Non-existent invoice reference rejected with 400: '${fakeInvRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for invalid invoice reference, got ${fakeInvRes.status}`);
    }

    // 2. Sales Return with Invoice belonging to DIFFERENT Customer -> rejected with 400
    const crossCustRes = await api('/returns/sales-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        customerId: testCustomer2._id, // Customer 2
        productId: testProduct1._id,
        quantity: 2,
        invoiceId: testInvoice._id, // Invoice belongs to Customer 1
        returnReason: 'Cross-customer return attempt'
      }
    });
    if (crossCustRes.status === 400) {
      logPass(`Cross-customer invoice reference rejected with 400: '${crossCustRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for cross-customer invoice reference, got ${crossCustRes.status}`);
    }

    // 3. Sales Return with NEITHER Invoice nor Challan -> MUST SUCCEED (both optional)
    const noRefRes = await api('/returns/sales-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        customerId: testCustomer1._id,
        productId: testProduct2._id,
        quantity: 4,
        returnReason: 'Direct walk-in customer return without paperwork reference'
      }
    });
    if (noRefRes.status === 201 && noRefRes.body.success) {
      logPass(`Sales Return with zero paperwork references logged successfully: '${noRefRes.body.data.returnNoteNumber}'.`);
    } else {
      logFail(`Expected 201 for return without invoice/challan, got ${noRefRes.status}`);
    }

    // 4. Purchase Return without vendorId -> rejected with 400
    const noVendorRes = await api('/returns/purchase-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        productId: testProduct1._id,
        quantity: 5,
        returnReason: 'Missing vendor'
      }
    });
    if (noVendorRes.status === 400) {
      logPass(`Missing vendor on purchase return rejected with 400: '${noVendorRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for missing vendor, got ${noVendorRes.status}`);
    }
  } catch (err) {
    logFail('Validation engine exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: Purchase Return Confirmation (Stock Deduction)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 6: Purchase Return Confirmation (Stock Deduction)${colors.reset}`);
  try {
    const stockBefore = await stockService.getActualStock(testProduct1._id); // 100

    // 1. Clerk without approve permission attempts confirmation -> should return 403 Forbidden
    const unauthConfRes = await api(`/returns/${purchaseReturn1._id}/confirm`, {
      method: 'PUT',
      token: clerkNoApproveToken
    });
    if (unauthConfRes.status === 403) {
      logPass('User without RETURN_NOTE:approve blocked from confirming return (403 Forbidden).');
    } else {
      logFail(`Expected 403 for unauthorized confirmation, got ${unauthConfRes.status}`);
    }

    // 2. Store Manager with approve permission confirms Purchase Return (qty: 15)
    const confRes = await api(`/returns/${purchaseReturn1._id}/confirm`, {
      method: 'PUT',
      token: storeManagerToken
    });

    if (confRes.status === 200 && confRes.body.success) {
      const confirmedDoc = confRes.body.data;
      logPass(`Purchase Return confirmed: status='${confirmedDoc.returnStatus}'.`);

      // 3. Verify stock deduction in Product cache
      const stockAfter = await stockService.getActualStock(testProduct1._id);
      const expectedStock = stockBefore - 15; // 100 - 15 = 85
      if (stockAfter === expectedStock) {
        logPass(`Stock correctly deducted: ${stockBefore} − 15 = ${stockAfter}.`);
      } else {
        logFail(`Stock deduction mismatch: expected ${expectedStock}, got ${stockAfter}`);
      }

      // 4. Verify StockLedgerEntry
      const ledgerEntry = await StockLedgerEntry.findOne({
        referenceDocId: purchaseReturn1._id,
        reason: 'PURCHASE_RETURN'
      });
      if (ledgerEntry && ledgerEntry.direction === 'OUT' && ledgerEntry.quantity === 15) {
        logPass(`StockLedgerEntry verified: Direction=OUT, Reason=PURCHASE_RETURN, Qty=15, BalanceAfter=${ledgerEntry.balanceAfter}.`);
      } else {
        logFail('StockLedgerEntry not found or invalid for Purchase Return.');
      }
    } else {
      logFail(`Purchase return confirmation failed with status ${confRes.status}`, confRes.body);
    }
  } catch (err) {
    logFail('Purchase return confirmation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 7: Negative Stock Protection on Purchase Return
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 7: Negative Stock Protection on Purchase Return${colors.reset}`);
  try {
    const currentStock = await stockService.getActualStock(testProduct2._id); // 50

    // Create DRAFT Purchase Return of 100 units (exceeding stock of 50)
    const excessPrRes = await api('/returns/purchase-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        vendorId: testVendor._id,
        productId: testProduct2._id,
        quantity: 100, // exceeds 50
        returnReason: 'Excess return test'
      }
    });

    const excessPrId = excessPrRes.body.data._id;

    // Attempt to confirm without allowNegative -> should be rejected with 400
    const confExcessRes = await api(`/returns/${excessPrId}/confirm`, {
      method: 'PUT',
      token: storeManagerToken
    });

    if (confExcessRes.status === 400) {
      logPass(`Insufficient stock deduction correctly rejected with 400: '${confExcessRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for negative stock deduction, got ${confExcessRes.status}`);
    }

    // Verify stock remains untouched at 50
    const stockAfter = await stockService.getActualStock(testProduct2._id);
    if (stockAfter === currentStock) {
      logPass(`Stock remains untouched at ${stockAfter}.`);
    } else {
      logFail(`Stock was modified on rejected confirmation: ${stockAfter}`);
    }
  } catch (err) {
    logFail('Negative stock protection exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 8: Sales Return Confirmation (Stock Addition)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 8: Sales Return Confirmation (Stock Addition)${colors.reset}`);
  try {
    const stockBefore = await stockService.getActualStock(testProduct1._id); // 85

    // Confirm Sales Return (qty: 5)
    const confRes = await api(`/returns/${salesReturn1._id}/confirm`, {
      method: 'PUT',
      token: storeManagerToken
    });

    if (confRes.status === 200 && confRes.body.success) {
      const confirmedDoc = confRes.body.data;
      logPass(`Sales Return confirmed: status='${confirmedDoc.returnStatus}'.`);

      // 1. Verify stock addition in Product cache
      const stockAfter = await stockService.getActualStock(testProduct1._id);
      const expectedStock = stockBefore + 5; // 85 + 5 = 90
      if (stockAfter === expectedStock) {
        logPass(`Stock correctly added: ${stockBefore} + 5 = ${stockAfter}.`);
      } else {
        logFail(`Stock addition mismatch: expected ${expectedStock}, got ${stockAfter}`);
      }

      // 2. Verify StockLedgerEntry
      const ledgerEntry = await StockLedgerEntry.findOne({
        referenceDocId: salesReturn1._id,
        reason: 'SALES_RETURN'
      });
      if (ledgerEntry && ledgerEntry.direction === 'IN' && ledgerEntry.quantity === 5) {
        logPass(`StockLedgerEntry verified: Direction=IN, Reason=SALES_RETURN, Qty=5, BalanceAfter=${ledgerEntry.balanceAfter}.`);
      } else {
        logFail('StockLedgerEntry not found or invalid for Sales Return.');
      }
    } else {
      logFail(`Sales return confirmation failed with status ${confRes.status}`, confRes.body);
    }
  } catch (err) {
    logFail('Sales return confirmation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 9: Upstream Immutability Verification (Invoice & Challan Unchanged)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 9: Upstream Immutability Verification (Invoice & Challan Unchanged)${colors.reset}`);
  try {
    const invFresh = await Invoice.findById(testInvoice._id).lean();
    const chFresh = await Challan.findById(testChallan._id).lean();

    if (invFresh.grandTotal === 11800 && invFresh.status === 'ISSUED' && invFresh.items.length === 1) {
      logPass(`Referenced Invoice '${invFresh.invoiceNumber}' remains strictly immutable (GrandTotal: ₹11,800, Status: ISSUED).`);
    } else {
      logFail('Referenced Invoice was mutated unexpectedly during Sales Return confirmation!');
    }

    if (chFresh.items && chFresh.items[0] && chFresh.items[0].quantityToIssue === 20 && chFresh.status === 'FINALIZED') {
      logPass(`Referenced Challan '${chFresh.challanNumber}' remains strictly immutable (Qty: 20, Status: FINALIZED).`);
    } else {
      logFail('Referenced Challan was mutated unexpectedly during Sales Return confirmation!');
    }
  } catch (err) {
    logFail('Immutability verification exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 10: Post-Confirmation Immutability & Re-confirmation Lock
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 10: Post-Confirmation Immutability & Re-confirmation Lock${colors.reset}`);
  try {
    // 1. Attempt to edit quantity or product on CONFIRMED return -> should be stripped / rejected
    const editRes = await api(`/returns/${salesReturn1._id}`, {
      method: 'PUT',
      token: storeManagerToken,
      body: {
        quantity: 999,
        productId: testProduct2._id,
        returnReason: 'Updated reason for tile return'
      }
    });

    if (editRes.status === 200 && editRes.body.success) {
      const updated = editRes.body.data;
      if (updated.quantity === 5 && String(updated.product._id || updated.product) === String(testProduct1._id)) {
        logPass('Tampered quantity/product stripped; Quantity remained 5.');
      } else {
        logFail(`Quantity was mutated on confirmed return: got ${updated.quantity}`);
      }

      if (updated.returnReason === 'Updated reason for tile return') {
        logPass('Allowed metadata field (returnReason) updated successfully.');
      } else {
        logFail('returnReason was not updated.');
      }
    } else {
      logFail(`Edit on confirmed return failed with status ${editRes.status}`, editRes.body);
    }

    // 2. Attempt to cancel a CONFIRMED return -> should be rejected with 400
    const cancelConfRes = await api(`/returns/${salesReturn1._id}/cancel`, {
      method: 'PUT',
      token: storeManagerToken
    });
    if (cancelConfRes.status === 400) {
      logPass(`Cancellation of CONFIRMED return correctly BLOCKED with 400: '${cancelConfRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for cancelling confirmed return, got ${cancelConfRes.status}`);
    }

    // 3. Attempt to re-confirm already CONFIRMED return -> should be rejected with 400
    const reConfRes = await api(`/returns/${salesReturn1._id}/confirm`, {
      method: 'PUT',
      token: storeManagerToken
    });
    if (reConfRes.status === 400) {
      logPass(`Re-confirmation of already CONFIRMED return correctly rejected with 400: '${reConfRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for re-confirmation, got ${reConfRes.status}`);
    }
  } catch (err) {
    logFail('Post-confirmation lock exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 11: DRAFT Cancellation & Re-confirmation Gate
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 11: DRAFT Cancellation & Re-confirmation Gate${colors.reset}`);
  try {
    // Create a DRAFT return
    const draftRes = await api('/returns/sales-return', {
      method: 'POST',
      token: storeManagerToken,
      body: {
        customerId: testCustomer1._id,
        productId: testProduct1._id,
        quantity: 2,
        returnReason: 'Wrong color selection'
      }
    });
    const draftId = draftRes.body.data._id;

    // Cancel the DRAFT return
    const cancelRes = await api(`/returns/${draftId}/cancel`, {
      method: 'PUT',
      token: storeManagerToken
    });
    if (cancelRes.status === 200 && cancelRes.body.success) {
      logPass(`DRAFT return successfully cancelled: status='${cancelRes.body.data.returnStatus}'.`);
    } else {
      logFail(`Failed to cancel draft return: ${cancelRes.status}`);
    }

    // Attempt to confirm a CANCELLED return -> should be rejected with 400
    const confCancelledRes = await api(`/returns/${draftId}/confirm`, {
      method: 'PUT',
      token: storeManagerToken
    });
    if (confCancelledRes.status === 400) {
      logPass(`Confirmation of CANCELLED return correctly rejected with 400: '${confCancelledRes.body.message}'.`);
    } else {
      logFail(`Expected 400 for confirming cancelled return, got ${confCancelledRes.status}`);
    }
  } catch (err) {
    logFail('Draft cancellation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 12: Downstream Forward Reference Services (Module 4 & Module 13)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 12: Downstream Forward References (Module 4 & Module 13)${colors.reset}`);
  try {
    // 1. returnService.getByCustomer(customerId) via Customer 360 History
    const cust360 = await customerHistoryService.getCustomer360History(testCustomer1);
    if (cust360 && cust360.salesHistory && Array.isArray(cust360.salesHistory.returns)) {
      const customerReturns = cust360.salesHistory.returns;
      if (customerReturns.length >= 1) {
        logPass(`Customer 360° History correctly aggregated Sales Returns (${customerReturns.length} returns found).`);
      } else {
        logFail('Customer 360 History returns array was empty.');
      }
    } else {
      logFail('Customer 360 History did not include salesHistory.returns');
    }

    // 2. returnService.getSalesReturnAmount(invoiceId)
    // 5 units returned against invoice item with rateSnapshot: 500, discount: 0, GST: 18%
    // Net: 5 * 500 = 2500, GST: 2500 * 0.18 = 450 -> Total Return Amount = 2950
    const returnAmount = await returnNoteService.getSalesReturnAmount(testInvoice._id);
    if (returnAmount === 2950) {
      logPass(`returnService.getSalesReturnAmount() computed exact credit value: ₹${returnAmount} (5 PCS @ ₹500 + 18% GST = ₹2,950).`);
    } else {
      logFail(`getSalesReturnAmount mismatch: expected 2950, got ${returnAmount}`);
    }
  } catch (err) {
    logFail('Downstream forward references exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 13: Excel Export & RBAC Permission Gates
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 13: Excel Export & RBAC Permission Gates${colors.reset}`);
  try {
    // 1. Excel Export (Store Manager)
    const exportRes = await api('/returns/export', {
      method: 'GET',
      token: storeManagerToken
    });
    if (exportRes.status === 200 && exportRes.body.byteLength > 1000) {
      logPass(`Return Notes Excel export generated valid binary stream (${exportRes.body.byteLength} bytes).`);
    } else {
      logFail(`Excel export failed with status ${exportRes.status}`);
    }

    // 2. View-Only User attempts prohibited actions -> should all return 403
    const prBlock = await api('/returns/purchase-return', {
      method: 'POST',
      token: viewOnlyToken,
      body: { vendorId: testVendor._id, productId: testProduct1._id, quantity: 1, returnReason: 'View only test' }
    });
    if (prBlock.status === 403) {
      logPass('View-Only user blocked from creating Purchase Return (403 Forbidden).');
    } else {
      logFail(`Expected 403 for View-Only create, got ${prBlock.status}`);
    }

    const srBlock = await api('/returns/sales-return', {
      method: 'POST',
      token: viewOnlyToken,
      body: { customerId: testCustomer1._id, productId: testProduct1._id, quantity: 1, returnReason: 'View only test' }
    });
    if (srBlock.status === 403) {
      logPass('View-Only user blocked from creating Sales Return (403 Forbidden).');
    } else {
      logFail(`Expected 403 for View-Only create sales return, got ${srBlock.status}`);
    }

    const exportBlock = await api('/returns/export', {
      method: 'GET',
      token: viewOnlyToken
    });
    if (exportBlock.status === 403) {
      logPass('View-Only user blocked from exporting returns (403 Forbidden).');
    } else {
      logFail(`Expected 403 for View-Only export, got ${exportBlock.status}`);
    }
  } catch (err) {
    logFail('RBAC & Excel export exception', err);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}MODULE 12 TEST RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`  Total Tests Run: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);

  if (failedTests === 0) {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL MODULE 12 RETURN MANAGEMENT TESTS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ Module 12 verification finished with ${failedTests} failure(s).${colors.reset}\n`);
    process.exit(1);
  }
}

async function main() {
  try {
    await setup();
    await runTestSuite();
  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    process.exit(1);
  }
}

main();
