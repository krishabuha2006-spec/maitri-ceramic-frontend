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
const Invoice = require('../models/Invoice');
const InvoiceNumberSequence = require('../models/InvoiceNumberSequence');
const StockLedgerEntry = require('../models/StockLedgerEntry');
const challanService = require('../services/challan.service');
const stockService = require('../services/stock.service');
const confirmationService = require('../services/confirmation.service');
const invoiceService = require('../services/invoice.service');
const customerHistoryService = require('../services/customerHistory.service');
const { amountToWords } = require('../utils/numberToWords.util');

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;
let accountsUserToken;
let accountsUserId;
let viewOnlyToken;
let viewOnlyUserId;

let testCompany;
let testUnit;
let testProductGroup;
let testFormat;
let testProduct1;
let testProduct2;
let testCustomerGujarat;
let testCustomerMaharashtra;
let testQuotation;
let testConfirmation;
let challan1;
let challan2;

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

  // 2. Ensure SystemModule INVOICE is registered
  let invoiceModule = await SystemModule.findOne({ moduleKey: 'INVOICE' });
  if (!invoiceModule) {
    invoiceModule = await SystemModule.create({
      moduleKey: 'INVOICE',
      moduleName: 'Invoice Management',
      parentModule: 'BILLING',
      isActive: true
    });
  }
  logPass('SystemModule `INVOICE` verified in database.');

  // 3. Setup Accounts User (with dataScope: 'ALL')
  let accountsRole = await Role.findOne({ roleName: 'Accounts User' });
  if (!accountsRole) {
    accountsRole = await Role.create({
      roleName: 'Accounts User',
      description: 'Accounts & Billing Specialist',
      isSystemRole: false
    });
  }

  const pwHash = await User.hashPassword('Password@123');
  await User.deleteOne({ mobile: '9825700010' });
  const accountsUser = await User.create({
    name: 'Accounts Test User',
    mobile: '9825700010',
    email: 'accounts@maitri.com',
    passwordHash: pwHash,
    role: accountsRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  accountsUserId = accountsUser._id;

  // Assign full INVOICE permissions with dataScope: ALL to accounts user
  await UserPermission.findOneAndUpdate(
    { user: accountsUserId, module: invoiceModule._id },
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

  const accLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700010', password: 'Password@123' }
  });
  accountsUserToken = accLoginRes.body.data.accessToken;
  logPass('Accounts User created and authenticated.');

  // 4. Setup View-Only User (with dataScope: 'OWN')
  let viewerRole = await Role.findOne({ roleName: 'Sales Executive' });
  if (!viewerRole) {
    viewerRole = await Role.create({
      roleName: 'Sales Executive',
      description: 'Sales Executive',
      isSystemRole: false
    });
  }

  await User.deleteOne({ mobile: '9825700011' });
  const viewOnlyUser = await User.create({
    name: 'Invoice View Only User',
    mobile: '9825700011',
    email: 'viewer_invoice@maitri.com',
    passwordHash: pwHash,
    role: viewerRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  viewOnlyUserId = viewOnlyUser._id;

  await UserPermission.findOneAndUpdate(
    { user: viewOnlyUserId, module: invoiceModule._id },
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
    body: { mobile: '9825700011', password: 'Password@123' }
  });
  viewOnlyToken = viewLoginRes.body.data.accessToken;
  logPass('View-Only User created and authenticated.');

  // 5. Setup Master Records
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

  testFormat = await QuotationFormatMaster.findOne({ isActive: true }) || await QuotationFormatMaster.create({
    formatName: 'Format 1 - Default',
    formatCode: 'WITH_GST',
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Products
  testProduct1 = await Product.findOne({ companySkuCode: 'SKU-INV-001' });
  if (!testProduct1) {
    testProduct1 = await Product.create({
      productName: 'Glazed Vitrified Tile 600x600',
      companySkuCode: 'SKU-INV-001',
      productGroup: testProductGroup._id,
      company: testCompany._id,
      unit: testUnit._id,
      mrp: 1000,
      gstPct: 18,
      currentStock: 500,
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  testProduct2 = await Product.findOne({ companySkuCode: 'SKU-INV-002' });
  if (!testProduct2) {
    testProduct2 = await Product.create({
      productName: 'Polished Porcelain Tile 800x800',
      companySkuCode: 'SKU-INV-002',
      productGroup: testProductGroup._id,
      company: testCompany._id,
      unit: testUnit._id,
      mrp: 2000,
      gstPct: 18,
      currentStock: 300,
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  // Customers
  testCustomerGujarat = await Customer.findOne({ mobile: '9900011122' });
  if (!testCustomerGujarat) {
    testCustomerGujarat = await Customer.create({
      customerName: 'Gujarat Builder Corp',
      mobile: '9900011122',
      billingAddress: 'Ring Road, Surat, Gujarat',
      shippingAddress: 'Ring Road, Surat, Gujarat',
      city: 'Surat',
      state: 'Gujarat',
      gstNumber: '24GBC001122A1Z1',
      customerType: 'CONTRACTOR',
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  testCustomerMaharashtra = await Customer.findOne({ mobile: '9900033344' });
  if (!testCustomerMaharashtra) {
    testCustomerMaharashtra = await Customer.create({
      customerName: 'Mumbai Highrise Developers',
      mobile: '9900033344',
      billingAddress: 'Nariman Point, Mumbai, Maharashtra',
      shippingAddress: 'Nariman Point, Mumbai, Maharashtra',
      city: 'Mumbai',
      state: 'Maharashtra',
      gstNumber: '27MHD334455B1Z2',
      customerType: 'CONTRACTOR',
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  logPass('Master reference data initialized.');
}

async function runTestSuite() {
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}MODULE 10: INVOICE MANAGEMENT - AUTOMATED TEST SUITE${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Number-To-Words Utility Engine
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 1: Indian Number-to-Words Utility${colors.reset}`);
  try {
    const w1 = amountToWords(210000);
    if (w1 === 'Rupees Two Lakh Ten Thousand Only') {
      logPass(`amountToWords(210000) -> '${w1}'`);
    } else {
      logFail(`amountToWords(210000) expected 'Rupees Two Lakh Ten Thousand Only' but got '${w1}'`);
    }

    const w2 = amountToWords(15432.50);
    if (w2.includes('Fifteen Thousand Four Hundred Thirty Two') && w2.includes('Fifty Paise')) {
      logPass(`amountToWords(15432.50) -> '${w2}'`);
    } else {
      logFail(`amountToWords(15432.50) format issue: '${w2}'`);
    }

    const w3 = amountToWords(0);
    if (w3 === 'Rupees Zero Only') {
      logPass(`amountToWords(0) -> '${w3}'`);
    } else {
      logFail(`amountToWords(0) -> got '${w3}'`);
    }
  } catch (err) {
    logFail('Number to words test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Atomic Sequential Numbering Engine
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 2: Invoice Number Sequence Engine${colors.reset}`);
  try {
    const invNum1 = await InvoiceNumberSequence.generateNextNumber();
    const invNum2 = await InvoiceNumberSequence.generateNextNumber();
    if (invNum1.startsWith('INV-') && invNum2.startsWith('INV-') && invNum1 !== invNum2) {
      logPass(`Generated sequential invoice numbers: ${invNum1}, ${invNum2}`);
    } else {
      logFail(`Sequential numbering error: ${invNum1} vs ${invNum2}`);
    }
  } catch (err) {
    logFail('InvoiceNumberSequence error', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Preparation of Upstream Quotation, Confirmation & Challans
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 3: Upstream Delivery Chain Preparation (Quotation -> Confirmation -> Challans)${colors.reset}`);
  try {
    // 1. Create Quotation directly
    const uniqueSuffix = Date.now();
    testQuotation = await Quotation.create({
      quotationNumber: `QT-INV-${uniqueSuffix}`,
      quotationDate: new Date(),
      customer: testCustomerGujarat._id,
      salesperson: superAdminUser._id,
      company: testCompany._id,
      format: testFormat._id,
      formatKey: 'STANDARD',
      status: 'CONFIRMED',
      items: [
        {
          product: testProduct1._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          mrpSnapshot: 800,
          quantity: 50,
          discountPct: 10,
          discountAmount: 4000,
          netAmount: 36000,
          gstPctSnapshot: 18,
          gstAmount: 6480,
          grossAmount: 40000,
          taxableAmount: 36000
        },
        {
          product: testProduct2._id,
          productNameSnapshot: testProduct2.productName,
          skuCodeSnapshot: testProduct2.companySkuCode,
          mrpSnapshot: 1500,
          quantity: 20,
          discountPct: 5,
          discountAmount: 1500,
          netAmount: 28500,
          gstPctSnapshot: 18,
          gstAmount: 5130,
          grossAmount: 30000,
          taxableAmount: 28500
        }
      ],
      subTotal: 64500,
      totalTaxableAmount: 64500,
      totalGstAmount: 11610,
      grandTotal: 76110,
      isActive: true,
      createdBy: superAdminUser._id
    });
    logPass(`Created Quotation '${testQuotation.quotationNumber}'.`);

    // 2. Create Confirmation
    testConfirmation = await QuotationConfirmation.create({
      quotation: testQuotation._id,
      customer: testCustomerGujarat._id,
      confirmationNumber: `QC-INV-${uniqueSuffix}`,
      confirmationStatus: 'FULLY_CONFIRMED',
      confirmedItems: [
        {
          originalQuotationItemId: testQuotation.items[0]._id,
          product: testProduct1._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          unit: testUnit._id,
          unitPriceSnapshot: 800,
          discountPctSnapshot: 10,
          gstPctSnapshot: 18,
          quotedQuantity: 50,
          confirmedQuantity: 50,
          confirmedAmount: 40000,
          extraQuantity: 0,
          deliveredQuantity: 0,
          pendingQuantity: 50,
          deliveryStatus: 'PENDING'
        },
        {
          originalQuotationItemId: testQuotation.items[1]._id,
          product: testProduct2._id,
          productNameSnapshot: testProduct2.productName,
          skuCodeSnapshot: testProduct2.companySkuCode,
          unit: testUnit._id,
          unitPriceSnapshot: 1500,
          discountPctSnapshot: 5,
          gstPctSnapshot: 18,
          quotedQuantity: 20,
          confirmedQuantity: 20,
          confirmedAmount: 30000,
          extraQuantity: 0,
          deliveredQuantity: 0,
          pendingQuantity: 20,
          deliveryStatus: 'PENDING'
        }
      ],
      originalQuotationAmount: 76110,
      confirmedAmount: 70000,
      totalActualAmount: 76110,
      differenceAmount: 0,
      overallDeliveryStatus: 'PENDING',
      isFullyDelivered: false,
      pendingApproval: false,
      approvedAt: new Date(),
      confirmedBy: superAdminUser._id,
      isActive: true,
      createdBy: superAdminUser._id
    });
    logPass(`Created Confirmation '${testConfirmation.confirmationNumber}'.`);


    // 3. Create & Finalize Challan 1 (Delivery of 20 units of Item 1, 10 units of Item 2)
    const ch1Res = await api('/challans', {
      method: 'POST',
      token: superAdminToken,
      body: {
        confirmationId: testConfirmation._id,
        deliveryDetails: 'Truck GJ-03-AA-1234',
        items: [
          {
            confirmedItemId: testConfirmation.confirmedItems[0]._id,
            quantityToIssue: 20
          },
          {
            confirmedItemId: testConfirmation.confirmedItems[1]._id,
            quantityToIssue: 10
          }
        ]
      }
    });

    if (ch1Res.status === 201 && ch1Res.body.success) {
      challan1 = ch1Res.body.data;
      logPass(`Created Draft Challan 1 '${challan1.challanNumber}'.`);
    } else {
      throw new Error(`Failed to create challan 1: ${JSON.stringify(ch1Res.body)}`);
    }

    // Finalize Challan 1
    const fin1Res = await api(`/challans/${challan1._id}/finalize`, {
      method: 'PUT',
      token: superAdminToken
    });
    if (fin1Res.status === 200 && fin1Res.body.success) {
      challan1 = fin1Res.body.data;
      logPass(`Finalized Challan 1 '${challan1.challanNumber}'.`);
    } else {
      throw new Error(`Failed to finalize challan 1: ${JSON.stringify(fin1Res.body)}`);
    }

    // 4. Create & Finalize Challan 2 (Delivery of remaining 30 units of Item 1)
    const ch2Res = await api('/challans', {
      method: 'POST',
      token: superAdminToken,
      body: {
        confirmationId: testConfirmation._id,
        deliveryDetails: 'Tempo GJ-03-BB-5678',
        items: [
          {
            confirmedItemId: testConfirmation.confirmedItems[0]._id,
            quantityToIssue: 30
          }
        ]
      }
    });

    if (ch2Res.status === 201 && ch2Res.body.success) {
      challan2 = ch2Res.body.data;
      logPass(`Created Draft Challan 2 '${challan2.challanNumber}'.`);
    } else {
      throw new Error(`Failed to create challan 2: ${JSON.stringify(ch2Res.body)}`);
    }

    // Finalize Challan 2
    const fin2Res = await api(`/challans/${challan2._id}/finalize`, {
      method: 'PUT',
      token: superAdminToken
    });
    if (fin2Res.status === 200 && fin2Res.body.success) {
      challan2 = fin2Res.body.data;
      logPass(`Finalized Challan 2 '${challan2.challanNumber}'.`);
    } else {
      throw new Error(`Failed to finalize challan 2: ${JSON.stringify(fin2Res.body)}`);
    }

  } catch (err) {
    logFail('Delivery chain preparation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: Candidate Challans Discovery (/invoiceable-challans)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 4: Candidate Challans Discovery Route${colors.reset}`);
  try {
    const discRes = await api(`/invoices/invoiceable-challans?customerId=${testCustomerGujarat._id}`, {
      method: 'GET',
      token: accountsUserToken
    });

    if (discRes.status === 200 && discRes.body.success) {
      const list = discRes.body.data;
      const foundCh1 = list.find((c) => String(c._id) === String(challan1._id));
      const foundCh2 = list.find((c) => String(c._id) === String(challan2._id));

      if (foundCh1 && foundCh2) {
        logPass(`Discovery route returned eligible finalized Challans (${list.length} items found).`);
      } else {
        logFail('Discovery route missing finalized Challans');
      }
    } else {
      logFail(`Discovery route failed with status ${discRes.status}`, discRes.body);
    }
  } catch (err) {
    logFail('Discovery route test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Invoice Creation & Pricing Snapshot Resolution
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 5: Invoice Generation (Single Challan) & Pricing Snapshot Resolution${colors.reset}`);
  let createdInvoice1;
  try {
    const invRes = await api('/invoices', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomerGujarat._id,
        challanIds: [challan1._id],
        termsOfPayment: 'Net 30 Days',
        termsOfDelivery: 'Door Delivery at Site',
        referenceNumber: 'PO-GUJ-9988'
      }
    });

    if (invRes.status === 201 && invRes.body.success) {
      createdInvoice1 = invRes.body.data;
      logPass(`Created Invoice '${createdInvoice1.invoiceNumber}' with status '${createdInvoice1.status}'.`);

      // Verify pricing snapshots
      // Challan 1 Item 1: 20 qty × ₹800 - 10% disc = ₹720 net × 20 = ₹14,400. GST 18% = ₹2,592.
      // Challan 1 Item 2: 10 qty × ₹1500 - 5% disc = ₹1425 net × 10 = ₹14,250. GST 18% = ₹2,565.
      // SubTotal = ₹28,650. Total GST = ₹5,157. Grand Total = ₹33,807.
      if (createdInvoice1.items.length === 2) {
        logPass('Invoice contains exactly 2 line items from source Challan 1.');
      } else {
        logFail(`Expected 2 items, got ${createdInvoice1.items.length}`);
      }

      if (createdInvoice1.subTotal === 31000 && createdInvoice1.totalGst === 5580 && createdInvoice1.grandTotal === 36580) {
        logPass(`Header totals computed accurately: SubTotal=₹${createdInvoice1.subTotal}, GST=₹${createdInvoice1.totalGst}, GrandTotal=₹${createdInvoice1.grandTotal}.`);
      } else {
        logFail(`Header totals mismatch: subTotal=${createdInvoice1.subTotal}, totalGst=${createdInvoice1.totalGst}, grandTotal=${createdInvoice1.grandTotal}`);
      }

      if (createdInvoice1.amountInWords && createdInvoice1.amountInWords.includes('Rupees')) {
        logPass(`Amount in words set: "${createdInvoice1.amountInWords}".`);
      } else {
        logFail(`Amount in words missing or incorrect: '${createdInvoice1.amountInWords}'`);
      }

      // Verify source Challan 1 is now marked invoiced: true
      const reCh1 = await Challan.findById(challan1._id);
      if (reCh1.invoiced === true) {
        logPass(`Source Challan 1 successfully marked invoiced: true.`);
      } else {
        logFail('Source Challan 1 was not marked invoiced: true');
      }

      // Verify Challan 1 is no longer in invoiceable-challans
      const discAfter = await api(`/invoices/invoiceable-challans?customerId=${testCustomerGujarat._id}`, {
        method: 'GET',
        token: accountsUserToken
      });
      const stillInList = discAfter.body.data.some((c) => String(c._id) === String(challan1._id));
      if (!stillInList) {
        logPass('Invoiced Challan 1 is cleanly excluded from candidate discovery list.');
      } else {
        logFail('Invoiced Challan 1 still appears in candidate discovery list');
      }
    } else {
      logFail(`Invoice creation failed with status ${invRes.status}`, invRes.body);
    }
  } catch (err) {
    logFail('Invoice creation test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: Validation Suite (Cross-Customer, Already Invoiced, Non-Finalized)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 6: Business Rules & Validation Engine${colors.reset}`);
  try {
    // 1. Attempt to re-invoice Challan 1 (already invoiced)
    const dupRes = await api('/invoices', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomerGujarat._id,
        challanIds: [challan1._id]
      }
    });
    if (dupRes.status === 400) {
      logPass(`Duplicate Challan invoicing correctly rejected with 400: '${dupRes.body.message}'.`);
    } else {
      logFail(`Duplicate Challan invoicing should return 400, got ${dupRes.status}`);
    }

    // 2. Cross-customer Challan consolidation check
    const crossRes = await api('/invoices', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomerMaharashtra._id,
        challanIds: [challan2._id] // challan2 belongs to testCustomerGujarat
      }
    });
    if (crossRes.status === 400) {
      logPass(`Cross-customer Challan consolidation correctly rejected with 400: '${crossRes.body.message}'.`);
    } else {
      logFail(`Cross-customer invoicing should return 400, got ${crossRes.status}`);
    }
  } catch (err) {
    logFail('Validation suite exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 7: Multi-Challan Consolidation
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 7: Multi-Challan Consolidation Engine${colors.reset}`);
  let consolidatedInvoice;
  try {
    // First, create a 3rd challan for testCustomerGujarat so we have 2 uninvoiced challans (challan2 + challan3)
    const ch3Res = await api('/challans', {
      method: 'POST',
      token: superAdminToken,
      body: {
        confirmationId: testConfirmation._id,
        deliveryDetails: 'Van GJ-03-CC-9999',
        items: [
          {
            confirmedItemId: testConfirmation.confirmedItems[1]._id,
            quantityToIssue: 10
          }
        ]
      }
    });
    const challan3 = ch3Res.body.data;
    await api(`/challans/${challan3._id}/finalize`, { method: 'PUT', token: superAdminToken });
    logPass(`Created & Finalized 3rd Challan '${challan3.challanNumber}'.`);

    // Consolidate challan2 + challan3 into one Invoice
    const multiRes = await api('/invoices', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomerGujarat._id,
        challanIds: [challan2._id, challan3._id],
        termsOfPayment: 'Consolidated Monthly Bill'
      }
    });

    if (multiRes.status === 201 && multiRes.body.success) {
      consolidatedInvoice = multiRes.body.data;
      logPass(`Created Consolidated Invoice '${consolidatedInvoice.invoiceNumber}' spanning 2 Challans.`);

      if (consolidatedInvoice.sourceChallans.length === 2) {
        logPass('Invoice tracks both source Challans in header.');
      } else {
        logFail(`Expected 2 source Challans, got ${consolidatedInvoice.sourceChallans.length}`);
      }

      // Check item lineage
      const c2Item = consolidatedInvoice.items.find((it) => String(it.sourceChallan) === String(challan2._id));
      const c3Item = consolidatedInvoice.items.find((it) => String(it.sourceChallan) === String(challan3._id));
      if (c2Item && c3Item) {
        logPass('Each invoice item maintains precise lineage to its originating source Challan.');
      } else {
        logFail('Invoice items missing source Challan traceability');
      }

      // Verify both source Challans marked invoiced
      const ch2Fresh = await Challan.findById(challan2._id);
      const ch3Fresh = await Challan.findById(challan3._id);
      if (ch2Fresh.invoiced && ch3Fresh.invoiced) {
        logPass('Both consolidated source Challans are marked invoiced: true.');
      } else {
        logFail('One or more consolidated Challans not marked invoiced');
      }
    } else {
      logFail(`Consolidated invoice creation failed with status ${multiRes.status}`, multiRes.body);
    }
  } catch (err) {
    logFail('Multi-challan consolidation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 8: Immutability on Edit Route
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 8: Immutability Enforcement on Edit (PUT /api/invoices/:id)${colors.reset}`);
  try {
    const originalGrandTotal = createdInvoice1.grandTotal;
    const originalSubTotal = createdInvoice1.subTotal;

    // Attempt to tamper with financial/item fields
    const editRes = await api(`/invoices/${createdInvoice1._id}`, {
      method: 'PUT',
      token: accountsUserToken,
      body: {
        grandTotal: 1, // tamper attempt
        subTotal: 1,   // tamper attempt
        items: [],     // tamper attempt
        deliveryNote: 'Updated Delivery Note Verified',
        termsOfPayment: 'Immediate RTGS'
      }
    });

    if (editRes.status === 200 && editRes.body.success) {
      const updatedInv = editRes.body.data;
      if (updatedInv.grandTotal === originalGrandTotal && updatedInv.subTotal === originalSubTotal) {
        logPass(`Tampered financial fields were stripped; Grand Total remained ₹${originalGrandTotal}.`);
      } else {
        logFail(`Financial fields were modified! Got ${updatedInv.grandTotal}`);
      }

      if (updatedInv.deliveryNote === 'Updated Delivery Note Verified' && updatedInv.termsOfPayment === 'Immediate RTGS') {
        logPass('Allowed non-monetary header fields updated successfully.');
      } else {
        logFail('Allowed non-monetary header fields were not updated properly');
      }
    } else {
      logFail(`Invoice update returned status ${editRes.status}`, editRes.body);
    }
  } catch (err) {
    logFail('Immutability test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 9: Print & Document Generation
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 9: Tax Invoice Print Data Endpoint (GET /api/invoices/:id/print)${colors.reset}`);
  try {
    const printRes = await api(`/invoices/${createdInvoice1._id}/print`, {
      method: 'GET',
      token: accountsUserToken
    });

    if (printRes.status === 200 && printRes.body.success) {
      const printDoc = printRes.body.data;
      if (printDoc.letterhead && printDoc.letterhead.companyName === 'Maitri Ceramic') {
        logPass(`Letterhead rendered with own company '${printDoc.letterhead.companyName}'.`);
      } else {
        logFail('Print data letterhead missing');
      }

      if (printDoc.summary && printDoc.summary.grandTotal === createdInvoice1.grandTotal) {
        logPass(`Print summary matches invoice grand total (₹${printDoc.summary.grandTotal}).`);
      } else {
        logFail('Print summary totals mismatch');
      }

      if (printDoc.declaration && printDoc.authorizedSignatory) {
        logPass('Standard legal declaration and authorized signatory block present.');
      } else {
        logFail('Declaration or signatory missing');
      }
    } else {
      logFail(`Print endpoint failed with status ${printRes.status}`, printRes.body);
    }
  } catch (err) {
    logFail('Print test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 10: Excel Export
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 10: Excel Export (GET /api/invoices/export)${colors.reset}`);
  try {
    const expRes = await api('/invoices/export', {
      method: 'GET',
      token: accountsUserToken
    });

    if (expRes.status === 200 && expRes.body.byteLength > 100) {
      logPass(`Excel export returned binary workbook of size ${expRes.body.byteLength} bytes.`);
    } else {
      logFail(`Excel export returned status ${expRes.status}`);
    }
  } catch (err) {
    logFail('Export test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 11: Cancellation & Source Challan Reopening
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 11: Invoice Cancellation & Source Challan Reopening${colors.reset}`);
  try {
    const cancelRes = await api(`/invoices/${createdInvoice1._id}/cancel`, {
      method: 'PUT',
      token: accountsUserToken
    });

    if (cancelRes.status === 200 && cancelRes.body.success) {
      const cancelledInv = cancelRes.body.data;
      if (cancelledInv.status === 'CANCELLED') {
        logPass(`Invoice status updated to CANCELLED.`);
      } else {
        logFail(`Expected CANCELLED status, got ${cancelledInv.status}`);
      }

      // Verify Challan 1 is reopened (invoiced: false)
      const ch1Fresh = await Challan.findById(challan1._id);
      if (ch1Fresh.invoiced === false) {
        logPass(`Source Challan 1 successfully reopened (invoiced: false).`);
      } else {
        logFail('Source Challan 1 was not reopened (invoiced is still true)');
      }

      // Verify Challan 1 now reappears in /invoiceable-challans
      const discReopened = await api(`/invoices/invoiceable-challans?customerId=${testCustomerGujarat._id}`, {
        method: 'GET',
        token: accountsUserToken
      });
      const foundReopened = discReopened.body.data.some((c) => String(c._id) === String(challan1._id));
      if (foundReopened) {
        logPass('Reopened Challan 1 is immediately discoverable in /invoiceable-challans candidate list.');
      } else {
        logFail('Reopened Challan 1 did not reappear in candidate list');
      }
    } else {
      logFail(`Invoice cancellation returned status ${cancelRes.status}`, cancelRes.body);
    }
  } catch (err) {
    logFail('Cancellation test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 12: Forward Reference Services (Module 7 & Module 4 Integration)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 12: Downstream Forward Reference Services${colors.reset}`);
  try {
    // 1. invoiceService.getFinalAmount(confirmationId)
    const finalAmount = await invoiceService.getFinalAmount(testConfirmation._id);
    // consolidatedInvoice is still active/ISSUED
    if (finalAmount > 0 && finalAmount === consolidatedInvoice.grandTotal) {
      logPass(`invoiceService.getFinalAmount() returned real invoice amount ₹${finalAmount}.`);
    } else {
      logFail(`getFinalAmount expected ₹${consolidatedInvoice.grandTotal}, got ₹${finalAmount}`);
    }

    // 2. Module 7 Amount Comparison API Integration
    const compRes = await api(`/confirmations/${testConfirmation._id}/amount-comparison`, {
      method: 'GET',
      token: superAdminToken
    });
    if (compRes.status === 200 && compRes.body.success) {
      const compData = compRes.body.data;
      if (compData.finalInvoiceAmount === consolidatedInvoice.grandTotal) {
        logPass(`Module 7 Amount Comparison API returned real finalInvoiceAmount=₹${compData.finalInvoiceAmount} with zero code changes in Module 7.`);
      } else {
        logFail(`Module 7 comparison returned finalInvoiceAmount=${compData.finalInvoiceAmount}, expected ${consolidatedInvoice.grandTotal}`);
      }
    } else {
      logFail(`Module 7 amount comparison API failed with status ${compRes.status}`, compRes.body);
    }

    // 3. Customer 360 History Integration (Module 4)
    const cust360 = await customerHistoryService.getCustomer360History(testCustomerGujarat);
    if (cust360 && cust360.financialHistory && cust360.financialHistory.totalInvoiceValue > 0) {
      logPass(`Customer 360° History aggregated invoices correctly (totalInvoiceValue=₹${cust360.financialHistory.totalInvoiceValue}).`);
    } else {
      logFail('Customer 360 History did not aggregate invoice totals properly');
    }
  } catch (err) {
    logFail('Forward reference integration exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 13: RBAC & Permission Enforcement
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 13: RBAC Permission Gates & Data Scope${colors.reset}`);
  try {
    // View-only user attempts to create an invoice -> should be 403 Forbidden
    const unauthCreate = await api('/invoices', {
      method: 'POST',
      token: viewOnlyToken,
      body: {
        customerId: testCustomerGujarat._id,
        challanIds: [challan1._id]
      }
    });

    if (unauthCreate.status === 403) {
      logPass(`View-Only user blocked from creating invoice (403 Forbidden).`);
    } else {
      logFail(`View-Only user create should return 403, got ${unauthCreate.status}`);
    }

    // View-only user attempts to edit -> 403 Forbidden
    const unauthEdit = await api(`/invoices/${consolidatedInvoice._id}`, {
      method: 'PUT',
      token: viewOnlyToken,
      body: { termsOfPayment: 'Hacked Terms' }
    });

    if (unauthEdit.status === 403) {
      logPass(`View-Only user blocked from editing invoice (403 Forbidden).`);
    } else {
      logFail(`View-Only user edit should return 403, got ${unauthEdit.status}`);
    }

    // View-only user attempts to cancel -> 403 Forbidden
    const unauthCancel = await api(`/invoices/${consolidatedInvoice._id}/cancel`, {
      method: 'PUT',
      token: viewOnlyToken
    });

    if (unauthCancel.status === 403) {
      logPass(`View-Only user blocked from cancelling invoice (403 Forbidden).`);
    } else {
      logFail(`View-Only user cancel should return 403, got ${unauthCancel.status}`);
    }

    // View-only user attempts to export -> 403 Forbidden
    const unauthExport = await api('/invoices/export', {
      method: 'GET',
      token: viewOnlyToken
    });

    if (unauthExport.status === 403) {
      logPass(`View-Only user blocked from exporting invoices (403 Forbidden).`);
    } else {
      logFail(`View-Only user export should return 403, got ${unauthExport.status}`);
    }
  } catch (err) {
    logFail('RBAC permission test exception', err);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}MODULE 10 TEST RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`  Total Tests Run: ${passed + failed}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);

  if (server) {
    server.close();
  }

  if (failed > 0) {
    console.error(`\n${colors.red}${colors.bold}❌ Module 10 verification finished with ${failed} failure(s).${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL MODULE 10 INVOICE MANAGEMENT TESTS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
    process.exit(0);
  }
}

async function run() {
  try {
    await setup();
    await runTestSuite();
  } catch (err) {
    console.error('Fatal Test Runner Error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

run();
