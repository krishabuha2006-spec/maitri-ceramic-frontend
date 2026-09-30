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
const ReturnNote = require('../models/ReturnNote');
const LedgerEntry = require('../models/LedgerEntry');
const ledgerService = require('../services/ledger.service');

let server;
let baseUrl;
let superAdminToken;
let superAdminUser;

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
  console.log(`🚀 MAITRI CERAMIC - MODULE 13 VERIFICATION SUITE`);
  console.log(`   (Credit/Debit & Tally-Style Ledger Management)`);
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

  // Step 0: Authentication
  logSection('STEP 0: Super Admin Authentication');
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

  // Step 1: SystemModule Registration
  logSection('STEP 1: SystemModule Registration (CUSTOMER_LEDGER)');
  let ledgerMod = await SystemModule.findOne({ moduleKey: 'CUSTOMER_LEDGER' });
  if (!ledgerMod) {
    ledgerMod = await SystemModule.create({
      moduleKey: 'CUSTOMER_LEDGER',
      moduleName: 'Customer Ledger & Accounts',
      parentModule: 'ACCOUNTS',
      isActive: true
    });
  }
  logPass(`CUSTOMER_LEDGER registered and active in SystemModule registry.`);

  // Step 2: Core postEntry() Unit Logic (Documented Tally-Style Table Verification)
  logSection('STEP 2: Core postEntry() Tally-Style Table Verification');
  const testCustomer = await Customer.create({
    customerName: `Tally Test Customer ${Date.now()}`,
    mobile: `99${Date.now().toString().slice(-8)}`,
    city: 'Morbi',
    state: 'Gujarat',
    customerType: 'RETAIL',
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Client Documented Sequence:
  // 1. Invoice: ₹50,000 -> Running Balance: ₹50,000
  const e1 = await ledgerService.postEntry({
    customerId: testCustomer._id,
    particular: 'Invoice #INV-2026-27-0001',
    entryType: 'DEBIT',
    amount: 50000,
    sourceType: 'INVOICE',
    sourceId: new mongoose.Types.ObjectId(),
    postedBy: superAdminUser._id
  });
  if (e1.runningBalance !== 50000) logFail(`Expected running balance 50000, got ${e1.runningBalance}`);
  logPass('Posted Debit ₹50,000 -> Running Balance = ₹50,000');

  // 2. Payment: ₹30,000 -> Running Balance: ₹20,000
  const e2 = await ledgerService.postEntry({
    customerId: testCustomer._id,
    particular: 'Payment #RCPT-2026-27-0001',
    entryType: 'CREDIT',
    amount: 30000,
    sourceType: 'PAYMENT',
    sourceId: new mongoose.Types.ObjectId(),
    postedBy: superAdminUser._id
  });
  if (e2.runningBalance !== 20000) logFail(`Expected running balance 20000, got ${e2.runningBalance}`);
  logPass('Posted Credit ₹30,000 -> Running Balance = ₹20,000');

  // 3. Invoice: ₹25,000 -> Running Balance: ₹45,000
  const e3 = await ledgerService.postEntry({
    customerId: testCustomer._id,
    particular: 'Invoice #INV-2026-27-0002',
    entryType: 'DEBIT',
    amount: 25000,
    sourceType: 'INVOICE',
    sourceId: new mongoose.Types.ObjectId(),
    postedBy: superAdminUser._id
  });
  if (e3.runningBalance !== 45000) logFail(`Expected running balance 45000, got ${e3.runningBalance}`);
  logPass('Posted Debit ₹25,000 -> Running Balance = ₹45,000');

  // 4. Payment: ₹20,000 -> Running Balance: ₹25,000
  const e4 = await ledgerService.postEntry({
    customerId: testCustomer._id,
    particular: 'Payment #RCPT-2026-27-0002',
    entryType: 'CREDIT',
    amount: 20000,
    sourceType: 'PAYMENT',
    sourceId: new mongoose.Types.ObjectId(),
    postedBy: superAdminUser._id
  });
  if (e4.runningBalance !== 25000) logFail(`Expected running balance 25000, got ${e4.runningBalance}`);
  logPass('Posted Credit ₹20,000 -> Running Balance = ₹25,000 (Exact match with client PRD!)');

  // Step 3: Auto-posting on Invoice Creation (Module 10)
  logSection('STEP 3: Auto-Posting on Invoice Creation (Module 10)');
  const company = (await Company.findOne({ companyType: 'OWN', isActive: true })) || (await Company.create({
    companyName: 'Maitri Ceramic Own',
    companyType: 'OWN',
    brandName: 'Maitri Tiles',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const unit = (await Unit.findOne({ isActive: true })) || (await Unit.create({
    unitName: 'Square Meter',
    unitCode: 'SQM',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const product = (await Product.findOne({ isActive: true })) || (await Product.create({
    productName: 'Ledger Test Vitrified Tile',
    companySkuCode: `SKU-LEDGER-${Date.now().toString().slice(-6)}`,
    company: company._id,
    unit: unit._id,
    mrp: 500,
    salePrice: 400,
    gstPct: 18,
    currentStock: 1000,
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const format = (await QuotationFormat.findOne({ isActive: true })) || (await QuotationFormat.create({
    formatName: 'Standard Tile Format',
    formatType: 'TILES_SQFT',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const autoCust = await Customer.create({
    customerName: `Auto Ledger Customer ${Date.now()}`,
    mobile: `98${Date.now().toString().slice(-8)}`,
    city: 'Ahmedabad',
    state: 'Gujarat',
    customerType: 'RETAIL',
    isActive: true,
    createdBy: superAdminUser._id
  });

  const conf = await QuotationConfirmation.create({
    quotation: new mongoose.Types.ObjectId(),
    customer: autoCust._id,
    confirmationNumber: `CONF-LEDGER-${Date.now().toString().slice(-6)}`,
    confirmationStatus: 'FULLY_CONFIRMED',
    confirmedBy: superAdminUser._id,
    confirmedItems: [{
      product: product._id,
      productNameSnapshot: product.productName,
      skuCodeSnapshot: product.companySkuCode,
      quotedQuantity: 10,
      confirmedQuantity: 10,
      issuedQuantity: 10,
      unitPriceSnapshot: 400,
      gstPctSnapshot: 18,
      confirmedAmount: 4720
    }],
    totalConfirmedAmount: 4720,
    confirmedAmount: 4720,
    isActive: true,
    createdBy: superAdminUser._id
  });

  const challan = await Challan.create({
    challanNumber: `CHL-LEDGER-${Date.now().toString().slice(-6)}`,
    confirmation: conf._id,
    customer: autoCust._id,
    salesperson: superAdminUser._id,
    items: [{
      product: product._id,
      confirmedItem: conf.confirmedItems[0]._id,
      productNameSnapshot: product.productName,
      skuCodeSnapshot: product.companySkuCode,
      quantityToIssue: 10,
      unit: unit._id
    }],
    status: 'FINALIZED',
    invoiced: false,
    isActive: true,
    createdBy: superAdminUser._id
  });

  // Create Invoice via API
  const invRes = await api('/invoices', {
    method: 'POST',
    token: superAdminToken,
    body: {
      customerId: autoCust._id,
      challanIds: [challan._id]
    }
  });

  if (invRes.status !== 201) logFail('Failed to create Invoice via API', invRes.data);
  const createdInvoice = invRes.data.data;
  logPass(`Created Invoice '${createdInvoice.invoiceNumber}' with grandTotal ₹${createdInvoice.grandTotal}.`);

  // Verify Ledger Entry was auto-posted as DEBIT
  const invLedger = await LedgerEntry.findOne({
    customer: autoCust._id,
    sourceType: 'INVOICE',
    sourceId: createdInvoice._id,
    isActive: true
  });
  if (!invLedger) logFail('No auto-posted DEBIT ledger entry found for invoice creation.');
  if (invLedger.entryType !== 'DEBIT') logFail(`Expected DEBIT, got ${invLedger.entryType}`);
  if (invLedger.amount !== createdInvoice.grandTotal) logFail(`Expected amount ${createdInvoice.grandTotal}, got ${invLedger.amount}`);
  logPass(`Verified auto-posted DEBIT LedgerEntry of ₹${invLedger.amount} (runningBalance: ₹${invLedger.runningBalance}).`);

  // Step 4: Auto-posting on Payment Creation & Reversal (Module 11)
  logSection('STEP 4: Auto-Posting on Payment Creation & Reversal (Module 11)');
  const payMode = (await PaymentModeMaster.findOne({ isActive: true })) || (await PaymentModeMaster.create({
    modeName: 'UPI Digital',
    modeCode: 'UPI',
    isActive: true,
    createdBy: superAdminUser._id
  }));

  const payRes = await api('/payments', {
    method: 'POST',
    token: superAdminToken,
    body: {
      customerId: autoCust._id,
      paymentModeId: payMode._id,
      totalAmount: 2000,
      allocations: [{
        invoiceId: createdInvoice._id,
        allocatedAmount: 2000
      }],
      referenceNumber: 'UPI-TEST-123'
    }
  });

  if (payRes.status !== 201) logFail('Failed to record Payment via API', payRes.data);
  const createdPayment = payRes.data.data;
  logPass(`Recorded Payment '${createdPayment.receiptNumber}' of ₹2,000.`);

  // Verify Ledger Entry auto-posted as CREDIT
  const payLedger = await LedgerEntry.findOne({
    customer: autoCust._id,
    sourceType: 'PAYMENT',
    sourceId: createdPayment._id,
    isActive: true
  });
  if (!payLedger) logFail('No auto-posted CREDIT ledger entry found for payment.');
  if (payLedger.entryType !== 'CREDIT') logFail(`Expected CREDIT, got ${payLedger.entryType}`);
  if (payLedger.amount !== 2000) logFail(`Expected amount 2000, got ${payLedger.amount}`);
  logPass(`Verified auto-posted CREDIT LedgerEntry of ₹${payLedger.amount} (runningBalance now ₹${payLedger.runningBalance}).`);

  // Reverse Payment via API
  const revRes = await api(`/payments/${createdPayment._id}/reverse`, {
    method: 'POST',
    token: superAdminToken,
    body: { reason: 'Bounced check test reversal' }
  });

  if (revRes.status !== 200 && revRes.status !== 201) logFail('Failed to reverse Payment via API', revRes.data);
  const reversedPayment = revRes.data.data;
  logPass(`Reversed Payment under receipt '${reversedPayment.receiptNumber}'.`);

  // Verify Ledger Entry auto-posted as DEBIT
  const revLedger = await LedgerEntry.findOne({
    customer: autoCust._id,
    sourceType: 'PAYMENT_REVERSAL',
    sourceId: reversedPayment._id,
    isActive: true
  });
  if (!revLedger) logFail('No auto-posted DEBIT ledger entry found for payment reversal.');
  if (revLedger.entryType !== 'DEBIT') logFail(`Expected DEBIT, got ${revLedger.entryType}`);
  if (revLedger.amount !== 2000) logFail(`Expected amount 2000, got ${revLedger.amount}`);
  logPass(`Verified auto-posted DEBIT LedgerEntry for Payment Reversal (runningBalance restored to ₹${revLedger.runningBalance}).`);

  // Step 5: Auto-posting on Sales Return Confirmation (Module 12)
  logSection('STEP 5: Auto-Posting on Sales Return Confirmation (Module 12)');
  const returnRes = await api('/returns/sales-return', {
    method: 'POST',
    token: superAdminToken,
    body: {
      customerId: autoCust._id,
      invoiceId: createdInvoice._id,
      productId: product._id,
      quantity: 2,
      returnReason: 'Wrong tile shade received'
    }
  });

  if (returnRes.status !== 201) logFail('Failed to create Return Note via API', returnRes.data);
  const createdReturn = returnRes.data.data;
  logPass(`Created DRAFT Sales Return '${createdReturn.returnNoteNumber}'.`);

  // Confirm Sales Return via API
  const confReturnRes = await api(`/returns/${createdReturn._id}/confirm`, {
    method: 'PUT',
    token: superAdminToken,
    body: {}
  });

  if (confReturnRes.status !== 200) logFail('Failed to confirm Sales Return via API', confReturnRes.data);
  const confirmedReturn = confReturnRes.data.data;
  logPass(`Confirmed Sales Return '${confirmedReturn.returnNoteNumber}'.`);

  // Verify Ledger Entry auto-posted as CREDIT
  const returnLedger = await LedgerEntry.findOne({
    customer: autoCust._id,
    sourceType: 'SALES_RETURN',
    sourceId: confirmedReturn._id,
    isActive: true
  });
  if (!returnLedger) logFail('No auto-posted CREDIT ledger entry found for Sales Return.');
  if (returnLedger.entryType !== 'CREDIT') logFail(`Expected CREDIT, got ${returnLedger.entryType}`);
  logPass(`Verified auto-posted CREDIT LedgerEntry of ₹${returnLedger.amount} for Sales Return.`);

  // Step 6: Automated Entry sourceId Validation
  logSection('STEP 6: Automated Entry sourceId Validation');
  try {
    await ledgerService.postEntry({
      customerId: autoCust._id,
      particular: 'Invalid Test Invoice',
      entryType: 'DEBIT',
      amount: 1000,
      sourceType: 'INVOICE',
      sourceId: null, // Should fail Rule 4
      postedBy: superAdminUser._id
    });
    logFail('Automated entry with null sourceId should have been rejected.');
  } catch (err) {
    logPass(`Correctly rejected automated entry with null sourceId: '${err.message}'.`);
  }

  // Step 7: Manual Entry Creation + Double Gate
  logSection('STEP 7: Manual Entry Creation & Double-Gate');
  const manualRes = await api('/ledger/manual-entry', {
    method: 'POST',
    token: superAdminToken,
    body: {
      customerId: autoCust._id,
      entryType: 'CREDIT',
      amount: 500,
      particular: 'Special Goodwill Discount',
      remarks: 'Approved by Director'
    }
  });

  if (manualRes.status !== 201) logFail('Failed to post manual entry', manualRes.data);
  const manualEntry = manualRes.data.data;
  if (manualEntry.sourceType !== 'MANUAL' || manualEntry.sourceId !== null) {
    logFail('Expected sourceType MANUAL and sourceId null');
  }
  logPass(`Posted Manual Entry '${manualEntry.particular}' of ₹500 (sourceType: MANUAL, sourceId: null).`);

  // Step 8: Manual Entry Reversal
  logSection('STEP 8: Manual Entry Reversal Restrictions & Execution');
  // Attempt to reverse automated entry via manual-entry reverse endpoint -> Must Fail
  const illegalRevRes = await api(`/ledger/manual-entry/${invLedger._id}/reverse`, {
    method: 'POST',
    token: superAdminToken,
    body: { reason: 'Illegal attempt to reverse automated entry' }
  });
  if (illegalRevRes.status !== 400) {
    logFail('Reversing an automated entry directly via manual reversal must be rejected with 400.');
  }
  logPass(`Correctly rejected reversing automated entry: '${illegalRevRes.data.message}'.`);

  // Reverse genuine manual entry -> Must Succeed
  const revManualRes = await api(`/ledger/manual-entry/${manualEntry._id}/reverse`, {
    method: 'POST',
    token: superAdminToken,
    body: { reason: 'Discount entered in error' }
  });

  if (revManualRes.status !== 200) logFail('Failed to reverse manual entry', revManualRes.data);
  const revManualEntry = revManualRes.data.data;
  if (revManualEntry.sourceType !== 'MANUAL_REVERSAL' || revManualEntry.entryType !== 'DEBIT') {
    logFail('Expected MANUAL_REVERSAL DEBIT entry');
  }
  logPass(`Successfully reversed manual entry with offsetting MANUAL_REVERSAL DEBIT of ₹${revManualEntry.amount}.`);

  // Step 9: Customer Ledger Read, Current Balance & Statement
  logSection('STEP 9: Customer Ledger Read, Balance & Statement Endpoints');
  const ledgerReadRes = await api(`/ledger/customer/${autoCust._id}`, {
    token: superAdminToken
  });
  if (ledgerReadRes.status !== 200) logFail('Failed to read customer ledger', ledgerReadRes.data);
  const ledgerData = ledgerReadRes.data.data;
  if (!Array.isArray(ledgerData.entries) || ledgerData.entries.length === 0) {
    logFail('Expected non-empty ledger entries array.');
  }
  logPass(`Retrieved customer ledger with ${ledgerData.entries.length} entries.`);

  const balanceRes = await api(`/ledger/customer/${autoCust._id}/current-balance`, {
    token: superAdminToken
  });
  if (balanceRes.status !== 200) logFail('Failed to get current balance', balanceRes.data);
  const balanceData = balanceRes.data.data;
  if (balanceData.currentBalance !== ledgerData.currentBalance) {
    logFail(`Current balance mismatch: ${balanceData.currentBalance} vs ${ledgerData.currentBalance}`);
  }
  logPass(`Retrieved current balance: ₹${balanceData.currentBalance} (asOf: ${balanceData.asOfEntryDate}).`);

  // Statement Endpoint
  const stmtRes = await api(`/ledger/customer/${autoCust._id}/statement`, {
    token: superAdminToken
  });
  if (stmtRes.status !== 200) logFail('Failed to get customer statement', stmtRes.data);
  const stmtData = stmtRes.data.data;
  if (stmtData.closingBalance !== balanceData.currentBalance) {
    logFail(`Statement closing balance mismatch: ${stmtData.closingBalance} vs ${balanceData.currentBalance}`);
  }
  logPass(`Generated customer statement with Opening Balance: ₹${stmtData.openingBalance}, Closing: ₹${stmtData.closingBalance}.`);

  // Zero entries customer balance check
  const emptyCust = await Customer.create({
    customerName: `Zero Ledger Customer ${Date.now()}`,
    mobile: `97${Date.now().toString().slice(-8)}`,
    city: 'Rajkot',
    state: 'Gujarat',
    customerType: 'RETAIL',
    isActive: true,
    createdBy: superAdminUser._id
  });
  const emptyBalRes = await api(`/ledger/customer/${emptyCust._id}/current-balance`, {
    token: superAdminToken
  });
  if (emptyBalRes.data.data.currentBalance !== 0) {
    logFail(`Expected 0 current balance for customer with no entries, got ${emptyBalRes.data.data.currentBalance}`);
  }
  logPass('Customer with zero entries returns currentBalance: 0 gracefully.');

  // Step 10: Module 4 Customer 360° History Integration
  logSection('STEP 10: Module 4 Customer 360° History Integration');
  const historyRes = await api(`/customers/${autoCust._id}/history`, {
    token: superAdminToken
  });
  if (historyRes.status !== 200) logFail('Failed to fetch customer 360 history', historyRes.data);
  const histData = historyRes.data.data;
  if (!histData.financialHistory) {
    logFail('financialHistory missing in customer 360 history payload.');
  }
  logPass(`Module 4 Customer History live: Invoiced ₹${histData.financialHistory.totalInvoiceValue}, Credit ₹${histData.financialHistory.credit}, Debit ₹${histData.financialHistory.debit}, Outstanding ₹${histData.financialHistory.outstanding}.`);

  // Step 11: Export to Excel
  logSection('STEP 11: Customer Statement Export to Excel (.xlsx)');
  const exportRes = await api(`/ledger/export?customerId=${autoCust._id}`, {
    token: superAdminToken
  });
  if (exportRes.status !== 200 || !exportRes.data || exportRes.data.byteLength === 0) {
    logFail('Failed to download Excel statement spreadsheet.');
  }
  logPass(`Successfully downloaded formatted Excel statement workbook (${exportRes.data.byteLength} bytes).`);

  console.log(`\n${colors.green}${colors.bold}====================================================`);
  console.log(`🎉 ALL MODULE 13 (CREDIT/DEBIT & LEDGER) TESTS PASSED! (${passed} Passed, ${failed} Failed)`);
  console.log(`====================================================${colors.reset}\n`);

  server.close(() => process.exit(0));
}

runTests().catch((err) => {
  console.error(`\n${colors.red}❌ MODULE 13 TEST RUNNER FAILED:${colors.reset}`, err);
  if (server) server.close();
  process.exit(1);
});
