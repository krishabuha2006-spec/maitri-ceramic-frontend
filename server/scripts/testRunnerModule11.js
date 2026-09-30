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
const Payment = require('../models/Payment');
const PaymentReceiptNumberSequence = require('../models/PaymentReceiptNumberSequence');
const PaymentModeMaster = require('../models/PaymentModeMaster');
const paymentService = require('../services/payment.service');
const invoiceService = require('../services/invoice.service');
const confirmationService = require('../services/confirmation.service');
const customerHistoryService = require('../services/customerHistory.service');
const { amountToWords } = require('../utils/numberToWords.util');

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;
let accountsUserToken;
let accountsUserId;
let deleteOnlyUserToken;
let deleteOnlyUserId;
let viewOnlyToken;
let viewOnlyUserId;

let testCompany;
let testUnit;
let testProductGroup;
let testFormat;
let testProduct1;
let testCustomer1;
let testCustomer2;
let testPaymentModeCash;
let testPaymentModeBank;
let testQuotation;
let testConfirmation;
let testChallan1;
let testChallan2;
let testInvoice1;
let testInvoice2;

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

  // 2. Ensure SystemModule PAYMENT is registered
  let paymentModule = await SystemModule.findOne({ moduleKey: 'PAYMENT' });
  if (!paymentModule) {
    paymentModule = await SystemModule.create({
      moduleKey: 'PAYMENT',
      moduleName: 'Payment Management',
      parentModule: 'BILLING',
      isActive: true
    });
  }
  logPass('SystemModule `PAYMENT` verified in database.');

  const pwHash = await User.hashPassword('Password@123');

  // 3. Setup Accounts User (with dataScope: 'ALL' and full PAYMENT actions including approve)
  let accountsRole = await Role.findOne({ roleName: 'Accounts User' });
  if (!accountsRole) {
    accountsRole = await Role.create({
      roleName: 'Accounts User',
      description: 'Accounts & Billing Specialist',
      isSystemRole: false
    });
  }

  await User.deleteOne({ mobile: '9825700020' });
  const accountsUser = await User.create({
    name: 'Accounts Manager Pay',
    mobile: '9825700020',
    email: 'accounts.pay@maitri.com',
    passwordHash: pwHash,
    role: accountsRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  accountsUserId = accountsUser._id;

  await UserPermission.findOneAndUpdate(
    { user: accountsUserId, module: paymentModule._id },
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

  let invoiceModule = await SystemModule.findOne({ moduleKey: 'INVOICE' });
  if (invoiceModule) {
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
  }

  const accLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700020', password: 'Password@123' }
  });
  accountsUserToken = accLoginRes.body.data.accessToken;
  logPass('Accounts User (with approve permission) authenticated.');

  // 4. Setup Delete-Only User (holds delete but NOT approve - to test reversal double gate)
  let cashierRole = await Role.findOne({ roleName: 'Cashier' }) || await Role.create({
    roleName: 'Cashier',
    description: 'Cashier Desk',
    isSystemRole: false
  });

  await User.deleteOne({ mobile: '9825700021' });
  const deleteOnlyUser = await User.create({
    name: 'Cashier NoApprove',
    mobile: '9825700021',
    email: 'cashier@maitri.com',
    passwordHash: pwHash,
    role: cashierRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  deleteOnlyUserId = deleteOnlyUser._id;

  await UserPermission.findOneAndUpdate(
    { user: deleteOnlyUserId, module: paymentModule._id },
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

  const delLoginRes = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825700021', password: 'Password@123' }
  });
  deleteOnlyUserToken = delLoginRes.body.data.accessToken;
  logPass('Delete-Only User (without approve) authenticated.');

  // 5. Setup View-Only User
  await User.deleteOne({ mobile: '9825700022' });
  const viewOnlyUser = await User.create({
    name: 'Payment View Only',
    mobile: '9825700022',
    email: 'viewer.pay@maitri.com',
    passwordHash: pwHash,
    role: cashierRole._id,
    isActive: true,
    createdBy: superAdminUser._id
  });
  viewOnlyUserId = viewOnlyUser._id;

  await UserPermission.findOneAndUpdate(
    { user: viewOnlyUserId, module: paymentModule._id },
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
    body: { mobile: '9825700022', password: 'Password@123' }
  });
  viewOnlyToken = viewLoginRes.body.data.accessToken;
  logPass('View-Only User authenticated.');

  // 6. Setup Masters: Company, Unit, Group, Products, Customers, Payment Modes
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

  testPaymentModeCash = await PaymentModeMaster.findOne({
    $or: [{ modeName: 'Cash' }, { modeCode: 'CASH' }]
  });
  if (!testPaymentModeCash) {
    testPaymentModeCash = await PaymentModeMaster.create({
      modeName: 'Cash',
      modeCode: 'CASH',
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  testPaymentModeBank = await PaymentModeMaster.findOne({
    $or: [{ modeName: 'Bank Transfer (NEFT/RTGS)' }, { modeCode: 'BANK_TRANSFER' }, { modeName: /Bank/i }]
  });
  if (!testPaymentModeBank) {
    testPaymentModeBank = await PaymentModeMaster.create({
      modeName: 'Bank Transfer (NEFT/RTGS)',
      modeCode: 'BANK_TRANSFER',
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  testProduct1 = await Product.findOne({ companySkuCode: 'SKU-PAY-001' });
  if (!testProduct1) {
    testProduct1 = await Product.create({
      productName: 'Royal Polish Tile 600x1200',
      companySkuCode: 'SKU-PAY-001',
      productGroup: testProductGroup._id,
      company: testCompany._id,
      unit: testUnit._id,
      mrp: 1000,
      gstPct: 18,
      currentStock: 1000,
      isActive: true,
      createdBy: superAdminUser._id
    });
  }

  const uniqueSuffix = Date.now().toString().slice(-6);
  testCustomer1 = await Customer.create({
    customerName: `Shreeji Developers ${uniqueSuffix}`,
    mobile: `99${uniqueSuffix}${Math.floor(10 + Math.random() * 90)}`,
    billingAddress: 'GIDC, Rajkot, Gujarat',
    shippingAddress: 'GIDC, Rajkot, Gujarat',
    city: 'Rajkot',
    state: 'Gujarat',
    gstNumber: '24SD001122A1Z1',
    customerType: 'CONTRACTOR',
    isActive: true,
    createdBy: superAdminUser._id
  });

  testCustomer2 = await Customer.create({
    customerName: `Baroda Infra Projects ${uniqueSuffix}`,
    mobile: `98${uniqueSuffix}${Math.floor(10 + Math.random() * 90)}`,
    billingAddress: 'Alkapuri, Vadodara, Gujarat',
    shippingAddress: 'Alkapuri, Vadodara, Gujarat',
    city: 'Vadodara',
    state: 'Gujarat',
    gstNumber: '24BIP556677A1Z9',
    customerType: 'CONTRACTOR',
    isActive: true,
    createdBy: superAdminUser._id
  });

  logPass('Master reference data & payment modes initialized.');
}

async function runTestSuite() {
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}MODULE 11: PAYMENT MANAGEMENT - AUTOMATED TEST SUITE${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);

  // ---------------------------------------------------------------------------
  // TEST SUITE 1: Receipt Number Sequence Engine
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 1: Receipt Number Sequence Engine${colors.reset}`);
  try {
    const rcpt1 = await PaymentReceiptNumberSequence.generateNextNumber();
    const rcpt2 = await PaymentReceiptNumberSequence.generateNextNumber();
    if (rcpt1.startsWith('RCPT-') && rcpt2.startsWith('RCPT-') && rcpt1 !== rcpt2) {
      logPass(`Atomic sequential receipt numbers generated: ${rcpt1} -> ${rcpt2}`);
    } else {
      logFail(`Sequential receipt numbering issue: ${rcpt1} vs ${rcpt2}`);
    }
  } catch (err) {
    logFail('PaymentReceiptNumberSequence test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 2: Setup Upstream Invoices (Client's Documented Example: ₹1,00,000)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 2: Upstream Invoices Preparation (Invoice 1 = ₹1,00,000, Invoice 2 = ₹50,000)${colors.reset}`);
  try {
    const uniqueSuffix = Date.now();

    // Confirmation
    testConfirmation = await QuotationConfirmation.create({
      quotation: new mongoose.Types.ObjectId(),
      customer: testCustomer1._id,
      confirmationNumber: `QC-PAY-${uniqueSuffix}`,
      confirmationStatus: 'FULLY_CONFIRMED',
      confirmedItems: [
        {
          product: testProduct1._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          unit: testUnit._id,
          unitPriceSnapshot: 1000,
          discountPctSnapshot: 0,
          gstPctSnapshot: 0,
          quotedQuantity: 150,
          confirmedQuantity: 150,
          confirmedAmount: 150000,
          deliveredQuantity: 150,
          pendingQuantity: 0
        }
      ],
      originalQuotationAmount: 150000,
      confirmedAmount: 150000,
      totalActualAmount: 150000,
      differenceAmount: 0,
      isFullyDelivered: true,
      pendingApproval: false,
      confirmedBy: superAdminUser._id,
      isActive: true,
      createdBy: superAdminUser._id
    });

    // Challans
    testChallan1 = await Challan.create({
      challanNumber: `CH-PAY-1-${uniqueSuffix}`,
      customer: testCustomer1._id,
      confirmation: testConfirmation._id,
      salesperson: superAdminUser._id,
      status: 'FINALIZED',
      invoiced: true,
      items: [
        {
          confirmedItem: testConfirmation.confirmedItems[0]._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          unit: testUnit._id,
          quantityToIssue: 100
        }
      ],
      isActive: true,
      createdBy: superAdminUser._id
    });

    testChallan2 = await Challan.create({
      challanNumber: `CH-PAY-2-${uniqueSuffix}`,
      customer: testCustomer1._id,
      confirmation: testConfirmation._id,
      salesperson: superAdminUser._id,
      status: 'FINALIZED',
      invoiced: true,
      items: [
        {
          confirmedItem: testConfirmation.confirmedItems[0]._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          unit: testUnit._id,
          quantityToIssue: 50
        }
      ],
      isActive: true,
      createdBy: superAdminUser._id
    });

    // Invoice 1: Exactly ₹1,00,000 (Client documented example)
    testInvoice1 = await Invoice.create({
      invoiceNumber: `INV-PAY-1-${uniqueSuffix}`,
      invoiceDate: new Date(),
      customer: testCustomer1._id,
      consigneeShipTo: testCustomer1.shippingAddress,
      buyerBillTo: testCustomer1.customerName,
      customerMobile: testCustomer1.mobile,
      customerAddress: testCustomer1.billingAddress,
      customerGstNumber: testCustomer1.gstNumber,
      sourceChallans: [testChallan1._id],
      sourceConfirmations: [testConfirmation._id],
      items: [
        {
          sourceChallan: testChallan1._id,
          sourceChallanItemId: testChallan1.items[0]._id,
          product: testProduct1._id,
          skuCodeSnapshot: testProduct1.companySkuCode,
          descriptionSnapshot: testProduct1.productName,
          unit: testUnit._id,
          quantity: 100,
          rateSnapshot: 1000,
          discountPct: 0,
          gstPctSnapshot: 0,
          amount: 100000,
          discountAmount: 0,
          netAmount: 100000,
          gstAmount: 0
        }
      ],
      subTotal: 100000,
      totalGst: 0,
      grandTotal: 100000,
      amountInWords: 'Rupees One Lakh Only',
      status: 'ISSUED',
      isActive: true,
      createdBy: superAdminUser._id
    });
    logPass(`Created Invoice 1: '${testInvoice1.invoiceNumber}' (Grand Total: ₹1,00,000).`);

    // Invoice 2: ₹50,000
    testInvoice2 = await Invoice.create({
      invoiceNumber: `INV-PAY-2-${uniqueSuffix}`,
      invoiceDate: new Date(),
      customer: testCustomer1._id,
      consigneeShipTo: testCustomer1.shippingAddress,
      buyerBillTo: testCustomer1.customerName,
      customerMobile: testCustomer1.mobile,
      customerAddress: testCustomer1.billingAddress,
      customerGstNumber: testCustomer1.gstNumber,
      sourceChallans: [testChallan2._id],
      sourceConfirmations: [testConfirmation._id],
      items: [
        {
          sourceChallan: testChallan2._id,
          sourceChallanItemId: testChallan2.items[0]._id,
          product: testProduct1._id,
          skuCodeSnapshot: testProduct1.companySkuCode,
          descriptionSnapshot: testProduct1.productName,
          unit: testUnit._id,
          quantity: 50,
          rateSnapshot: 1000,
          discountPct: 0,
          gstPctSnapshot: 0,
          amount: 50000,
          discountAmount: 0,
          netAmount: 50000,
          gstAmount: 0
        }
      ],
      subTotal: 50000,
      totalGst: 0,
      grandTotal: 50000,
      amountInWords: 'Rupees Fifty Thousand Only',
      status: 'ISSUED',
      isActive: true,
      createdBy: superAdminUser._id
    });
    logPass(`Created Invoice 2: '${testInvoice2.invoiceNumber}' (Grand Total: ₹50,000).`);

  } catch (err) {
    logFail('Invoice preparation exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 3: Initial Live Balance Due (Zero Payments State)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 3: Initial Live Balance Due (Zero Payments State)${colors.reset}`);
  try {
    const bal1 = await paymentService.getBalanceDue(testInvoice1._id);
    if (bal1.grandTotal === 100000 && bal1.paymentReceived === 0 && bal1.balanceDue === 100000) {
      logPass(`Invoice 1 initial balance due is full grandTotal: ₹${bal1.balanceDue}.`);
    } else {
      logFail(`Invoice 1 initial balance mismatch: got ${bal1.balanceDue}`);
    }

    const hasPay = await paymentService.hasPayments(testInvoice1._id);
    if (hasPay === false) {
      logPass(`paymentService.hasPayments(invoice1) correctly returns false when zero payments exist.`);
    } else {
      logFail('hasPayments returned true when zero payments exist');
    }
  } catch (err) {
    logFail('Initial balance test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 4: Single Invoice Payment (Client's Example: ₹70,000 against ₹1,00,000)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 4: Single Invoice Payment Recording (₹70,000 against ₹1,00,000)${colors.reset}`);
  let payment1;
  try {
    const payRes = await api('/payments', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomer1._id,
        paymentModeId: testPaymentModeBank._id,
        totalAmount: 70000,
        referenceNumber: 'NEFT-AXIS-998877',
        bankCashAccount: 'HDFC Bank Morbi Branch',
        remarks: 'Part payment for floor tiles',
        allocations: [
          {
            invoiceId: testInvoice1._id,
            allocatedAmount: 70000
          }
        ]
      }
    });

    if (payRes.status === 201 && payRes.body.success) {
      payment1 = payRes.body.data;
      logPass(`Recorded Payment 1: Receipt '${payment1.receiptNumber}' of ₹${payment1.totalAmount}.`);

      // Verify Live Balance Due: ₹1,00,000 - ₹70,000 = ₹30,000
      const liveBal1 = await paymentService.getBalanceDue(testInvoice1._id);
      if (liveBal1.paymentReceived === 70000 && liveBal1.balanceDue === 30000) {
        logPass(`Invoice 1 live balance due reduced to exact client formula: ₹1,00,000 − ₹70,000 = ₹${liveBal1.balanceDue}.`);
      } else {
        logFail(`Live balance mismatch: paymentReceived=${liveBal1.paymentReceived}, balanceDue=${liveBal1.balanceDue}`);
      }

      // Check via GET /api/payments/invoice/:id/balance-due
      const balApiRes = await api(`/payments/invoice/${testInvoice1._id}/balance-due`, {
        method: 'GET',
        token: accountsUserToken
      });
      if (balApiRes.status === 200 && balApiRes.body.data.balanceDue === 30000) {
        logPass(`GET /api/payments/invoice/:id/balance-due returned live ₹${balApiRes.body.data.balanceDue}.`);
      } else {
        logFail('Invoice balance-due API endpoint returned mismatch');
      }

      // Check via GET /api/invoices/:id/balance-due
      const invBalRes = await api(`/invoices/${testInvoice1._id}/balance-due`, {
        method: 'GET',
        token: accountsUserToken
      });
      if (invBalRes.status === 200 && invBalRes.body.data.balanceDue === 30000) {
        logPass(`GET /api/invoices/:id/balance-due returned live ₹${invBalRes.body.data.balanceDue}.`);
      } else {
        logFail('Invoice route balance-due endpoint returned mismatch');
      }
    } else {
      logFail(`Payment 1 creation failed with status ${payRes.status}`, payRes.body);
    }
  } catch (err) {
    logFail('Single payment test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 5: Module 10 Invoice Cancellation Gate Protection
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 5: Module 10 Cancellation Gate Protection (Invoice with Payment)${colors.reset}`);
  try {
    const cancelRes = await api(`/invoices/${testInvoice1._id}/cancel`, {
      method: 'PUT',
      token: superAdminToken
    });

    if (cancelRes.status === 400) {
      logPass(`Module 10 invoice cancellation correctly BLOCKED with 400: '${cancelRes.body.message}'.`);
    } else {
      logFail(`Module 10 cancellation should be blocked, got ${cancelRes.status}`);
    }
  } catch (err) {
    logFail('Cancellation gate test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 6: Validation Suite (Over-allocation, Mismatch, Cross-Customer, Cancelled)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 6: Business Rules & Validation Engine${colors.reset}`);
  try {
    // 1. Over-allocation check (Attempting to allocate ₹40,000 when only ₹30,000 remains)
    const overRes = await api('/payments', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomer1._id,
        paymentModeId: testPaymentModeCash._id,
        totalAmount: 40000,
        allocations: [{ invoiceId: testInvoice1._id, allocatedAmount: 40000 }]
      }
    });
    if (overRes.status === 400) {
      logPass(`Over-allocation payment (₹40,000 > ₹30,000 balance) correctly rejected with 400: '${overRes.body.message}'.`);
    } else {
      logFail(`Over-allocation should return 400, got ${overRes.status}`);
    }

    // 2. Mismatched sum(allocations) !== totalAmount
    const mismatchRes = await api('/payments', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomer1._id,
        paymentModeId: testPaymentModeCash._id,
        totalAmount: 30000,
        allocations: [{ invoiceId: testInvoice1._id, allocatedAmount: 20000 }] // sum = 20000 !== 30000
      }
    });
    if (mismatchRes.status === 400) {
      logPass(`Allocation sum mismatch correctly rejected with 400: '${mismatchRes.body.message}'.`);
    } else {
      logFail(`Allocation sum mismatch should return 400, got ${mismatchRes.status}`);
    }

    // 3. Cross-customer invoice allocation check
    const crossRes = await api('/payments', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomer2._id, // customer 2
        paymentModeId: testPaymentModeCash._id,
        totalAmount: 20000,
        allocations: [{ invoiceId: testInvoice1._id, allocatedAmount: 20000 }] // invoice 1 belongs to customer 1
      }
    });
    if (crossRes.status === 400) {
      logPass(`Cross-customer invoice allocation correctly rejected with 400: '${crossRes.body.message}'.`);
    } else {
      logFail(`Cross-customer allocation should return 400, got ${crossRes.status}`);
    }
  } catch (err) {
    logFail('Validation suite exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 7: Multi-Invoice Payment Allocation
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 7: Multi-Invoice Payment Allocation (₹30,000 to Inv 1 + ₹20,000 to Inv 2 = ₹50,000)${colors.reset}`);
  let payment2;
  try {
    const multiPayRes = await api('/payments', {
      method: 'POST',
      token: accountsUserToken,
      body: {
        customerId: testCustomer1._id,
        paymentModeId: testPaymentModeBank._id,
        totalAmount: 50000,
        referenceNumber: 'RTGS-SBI-112233',
        bankCashAccount: 'SBI Morbi',
        remarks: 'Settling Invoice 1 remaining balance + partial on Invoice 2',
        allocations: [
          { invoiceId: testInvoice1._id, allocatedAmount: 30000 },
          { invoiceId: testInvoice2._id, allocatedAmount: 20000 }
        ]
      }
    });

    if (multiPayRes.status === 201 && multiPayRes.body.success) {
      payment2 = multiPayRes.body.data;
      logPass(`Recorded Multi-Invoice Payment 2: Receipt '${payment2.receiptNumber}' of ₹${payment2.totalAmount}.`);

      // Verify Invoice 1 balance is now 0 (Fully Paid)
      const b1 = await paymentService.getBalanceDue(testInvoice1._id);
      if (b1.paymentReceived === 100000 && b1.balanceDue === 0) {
        logPass(`Invoice 1 is now FULLY PAID: paymentReceived=₹1,00,000, balanceDue=₹0.`);
      } else {
        logFail(`Invoice 1 balance mismatch after final allocation: balanceDue=${b1.balanceDue}`);
      }

      // Verify Invoice 2 balance is now ₹30,000 (₹50,000 - ₹20,000)
      const b2 = await paymentService.getBalanceDue(testInvoice2._id);
      if (b2.paymentReceived === 20000 && b2.balanceDue === 30000) {
        logPass(`Invoice 2 balance due correctly reduced: ₹50,000 − ₹20,000 = ₹${b2.balanceDue}.`);
      } else {
        logFail(`Invoice 2 balance mismatch: got ${b2.balanceDue}`);
      }
    } else {
      logFail(`Multi-invoice payment failed with status ${multiPayRes.status}`, multiPayRes.body);
    }
  } catch (err) {
    logFail('Multi-invoice payment exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 8: Customer-Level Outstanding Aggregation
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 8: Customer-Level Outstanding Aggregation${colors.reset}`);
  try {
    const custOutRes = await api(`/payments/customer/${testCustomer1._id}/outstanding`, {
      method: 'GET',
      token: accountsUserToken
    });

    if (custOutRes.status === 200 && custOutRes.body.success) {
      const summary = custOutRes.body.data;
      // Total Invoiced = ₹1,00,000 + ₹50,000 = ₹1,50,000
      // Total Paid = ₹70,000 + ₹50,000 = ₹1,20,000
      // Outstanding = ₹30,000
      if (summary.totalInvoiced === 150000 && summary.totalPaid === 120000 && summary.totalOutstanding === 30000) {
        logPass(`Customer 1 outstanding summary matches live totals: Invoiced=₹${summary.totalInvoiced}, Paid=₹${summary.totalPaid}, Outstanding=₹${summary.totalOutstanding}.`);
      } else {
        logFail(`Customer summary mismatch: Invoiced=${summary.totalInvoiced}, Paid=${summary.totalPaid}, Outstanding=${summary.totalOutstanding}`);
      }
    } else {
      logFail(`Customer outstanding endpoint failed with status ${custOutRes.status}`, custOutRes.body);
    }
  } catch (err) {
    logFail('Customer outstanding exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 9: Immutability on Edit Route
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 9: Immutability Enforcement on Edit (PUT /api/payments/:id)${colors.reset}`);
  try {
    const origTotal = payment1.totalAmount;

    // Attempt to edit monetary amount or allocations
    const editRes = await api(`/payments/${payment1._id}`, {
      method: 'PUT',
      token: accountsUserToken,
      body: {
        totalAmount: 1,      // tamper attempt
        allocations: [],     // tamper attempt
        referenceNumber: 'UPDATED-NEFT-REF-99',
        remarks: 'Updated non-monetary remarks verified'
      }
    });

    if (editRes.status === 200 && editRes.body.success) {
      const updatedP = editRes.body.data;
      const freshP = await Payment.findById(payment1._id);

      if (freshP.totalAmount === origTotal && freshP.allocations.length === 1) {
        logPass(`Tampered financial fields stripped; totalAmount remained ₹${origTotal}.`);
      } else {
        logFail(`Payment total amount was modified! Got ${freshP.totalAmount}`);
      }

      if (updatedP.referenceNumber === 'UPDATED-NEFT-REF-99' && updatedP.remarks === 'Updated non-monetary remarks verified') {
        logPass('Allowed non-monetary metadata fields updated successfully.');
      } else {
        logFail('Allowed metadata fields were not updated');
      }
    } else {
      logFail(`Payment edit returned status ${editRes.status}`, editRes.body);
    }
  } catch (err) {
    logFail('Payment immutability test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 10: Payment Receipt Rendering
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 10: Payment Receipt Generation (GET /api/payments/:id/receipt)${colors.reset}`);
  try {
    const rcptRes = await api(`/payments/${payment2._id}/receipt`, {
      method: 'GET',
      token: accountsUserToken
    });

    if (rcptRes.status === 200 && rcptRes.body.success) {
      const rData = rcptRes.body.data;
      if (rData.letterhead && rData.letterhead.companyName === 'Maitri Ceramic') {
        logPass(`Receipt letterhead contains own company '${rData.letterhead.companyName}'.`);
      } else {
        logFail('Receipt missing letterhead');
      }

      if (rData.receipt.allocations && rData.receipt.allocations.length === 2) {
        logPass(`Multi-invoice receipt properly lists both allocated invoices (${rData.receipt.allocations.length} entries).`);
      } else {
        logFail(`Receipt allocations count mismatch: got ${rData.receipt.allocations.length}`);
      }

      if (rData.receipt.amountInWords && rData.receipt.amountInWords.includes('Rupees Fifty Thousand Only')) {
        logPass(`Receipt amount in words verified: "${rData.receipt.amountInWords}".`);
      } else {
        logFail(`Receipt amount in words mismatch: '${rData.receipt.amountInWords}'`);
      }
    } else {
      logFail(`Receipt generation failed with status ${rcptRes.status}`, rcptRes.body);
    }
  } catch (err) {
    logFail('Receipt test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 11: Reversal Flow & Double Permission Gate
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 11: Reversal Ledger Flow & Double Permission Gate${colors.reset}`);
  try {
    // 1. Attempt reversal with user lacking 'approve' permission -> 403 Forbidden
    const unapprovedRev = await api(`/payments/${payment1._id}/reverse`, {
      method: 'POST',
      token: deleteOnlyUserToken, // holds delete, but NOT approve
      body: { reason: 'Wrong account deposit' }
    });

    if (unapprovedRev.status === 403) {
      logPass(`User without PAYMENT:approve permission is blocked from reversing payment (403 Forbidden).`);
    } else {
      logFail(`Reversal without approve permission should return 403, got ${unapprovedRev.status}`);
    }

    // 2. Successful Reversal with Accounts User (holds both delete AND approve)
    const revRes = await api(`/payments/${payment1._id}/reverse`, {
      method: 'POST',
      token: accountsUserToken,
      body: { reason: 'Customer requested NEFT reversal due to wrong transaction' }
    });

    if (revRes.status === 201 && revRes.body.success) {
      const reversalDoc = revRes.body.data;
      logPass(`Reversal executed successfully: Generated Reversal Receipt '${reversalDoc.receiptNumber}' (entryType: '${reversalDoc.entryType}').`);

      // Verify original payment row is untouched
      const originalFresh = await Payment.findById(payment1._id);
      if (originalFresh.entryType === 'PAYMENT' && originalFresh.totalAmount === 70000) {
        logPass('Original Payment record is preserved untouched in the append-only ledger.');
      } else {
        logFail('Original payment record was altered!');
      }

      // Verify live balance of Invoice 1 after reversing Payment 1 (₹70,000 reversed):
      // Invoice 1: Grand Total = ₹1,00,000. Payment 1 (₹70,000 reversed = 0). Payment 2 allocated ₹30,000.
      // Net paid against Invoice 1 is now ₹30,000, so balanceDue jumps back to ₹70,000!
      const b1Reversed = await paymentService.getBalanceDue(testInvoice1._id);
      if (b1Reversed.paymentReceived === 30000 && b1Reversed.balanceDue === 70000) {
        logPass(`Invoice 1 live balance due correctly restored: paymentReceived=₹30,000, balanceDue=₹70,000.`);
      } else {
        logFail(`Invoice 1 balance after reversal mismatch: paymentReceived=${b1Reversed.paymentReceived}, balanceDue=${b1Reversed.balanceDue}`);
      }

      // 3. Attempt to reverse the same payment a second time -> should be rejected with 400
      const dupRevRes = await api(`/payments/${payment1._id}/reverse`, {
        method: 'POST',
        token: accountsUserToken,
        body: { reason: 'Duplicate reversal attempt' }
      });
      if (dupRevRes.status === 400) {
        logPass(`Duplicate reversal attempt correctly rejected with 400: '${dupRevRes.body.message}'.`);
      } else {
        logFail(`Duplicate reversal should return 400, got ${dupRevRes.status}`);
      }
    } else {
      logFail(`Reversal failed with status ${revRes.status}`, revRes.body);
    }
  } catch (err) {
    logFail('Reversal test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 12: Downstream Forward Reference Services (Module 7 & Module 4 Integration)
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 12: Downstream Forward References (Module 7 & Module 4 Integration)${colors.reset}`);
  try {
    // 1. paymentService.getReceivedAmount(confirmationId)
    // Invoices for confirmation: Inv 1 net paid ₹30,000 + Inv 2 net paid ₹20,000 = ₹50,000 total
    const recAmt = await paymentService.getReceivedAmount(testConfirmation._id);
    if (recAmt === 50000) {
      logPass(`paymentService.getReceivedAmount() returned exact live sum ₹${recAmt}.`);
    } else {
      logFail(`getReceivedAmount expected 50000, got ${recAmt}`);
    }

    // 2. Module 7 Amount Comparison API
    const compRes = await api(`/confirmations/${testConfirmation._id}/amount-comparison`, {
      method: 'GET',
      token: superAdminToken
    });
    if (compRes.status === 200 && compRes.body.success) {
      const comp = compRes.body.data;
      if (comp.paymentReceived === 50000 && comp.outstandingAmount === 100000) {
        logPass(`Module 7 Amount Comparison API shows real live paymentReceived=₹${comp.paymentReceived} and outstandingAmount=₹${comp.outstandingAmount}.`);
      } else {
        logFail(`Module 7 comparison figures mismatch: received=${comp.paymentReceived}, outstanding=${comp.outstandingAmount}`);
      }
    } else {
      logFail(`Module 7 comparison API failed with status ${compRes.status}`, compRes.body);
    }

    // 3. Customer 360 History (Module 4)
    const cust360 = await customerHistoryService.getCustomer360History(testCustomer1);
    if (cust360 && cust360.financialHistory && cust360.financialHistory.totalPaymentReceived === 50000) {
      logPass(`Customer 360° History correctly aggregated live payments (totalPaymentReceived=₹${cust360.financialHistory.totalPaymentReceived}).`);
    } else {
      logFail('Customer 360 History did not aggregate totalPaymentReceived properly');
    }
  } catch (err) {
    logFail('Forward reference integration exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 13: Excel Export
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 13: Excel Export (GET /api/payments/export)${colors.reset}`);
  try {
    const expRes = await api('/payments/export', {
      method: 'GET',
      token: accountsUserToken
    });

    if (expRes.status === 200 && expRes.body.byteLength > 100) {
      logPass(`Payments Excel export generated valid binary stream (${expRes.body.byteLength} bytes).`);
    } else {
      logFail(`Export returned status ${expRes.status}`);
    }
  } catch (err) {
    logFail('Excel export test exception', err);
  }

  // ---------------------------------------------------------------------------
  // TEST SUITE 14: RBAC Permissions & Data Scope
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.bold}TEST SUITE 14: RBAC Permission Gates & Data Scope${colors.reset}`);
  try {
    // View-only user attempts to create payment -> 403 Forbidden
    const unauthCreate = await api('/payments', {
      method: 'POST',
      token: viewOnlyToken,
      body: {
        customerId: testCustomer1._id,
        paymentModeId: testPaymentModeCash._id,
        totalAmount: 1000,
        allocations: [{ invoiceId: testInvoice2._id, allocatedAmount: 1000 }]
      }
    });
    if (unauthCreate.status === 403) {
      logPass(`View-Only user blocked from creating payments (403 Forbidden).`);
    } else {
      logFail(`View-Only user create should return 403, got ${unauthCreate.status}`);
    }

    // View-only user attempts to edit -> 403 Forbidden
    const unauthEdit = await api(`/payments/${payment2._id}`, {
      method: 'PUT',
      token: viewOnlyToken,
      body: { remarks: 'Hacked' }
    });
    if (unauthEdit.status === 403) {
      logPass(`View-Only user blocked from editing payments (403 Forbidden).`);
    } else {
      logFail(`View-Only user edit should return 403, got ${unauthEdit.status}`);
    }

    // View-only user attempts to reverse -> 403 Forbidden
    const unauthRev = await api(`/payments/${payment2._id}/reverse`, {
      method: 'POST',
      token: viewOnlyToken,
      body: { reason: 'Unauthorized reversal' }
    });
    if (unauthRev.status === 403) {
      logPass(`View-Only user blocked from reversing payments (403 Forbidden).`);
    } else {
      logFail(`View-Only user reverse should return 403, got ${unauthRev.status}`);
    }

    // View-only user attempts to export -> 403 Forbidden
    const unauthExp = await api('/payments/export', {
      method: 'GET',
      token: viewOnlyToken
    });
    if (unauthExp.status === 403) {
      logPass(`View-Only user blocked from exporting payments (403 Forbidden).`);
    } else {
      logFail(`View-Only user export should return 403, got ${unauthExp.status}`);
    }
  } catch (err) {
    logFail('RBAC permission test exception', err);
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log(`\n${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}MODULE 11 TEST RESULTS SUMMARY${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}====================================================${colors.reset}`);
  console.log(`  Total Tests Run: ${passed + failed}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);

  if (server) {
    server.close();
  }

  if (failed > 0) {
    console.error(`\n${colors.red}${colors.bold}❌ Module 11 verification finished with ${failed} failure(s).${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bold}🎉 ALL MODULE 11 PAYMENT MANAGEMENT TESTS PASSED WITH 100% SUCCESS!${colors.reset}\n`);
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
