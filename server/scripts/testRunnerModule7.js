const http = require('http');
const connectDB = require('../config/db');
const app = require('../server');
const SystemModule = require('../models/SystemModule');
const User = require('../models/User');
const Role = require('../models/Role');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const UnitMaster = require('../models/UnitMaster');
const TaxMaster = require('../models/TaxMaster');
const Company = require('../models/Company');
const Quotation = require('../models/Quotation');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const QuotationConfirmation = require('../models/QuotationConfirmation');
const confirmationService = require('../services/confirmation.service');

let server;
let baseUrl;
let superAdminToken;
let salesUserToken;
let salesUserId;
let managerUserToken;
let managerUserId;
let viewOnlyToken;
let viewOnlyUserId;
let testCustomer;
let testProduct1;
let testProduct2;
let testExtraProduct;
let testFormat;
let testQuotation1;
let testQuotation2;

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

  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    return { status: res.status, data };
  } else {
    const buffer = await res.arrayBuffer();
    return { status: res.status, buffer, contentType };
  }
}

async function run() {
  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}  MAITRI CERAMIC - MODULE 7: QUOTATION CONFIRMATION TEST SUITE          ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api`;
  console.log(`📡 Test server running on http://localhost:${port}\n`);

  try {
    // =========================================================================
    // STEP 0: System Module Seed & QUOTATION_CONFIRMATION Registration
    // =========================================================================
    console.log(`${colors.bold}► STEP 0: System Module Seed & QUOTATION_CONFIRMATION Registration${colors.reset}`);
    const seedRes = await api('/permissions/modules/seed', { method: 'POST' });
    if (seedRes.status === 200) {
      const confMod = await SystemModule.findOne({ moduleKey: 'QUOTATION_CONFIRMATION' });
      if (confMod) {
        logPass('QUOTATION_CONFIRMATION moduleKey successfully registered in SystemModule registry');
      } else {
        logFail('QUOTATION_CONFIRMATION moduleKey missing in SystemModule registry');
      }
    } else {
      logFail('Failed to seed system modules', seedRes.data);
    }

    // =========================================================================
    // STEP 1: Authentication & User Setup (SuperAdmin + Sales Exec + Manager + ViewOnly)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 1: Super Admin & Role-Gated Users Authentication${colors.reset}`);
    const superAdminPassword = process.env.ADMIN_PASSWORD || 'Laksh@2508';
    const adminLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { mobile: '9825702369', password: superAdminPassword }
    });

    if (adminLoginRes.status === 200 && adminLoginRes.data.data?.accessToken) {
      superAdminToken = adminLoginRes.data.data.accessToken;
      logPass('Super Admin authenticated successfully via login');
    } else {
      logFail('Super Admin login failed', adminLoginRes.data);
      throw new Error('Cannot proceed without Super Admin token.');
    }

    let salesRole = await Role.findOne({ roleName: 'Sales Executive' });
    if (!salesRole) {
      salesRole = await Role.create({
        roleName: 'Sales Executive',
        description: 'Sales team member',
        isSystemRole: false
      });
    }

    // 1. Sales User (create: true, approve: false -> triggers pendingApproval flow)
    let salesUser = await User.findOne({ mobile: '9870000001' });
    const salesPwHash = await User.hashPassword('Sales@1234');
    if (!salesUser) {
      salesUser = await User.create({
        name: 'Sales Exec Alice',
        mobile: '9870000001',
        passwordHash: salesPwHash,
        role: salesRole._id,
        isActive: true
      });
    } else {
      salesUser.passwordHash = salesPwHash;
      await salesUser.save();
    }
    salesUserId = salesUser._id;

    await api('/permissions/assign', {
      method: 'POST',
      token: superAdminToken,
      body: {
        userId: salesUserId.toString(),
        permissions: [
          {
            moduleKey: 'QUOTATION_CONFIRMATION',
            dataScope: 'OWN',
            actions: { view: true, create: true, edit: true, delete: true, export: true, approve: false }
          },
          {
            moduleKey: 'QUOTATION',
            dataScope: 'OWN',
            actions: { view: true, create: true, edit: true, delete: true, export: true, approve: false }
          }
        ]
      }
    });

    const salesLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { mobile: '9870000001', password: 'Sales@1234' }
    });
    salesUserToken = salesLoginRes.data?.data?.accessToken;
    logPass("Sales User configured (create: true, approve: false -> tests pendingApproval gate)");

    // 2. Sales Manager User (create: true, approve: true)
    let managerUser = await User.findOne({ mobile: '9870000002' });
    const mgrPwHash = await User.hashPassword('Manager@1234');
    if (!managerUser) {
      managerUser = await User.create({
        name: 'Sales Manager Bob',
        mobile: '9870000002',
        passwordHash: mgrPwHash,
        role: salesRole._id,
        isActive: true
      });
    } else {
      managerUser.passwordHash = mgrPwHash;
      await managerUser.save();
    }
    managerUserId = managerUser._id;

    await api('/permissions/assign', {
      method: 'POST',
      token: superAdminToken,
      body: {
        userId: managerUserId.toString(),
        permissions: [
          {
            moduleKey: 'QUOTATION_CONFIRMATION',
            dataScope: 'ALL',
            actions: { view: true, create: true, edit: true, delete: true, export: true, approve: true }
          },
          {
            moduleKey: 'QUOTATION',
            dataScope: 'ALL',
            actions: { view: true, create: true, edit: true, delete: true, export: true, approve: true }
          }
        ]
      }
    });

    const mgrLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { mobile: '9870000002', password: 'Manager@1234' }
    });
    managerUserToken = mgrLoginRes.data?.data?.accessToken;
    logPass("Sales Manager configured with 'approve' permission");

    // 3. View-Only User
    let viewUser = await User.findOne({ mobile: '9870000099' });
    const viewPwHash = await User.hashPassword('View@1234');
    if (!viewUser) {
      viewUser = await User.create({
        name: 'Auditor ViewOnly',
        mobile: '9870000099',
        passwordHash: viewPwHash,
        role: salesRole._id,
        isActive: true
      });
    } else {
      viewUser.passwordHash = viewPwHash;
      await viewUser.save();
    }
    viewOnlyUserId = viewUser._id;

    await api('/permissions/assign', {
      method: 'POST',
      token: superAdminToken,
      body: {
        userId: viewOnlyUserId.toString(),
        permissions: [
          {
            moduleKey: 'QUOTATION_CONFIRMATION',
            dataScope: 'ALL',
            actions: { view: true, create: false, edit: false, delete: false, export: false, approve: false }
          }
        ]
      }
    });

    const viewLoginRes = await api('/auth/login', {
      method: 'POST',
      body: { mobile: '9870000099', password: 'View@1234' }
    });
    viewOnlyToken = viewLoginRes.data?.data?.accessToken;
    logPass('View-Only user configured (create/edit/delete/export/approve disabled)');

    // =========================================================================
    // STEP 2: Fixture Setup (Customer + Products + Format + Quotations)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 2: Fixture Setup (Customer, Products & Multi-Item Quotation)${colors.reset}`);
    testCustomer = await Customer.findOne({ mobile: '9900112233' });
    if (!testCustomer) {
      testCustomer = await Customer.create({
        customerName: 'Shreeji Developers & Builders',
        mobile: '9900112233',
        city: 'Surat',
        customerType: 'CONTRACTOR',
        isActive: true,
        createdBy: salesUserId
      });
    }

    testFormat = await QuotationFormatMaster.findOne({ formatKey: 'STANDARD' });
    if (!testFormat) {
      testFormat = await QuotationFormatMaster.create({
        formatKey: 'STANDARD',
        formatName: 'Standard Format',
        isActive: true,
        createdBy: salesUserId
      });
    }

    let unit = await UnitMaster.findOne({ unitCode: 'BOX' });
    if (!unit) {
      unit = await UnitMaster.create({ unitName: 'Box', unitCode: 'BOX', createdBy: salesUserId });
    }

    let tax = await TaxMaster.findOne({ $or: [{ taxRate: 18 }, { taxName: 'GST 18%' }] });
    if (!tax) {
      tax = await TaxMaster.create({ taxName: 'GST 18%', taxRate: 18, createdBy: salesUserId });
    }

    let company = await Company.findOne({ companyName: 'Maitri Ceramic' });
    if (!company) {
      company = await Company.create({ companyName: 'Maitri Ceramic', createdBy: salesUserId });
    }

    testProduct1 = await Product.findOne({ companySkuCode: 'MTR-CONF-001' });
    if (!testProduct1) {
      testProduct1 = await Product.create({
        productName: 'Royal Statuario 600x1200mm',
        companySkuCode: 'MTR-CONF-001',
        unit: unit._id,
        company: company._id,
        mrp: 1000,
        gstPct: 18,
        isActive: true,
        createdBy: salesUserId
      });
    }

    testProduct2 = await Product.findOne({ companySkuCode: 'MTR-CONF-002' });
    if (!testProduct2) {
      testProduct2 = await Product.create({
        productName: 'Armani Grey 600x600mm',
        companySkuCode: 'MTR-CONF-002',
        unit: unit._id,
        company: company._id,
        mrp: 600,
        gstPct: 18,
        isActive: true,
        createdBy: salesUserId
      });
    }

    testExtraProduct = await Product.findOne({ companySkuCode: 'MTR-CONF-EXTRA' });
    if (!testExtraProduct) {
      testExtraProduct = await Product.create({
        productName: 'Tile Spacer 3mm (Pack of 500)',
        companySkuCode: 'MTR-CONF-EXTRA',
        unit: unit._id,
        company: company._id,
        mrp: 350,
        gstPct: 18,
        isActive: true,
        createdBy: salesUserId
      });
    }

    // Create 3-Item Test Quotation (Item 1: qty 10 @ ₹1000, Item 2: qty 5 @ ₹600, Item 3: qty 2 ad-hoc @ ₹500)
    // Original Quotation Total: 10000 + 3000 + 1000 = ₹14,000 (plus tax ₹2,520 = ₹16,520)
    testQuotation1 = await Quotation.findOne({ quotationNumber: 'QT-TEST-M7-001' });
    if (testQuotation1) {
      await QuotationConfirmation.deleteMany({ quotation: testQuotation1._id });
      await Quotation.deleteOne({ _id: testQuotation1._id });
    }

    testQuotation1 = await Quotation.create({
      quotationNumber: 'QT-TEST-M7-001',
      quotationDate: new Date(),
      customer: testCustomer._id,
      salesperson: salesUserId,
      format: testFormat._id,
      formatKey: 'STANDARD',
      status: 'CUSTOMER_INTERESTED',
      items: [
        {
          product: testProduct1._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          mrpSnapshot: 1000,
          quantity: 10,
          discountPct: 0,
          grossAmount: 10000,
          discountAmount: 0,
          netAmount: 10000,
          gstPctSnapshot: 18,
          gstAmount: 1800
        },
        {
          product: testProduct2._id,
          productNameSnapshot: testProduct2.productName,
          skuCodeSnapshot: testProduct2.companySkuCode,
          mrpSnapshot: 600,
          quantity: 5,
          discountPct: 0,
          grossAmount: 3000,
          discountAmount: 0,
          netAmount: 3000,
          gstPctSnapshot: 18,
          gstAmount: 540
        },
        {
          isSkuLessItem: true,
          product: null,
          productNameSnapshot: 'Brass Border Profile 8ft',
          skuCodeSnapshot: null,
          mrpSnapshot: 500,
          quantity: 2,
          discountPct: 0,
          grossAmount: 1000,
          discountAmount: 0,
          netAmount: 1000,
          gstPctSnapshot: 18,
          gstAmount: 180
        }
      ],
      totalGrossAmount: 14000,
      totalNetAmount: 14000,
      totalGstAmount: 2520,
      grandTotal: 16520,
      isActive: true,
      createdBy: salesUserId
    });

    logPass('Quotation fixture created with 3 line items (2 catalog + 1 SKU-less ad-hoc, total ₹16,520)');

    // =========================================================================
    // STEP 3: Create-Only User & pendingApproval Flow (Rule 8)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 3: pendingApproval Flow & Quotation Status Gate${colors.reset}`);

    const qItem1 = testQuotation1.items[0];
    const qItem2 = testQuotation1.items[1];
    const qItem3 = testQuotation1.items[2];

    // Sales User creates confirmation:
    // Item 1: confirmed 10, extra 2 (took 2 extra boxes)
    // Item 2: confirmed 0 (customer declined Item 2)
    // Item 3: confirmed 2 (confirmed original qty)
    // Extra Item: 4 units of Tile Spacer @ ₹350
    const salesCreateRes = await api('/confirmations', {
      method: 'POST',
      token: salesUserToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        confirmedItems: [
          {
            originalQuotationItemId: qItem1._id.toString(),
            confirmedQuantity: 10,
            extraQuantity: 2,
            remarks: 'Took 2 extra boxes'
          },
          {
            originalQuotationItemId: qItem2._id.toString(),
            confirmedQuantity: 0,
            remarks: 'Customer dropped Armani Grey'
          },
          {
            originalQuotationItemId: qItem3._id.toString(),
            confirmedQuantity: 2
          }
        ],
        extraItems: [
          {
            productId: testExtraProduct._id.toString(),
            quantity: 4,
            remarks: 'Added tile spacers'
          }
        ],
        remarks: 'Confirmed with site engineer'
      }
    });

    let confirmationId;
    if (salesCreateRes.status === 201) {
      const conf = salesCreateRes.data.data;
      confirmationId = conf._id;

      if (conf.pendingApproval === true) {
        logPass('Confirmation created by create-only user sits in pendingApproval: true');
      } else {
        logFail('Expected pendingApproval: true for user lacking approve permission');
      }

      if (conf.confirmationStatus === 'PARTIALLY_CONFIRMED') {
        logPass("confirmationStatus computed as 'PARTIALLY_CONFIRMED' (Item 2 quantity was 0/dropped)");
      } else {
        logFail(`Expected PARTIALLY_CONFIRMED, got ${conf.confirmationStatus}`);
      }

      // Check Quotation status did NOT change yet
      const qCheck = await Quotation.findById(testQuotation1._id);
      if (qCheck.status === 'CUSTOMER_INTERESTED') {
        logPass('Quotation status remains CUSTOMER_INTERESTED while confirmation is pending approval');
      } else {
        logFail(`Quotation status prematurely changed to ${qCheck.status}`);
      }
    } else {
      logFail('Failed to create confirmation by sales user', salesCreateRes.data);
    }

    // =========================================================================
    // STEP 4: Single-Active-Confirmation Enforced (Rule 1)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 4: Single Active Confirmation Rule (Section 12 Rule 1)${colors.reset}`);
    const duplicateRes = await api('/confirmations', {
      method: 'POST',
      token: managerUserToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        confirmedItems: [{ originalQuotationItemId: qItem1._id.toString(), confirmedQuantity: 10 }]
      }
    });

    if (duplicateRes.status === 400) {
      logPass('Attempt to create second active confirmation for same quotation is rejected (Rule 1 enforced)');
    } else {
      logFail('Expected 400 rejection for duplicate active confirmation, got ' + duplicateRes.status);
    }

    // =========================================================================
    // STEP 5: Manager Approval Gate (`PUT /:id/approve`)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 5: Manager Approval & Atomic Quotation Status Flip${colors.reset}`);
    const approveRes = await api(`/confirmations/${confirmationId}/approve`, {
      method: 'PUT',
      token: managerUserToken
    });

    if (approveRes.status === 200) {
      const approvedConf = approveRes.data.data;
      if (approvedConf.pendingApproval === false) {
        logPass('Manager successfully approved confirmation (pendingApproval: false)');
      } else {
        logFail('Expected pendingApproval: false after approval');
      }

      const qAfterApprove = await Quotation.findById(testQuotation1._id);
      if (qAfterApprove.status === 'PARTIALLY_CONFIRMED') {
        logPass("Quotation.status transitioned to 'PARTIALLY_CONFIRMED' on manager approval");
      } else {
        logFail(`Expected Quotation status PARTIALLY_CONFIRMED, got ${qAfterApprove.status}`);
      }
    } else {
      logFail('Failed to approve confirmation', approveRes.data);
    }

    // =========================================================================
    // STEP 6: 4-Stage Quantity Ledger Verification
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 6: 4-Stage Quantity Ledger (Quoted -> Confirmed -> Extra -> Delivered)${colors.reset}`);
    const ledgerRes = await api(`/confirmations/${confirmationId}/quantity-ledger`, {
      token: managerUserToken
    });

    if (ledgerRes.status === 200 && ledgerRes.data.data?.itemsLedger) {
      const ledger = ledgerRes.data.data.itemsLedger;

      // Item 1: Quoted 10, Confirmed 10, Extra 2, Total 12, Delivered 0, Pending 12
      const it1 = ledger.find((it) => it.productName === testProduct1.productName);
      if (it1 && it1.quotedQuantity === 10 && it1.confirmedQuantity === 10 && it1.extraQuantity === 2 && it1.pendingDeliveryQuantity === 12) {
        logPass('Quantity Ledger Item 1: Quoted 10, Confirmed 10, Extra 2, Pending 12 verified');
      } else {
        logFail('Quantity Ledger Item 1 mismatch', it1);
      }

      // Item 2: Quoted 5, Confirmed 0, Extra 0, Total 0, Delivered 0, Pending 0
      const it2 = ledger.find((it) => it.productName === testProduct2.productName);
      if (it2 && it2.quotedQuantity === 5 && it2.confirmedQuantity === 0 && it2.pendingDeliveryQuantity === 0) {
        logPass('Quantity Ledger Item 2: Quoted 5, Confirmed 0 (Declined), Pending 0 verified');
      } else {
        logFail('Quantity Ledger Item 2 mismatch', it2);
      }

      // Extra Item: Quoted 0, Confirmed 4, Extra 0, Pending 4
      const itExtra = ledger.find((it) => it.isExtraProduct === true);
      if (itExtra && itExtra.quotedQuantity === 0 && itExtra.confirmedQuantity === 4 && itExtra.pendingDeliveryQuantity === 4) {
        logPass('Quantity Ledger Extra Item: Quoted 0, Confirmed 4, isExtraProduct: true verified');
      } else {
        logFail('Quantity Ledger Extra Item mismatch', itExtra);
      }
    } else {
      logFail('Failed to get quantity ledger', ledgerRes.data);
    }

    // =========================================================================
    // STEP 7: Quotation vs Actual Amount Comparison Engine
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 7: Quotation Amount vs Actual Amount Comparison Engine${colors.reset}`);
    const comparisonRes = await api(`/confirmations/${confirmationId}/amount-comparison`, {
      token: managerUserToken
    });

    if (comparisonRes.status === 200 && comparisonRes.data.data) {
      const comp = comparisonRes.data.data;

      // Original Quotation Amount: 16520
      // Confirmed Amount for original items:
      // Item 1: (10+2) * 1000 = 12000
      // Item 2: 0 * 600 = 0
      // Item 3: 2 * 500 = 1000
      // Total confirmedAmount = 13000
      // Extra Product Amount: 4 * 350 = 1400
      // Total Actual Amount: 13000 + 1400 = 14400
      // Difference Amount: 16520 - 13000 = 3520
      if (comp.originalQuotationAmount === 16520) {
        logPass(`Amount Comparison: originalQuotationAmount frozen at ₹${comp.originalQuotationAmount}`);
      } else {
        logFail(`Expected originalQuotationAmount 16520, got ${comp.originalQuotationAmount}`);
      }

      if (comp.confirmedAmount === 13000 && comp.extraProductAmount === 1400 && comp.totalActualAmount === 14400) {
        logPass(`Amount Comparison: Confirmed ₹13,000 + Extra ₹1,400 = Total Actual ₹14,400 verified`);
      } else {
        logFail('Amount comparison values mismatch', comp);
      }

      // Graceful stubs for unbuilt modules
      if (comp.finalInvoiceAmount === 0 && comp.paymentReceived === 0) {
        logPass('Downstream stubs (Invoice & Payment) return 0 gracefully before Modules 10/11 exist');
      } else {
        logFail('Downstream stubs unexpected response', comp);
      }
    } else {
      logFail('Failed to get amount comparison', comparisonRes.data);
    }

    // =========================================================================
    // STEP 8: Pre-Delivery Editing & Post-Delivery Delivery Lock (Rule 5 & Rule 6)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 8: Pre-Delivery Modification & Post-Delivery Lock Enforcement${colors.reset}`);

    // Pre-delivery edit: adjust Item 1 extraQuantity to 3
    const editPreDeliveryRes = await api(`/confirmations/${confirmationId}`, {
      method: 'PUT',
      token: managerUserToken,
      body: {
        confirmedItems: [
          {
            originalQuotationItemId: qItem1._id.toString(),
            confirmedQuantity: 10,
            extraQuantity: 3 // changed from 2 to 3
          },
          {
            originalQuotationItemId: qItem2._id.toString(),
            confirmedQuantity: 0
          },
          {
            originalQuotationItemId: qItem3._id.toString(),
            confirmedQuantity: 2
          }
        ]
      }
    });

    if (editPreDeliveryRes.status === 200) {
      logPass('Pre-delivery edit succeeded while deliveredQuantity is 0 across all items');
    } else {
      logFail('Expected success for pre-delivery edit', editPreDeliveryRes.data);
    }

    // Simulate partial delivery via internal service (Module 9 Challan simulation)
    const currentConf = await QuotationConfirmation.findById(confirmationId);
    const itemToDeliver = currentConf.confirmedItems[0];
    await confirmationService.recordDelivery(confirmationId, itemToDeliver._id, 5);
    logPass('Simulated delivery of 5 units via internal confirmationService.recordDelivery()');

    // Attempt to edit post-delivery (MUST BE REJECTED)
    const editPostDeliveryRes = await api(`/confirmations/${confirmationId}`, {
      method: 'PUT',
      token: managerUserToken,
      body: {
        confirmedItems: [{ originalQuotationItemId: qItem1._id.toString(), confirmedQuantity: 8 }]
      }
    });

    if (editPostDeliveryRes.status === 400) {
      logPass('Post-delivery edit is strictly BLOCKED by delivery-lock (Section 5 enforced)');
    } else {
      logFail('Expected 400 rejection for post-delivery edit, got ' + editPostDeliveryRes.status);
    }

    // Attempt to cancel post-delivery (MUST BE REJECTED)
    const cancelPostDeliveryRes = await api(`/confirmations/${confirmationId}/cancel`, {
      method: 'PUT',
      token: managerUserToken
    });

    if (cancelPostDeliveryRes.status === 400) {
      logPass('Post-delivery cancel is strictly BLOCKED by delivery-lock (Rule 6 enforced)');
    } else {
      logFail('Expected 400 rejection for post-delivery cancel, got ' + cancelPostDeliveryRes.status);
    }

    // =========================================================================
    // STEP 9: Forward-Reference Services for Module 8 (Stock Pending Delivery)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 9: Forward-Reference Service for Module 8 Stock (getConfirmedPendingDelivery)${colors.reset}`);
    const pendingStock = await confirmationService.getConfirmedPendingDelivery(testProduct1._id);
    if (pendingStock.length > 0 && pendingStock[0].pendingQuantity === 8) { // 10 + 3 - 5 delivered = 8 pending
      logPass("confirmationService.getConfirmedPendingDelivery() feeds Module 8 Stock with pending commitment (8 units)");
    } else {
      logFail('Pending stock calculation mismatch', pendingStock);
    }

    // =========================================================================
    // STEP 10: Pre-Delivery Cancellation & Quotation Status Reversion
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 10: Cancellation & Quotation Status Reversion${colors.reset}`);

    // Create a second Quotation for cancellation test
    const qCancelTest = await Quotation.create({
      quotationNumber: 'QT-TEST-M7-002-CANCEL',
      quotationDate: new Date(),
      customer: testCustomer._id,
      salesperson: salesUserId,
      format: testFormat._id,
      formatKey: 'STANDARD',
      status: 'CUSTOMER_INTERESTED',
      items: [
        {
          product: testProduct1._id,
          productNameSnapshot: testProduct1.productName,
          skuCodeSnapshot: testProduct1.companySkuCode,
          mrpSnapshot: 1000,
          quantity: 5,
          grossAmount: 5000,
          discountAmount: 0,
          netAmount: 5000,
          gstPctSnapshot: 18,
          gstAmount: 900
        }
      ],
      grandTotal: 5900,
      isActive: true,
      createdBy: salesUserId
    });

    const confCancelRes = await api('/confirmations', {
      method: 'POST',
      token: managerUserToken,
      body: {
        quotationId: qCancelTest._id.toString(),
        confirmedItems: [
          {
            originalQuotationItemId: qCancelTest.items[0]._id.toString(),
            confirmedQuantity: 5
          }
        ]
      }
    });

    const cancelConfId = confCancelRes.data.data._id;
    const qAfterConfirm = await Quotation.findById(qCancelTest._id);
    if (qAfterConfirm.status === 'CONFIRMED') {
      logPass('Quotation transitioned to CONFIRMED on full confirmation creation');
    }

    // Cancel this confirmation
    const cancelRes = await api(`/confirmations/${cancelConfId}/cancel`, {
      method: 'PUT',
      token: managerUserToken
    });

    if (cancelRes.status === 200) {
      const qReverted = await Quotation.findById(qCancelTest._id);
      if (qReverted.status === 'CUSTOMER_INTERESTED') {
        logPass('Cancelling confirmation reverts Quotation.status back to CUSTOMER_INTERESTED');
      } else {
        logFail(`Expected Quotation status CUSTOMER_INTERESTED, got ${qReverted.status}`);
      }

      const confAfterCancel = await QuotationConfirmation.findById(cancelConfId);
      if (confAfterCancel.isActive === false) {
        logPass('Cancelled confirmation record is soft-deactivated (isActive: false) for historical audit');
      } else {
        logFail('Expected confirmation isActive: false');
      }
    } else {
      logFail('Failed to cancel confirmation', cancelRes.data);
    }

    // Clean cancellation test fixture
    await Quotation.deleteOne({ _id: qCancelTest._id });
    await QuotationConfirmation.deleteOne({ _id: cancelConfId });

    // =========================================================================
    // STEP 11: Granular Permissions & Excel Export
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 11: Granular Permissions & Excel Workbook Export${colors.reset}`);

    // View-only user cannot create
    const viewCreateRes = await api('/confirmations', {
      method: 'POST',
      token: viewOnlyToken,
      body: { quotationId: testQuotation1._id.toString() }
    });
    if (viewCreateRes.status === 403) {
      logPass('View-only user receives 403 Forbidden on create confirmation');
    } else {
      logFail('Expected 403 for view-only create, got ' + viewCreateRes.status);
    }

    // View-only user cannot approve
    const viewApproveRes = await api(`/confirmations/${confirmationId}/approve`, {
      method: 'PUT',
      token: viewOnlyToken
    });
    if (viewApproveRes.status === 403) {
      logPass('View-only user receives 403 Forbidden on approve confirmation');
    } else {
      logFail('Expected 403 for view-only approve, got ' + viewApproveRes.status);
    }

    // Excel Export
    const exportRes = await api(`/confirmations/${confirmationId}/export`, {
      token: managerUserToken
    });
    if (exportRes.status === 200 && exportRes.contentType.includes('spreadsheetml')) {
      logPass('GET /api/confirmations/:id/export generates valid Excel workbook');
    } else {
      logFail('Excel export failed', exportRes);
    }

  } catch (err) {
    console.error(`\n${colors.red}Critical Test Suite Error:${colors.reset}`, err);
    failed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log(`\n${colors.bold}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bold}TEST RESULTS SUMMARY:${colors.reset}`);
  console.log(`  ${colors.green}Total Passed:${colors.reset} ${passed}`);
  console.log(`  ${colors.red}Total Failed:${colors.reset} ${failed}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
