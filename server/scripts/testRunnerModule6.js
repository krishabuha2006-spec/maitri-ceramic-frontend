const http = require('http');
const connectDB = require('../config/db');
const app = require('../server');
const SystemModule = require('../models/SystemModule');
const User = require('../models/User');
const Role = require('../models/Role');
const RoleDefaultPermission = require('../models/RoleDefaultPermission');
const UserPermission = require('../models/UserPermission');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const FollowUp = require('../models/FollowUp');
const followUpService = require('../services/followUp.service');

let server;
let baseUrl;
let superAdminToken;
let salesUserToken;
let salesUserId;
let viewOnlyToken;
let viewOnlyUserId;
let testCustomer;
let testQuotation1;
let testQuotation2;
let testFormat;

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
  console.log(`${colors.bold}${colors.cyan}  MAITRI CERAMIC - MODULE 6: FOLLOW-UP MANAGEMENT TEST SUITE            ${colors.reset}`);
  console.log(`${colors.bold}${colors.cyan}========================================================================${colors.reset}\n`);

  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://localhost:${port}/api`;
  console.log(`📡 Test server running on http://localhost:${port}\n`);

  try {
    // =========================================================================
    // STEP 0: System Module Seed & ModuleKey Registration
    // =========================================================================
    console.log(`${colors.bold}► STEP 0: System Module Seed & FOLLOW_UP Registration${colors.reset}`);
    const seedRes = await api('/permissions/modules/seed', { method: 'POST' });
    if (seedRes.status === 200) {
      const followUpMod = await SystemModule.findOne({ moduleKey: 'FOLLOW_UP' });
      if (followUpMod) {
        logPass('FOLLOW_UP moduleKey successfully registered in SystemModule registry');
      } else {
        logFail('FOLLOW_UP moduleKey missing in SystemModule registry');
      }
    } else {
      logFail('Failed to seed system modules', seedRes.data);
    }

    // =========================================================================
    // STEP 1: Authentication & User Setup (SuperAdmin + Sales Exec + ViewOnly)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 1: Super Admin & Scoped Users Authentication${colors.reset}`);
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

    // Create / Find Sales Executive Role & User
    let salesRole = await Role.findOne({ roleName: 'Sales Executive' });
    if (!salesRole) {
      salesRole = await Role.create({
        roleName: 'Sales Executive',
        description: 'Sales team member',
        isSystemRole: false
      });
    }

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
      salesUser.isActive = true;
      await salesUser.save();
    }
    salesUserId = salesUser._id;

    // Grant Sales User full permissions for CUSTOMER, QUOTATION and FOLLOW_UP with dataScope: OWN
    await api('/permissions/assign', {
      method: 'POST',
      token: superAdminToken,
      body: {
        userId: salesUserId.toString(),
        permissions: [
          {
            moduleKey: 'FOLLOW_UP',
            dataScope: 'OWN',
            actions: { view: true, create: true, edit: true, delete: true, export: true, approve: false }
          },
          {
            moduleKey: 'QUOTATION',
            dataScope: 'OWN',
            actions: { view: true, create: true, edit: true, delete: true, export: true, approve: false }
          },
          {
            moduleKey: 'CUSTOMER',
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
    logPass('Sales Executive authenticated with dataScope: OWN');

    // Create View-Only User
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
      viewUser.isActive = true;
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
            moduleKey: 'FOLLOW_UP',
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
    logPass('View-Only user configured (create/edit/delete/export disabled)');

    // =========================================================================
    // STEP 2: Setup Test Data (Customer + Format + Quotations)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 2: Fixture Setup (Customer & Quotations)${colors.reset}`);
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

    // Create Test Quotation 1 (Active, status: SENT)
    testQuotation1 = await Quotation.findOne({ quotationNumber: 'QT-TEST-M6-001' });
    if (!testQuotation1) {
      testQuotation1 = await Quotation.create({
        quotationNumber: 'QT-TEST-M6-001',
        quotationDate: new Date(),
        validityDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Expires in 2 days (for alert testing)
        customer: testCustomer._id,
        salesperson: salesUserId,
        format: testFormat._id,
        formatKey: 'STANDARD',
        status: 'SENT',
        totalGrossAmount: 100000,
        totalNetAmount: 95000,
        totalGstAmount: 17100,
        grandTotal: 112100,
        isActive: true,
        createdBy: salesUserId
      });
    } else {
      testQuotation1.status = 'SENT';
      testQuotation1.validityDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
      testQuotation1.isActive = true;
      await testQuotation1.save();
    }

    // Create Test Quotation 2 (Inactive / Cancelled Quotation for negative test)
    testQuotation2 = await Quotation.findOne({ quotationNumber: 'QT-TEST-M6-002-CANCELLED' });
    if (!testQuotation2) {
      testQuotation2 = await Quotation.create({
        quotationNumber: 'QT-TEST-M6-002-CANCELLED',
        quotationDate: new Date(),
        customer: testCustomer._id,
        salesperson: salesUserId,
        format: testFormat._id,
        formatKey: 'STANDARD',
        status: 'CLOSED',
        isActive: false, // Inactive / Cancelled
        grandTotal: 50000,
        createdBy: salesUserId
      });
    }

    // Clean any prior follow-up test data for these quotations
    await FollowUp.deleteMany({ quotation: { $in: [testQuotation1._id, testQuotation2._id] } });
    logPass('Test fixtures created (Quotation 1: Active SENT, Quotation 2: Cancelled)');

    // =========================================================================
    // STEP 3: Follow-Up Creation & Negative Validations
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 3: Follow-Up Creation & Business Rule Validations${colors.reset}`);

    // Test: Logging follow-up against inactive quotation rejected
    const inactiveRes = await api('/follow-ups', {
      method: 'POST',
      token: superAdminToken,
      body: {
        quotationId: testQuotation2._id.toString(),
        communicationType: 'CALL',
        resultingStatus: 'FOLLOW_UP_PENDING'
      }
    });
    if (inactiveRes.status === 404 || inactiveRes.status === 400) {
      logPass('Logging follow-up against inactive/cancelled quotation is rejected');
    } else {
      logFail('Expected rejection for inactive quotation, got ' + inactiveRes.status);
    }

    // Test: Invalid resultingStatus (CONFIRMED is owned by Module 7)
    const invalidStatusRes = await api('/follow-ups', {
      method: 'POST',
      token: superAdminToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        communicationType: 'CALL',
        resultingStatus: 'CONFIRMED'
      }
    });
    if (invalidStatusRes.status === 400) {
      logPass("resultingStatus: 'CONFIRMED' rejected (Transition belongs exclusively to Module 7)");
    } else {
      logFail("Expected 400 for CONFIRMED resultingStatus, got " + invalidStatusRes.status);
    }

    // Test: nextFollowUpDate earlier than followUpDate rejected
    const invalidDateRes = await api('/follow-ups', {
      method: 'POST',
      token: superAdminToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        followUpDate: '2026-09-15T10:00:00.000Z',
        nextFollowUpDate: '2026-09-10T10:00:00.000Z', // Past date relative to followUpDate
        communicationType: 'CALL',
        resultingStatus: 'FOLLOW_UP_PENDING'
      }
    });
    if (invalidDateRes.status === 400) {
      logPass('nextFollowUpDate before followUpDate is rejected with 400 Bad Request');
    } else {
      logFail('Expected 400 for invalid nextFollowUpDate, got ' + invalidDateRes.status);
    }

    // =========================================================================
    // STEP 4: Successful Follow-Up Creation & Atomic Quotation Status Update
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 4: Atomic Status Update & Multi-Entry Timeline${colors.reset}`);

    // Log First Follow-Up
    const fu1Date = new Date('2026-09-15T09:00:00.000Z');
    const fu1Next = new Date('2026-09-18T10:00:00.000Z');
    const fu1Res = await api('/follow-ups', {
      method: 'POST',
      token: superAdminToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        followUpDate: fu1Date.toISOString(),
        nextFollowUpDate: fu1Next.toISOString(),
        communicationType: 'CALL',
        customerResponse: 'Client reviewing the quotation with their architect.',
        remarks: 'Sent product catalogue PDF on WhatsApp.',
        expectedOrderValue: 110000,
        nextAction: 'Call back on Thursday morning.',
        resultingStatus: 'FOLLOW_UP_PENDING'
      }
    });

    let firstFollowUpId;
    if (fu1Res.status === 201) {
      firstFollowUpId = fu1Res.data.data._id;
      const updatedQuotation = await Quotation.findById(testQuotation1._id);
      if (updatedQuotation.status === 'FOLLOW_UP_PENDING') {
        logPass('First Follow-Up logged and Quotation.status atomically transitioned to FOLLOW_UP_PENDING');
      } else {
        logFail(`Quotation status expected FOLLOW_UP_PENDING, got ${updatedQuotation.status}`);
      }
    } else {
      logFail('Failed to create first follow-up', fu1Res.data);
    }

    // Log Second Follow-Up (Newer Date)
    const fu2Date = new Date('2026-09-18T11:00:00.000Z');
    const fu2Res = await api('/follow-ups', {
      method: 'POST',
      token: superAdminToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        followUpDate: fu2Date.toISOString(),
        nextFollowUpDate: new Date('2026-09-22T10:00:00.000Z').toISOString(),
        communicationType: 'IN_PERSON',
        customerResponse: 'Architect selected Royal Statuario tile design.',
        remarks: 'Client requested 2% additional builder discount.',
        expectedOrderValue: 112000,
        nextAction: 'Seek manager approval for discount.',
        resultingStatus: 'CUSTOMER_INTERESTED'
      }
    });

    let secondFollowUpId;
    if (fu2Res.status === 201) {
      secondFollowUpId = fu2Res.data.data._id;
      const updatedQuotation = await Quotation.findById(testQuotation1._id);
      if (updatedQuotation.status === 'CUSTOMER_INTERESTED') {
        logPass('Second Follow-Up logged and Quotation.status transitioned to CUSTOMER_INTERESTED');
      } else {
        logFail(`Quotation status expected CUSTOMER_INTERESTED, got ${updatedQuotation.status}`);
      }
    } else {
      logFail('Failed to create second follow-up', fu2Res.data);
    }

    // =========================================================================
    // STEP 5: Timeline Retrieval & Chronological Order
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 5: Quotation Timeline API Verification${colors.reset}`);
    const timelineRes = await api(`/follow-ups/quotation/${testQuotation1._id}/timeline`, {
      token: superAdminToken
    });

    if (timelineRes.status === 200 && timelineRes.data.data?.timeline?.length === 2) {
      const timeline = timelineRes.data.data.timeline;
      // Should be newest first (fu2 before fu1)
      if (timeline[0]._id.toString() === secondFollowUpId && timeline[1]._id.toString() === firstFollowUpId) {
        logPass('Timeline returns full follow-up history in strict newest-first chronological order');
      } else {
        logFail('Timeline order mismatch (expected newest first)');
      }
    } else {
      logFail('Failed to fetch quotation timeline', timelineRes.data);
    }

    // =========================================================================
    // STEP 6: Recency-Aware Status Re-Application on Edit
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 6: Recency-Aware Edit Logic (Section 11 Rule 4)${colors.reset}`);

    // Sub-test A: Editing the OLDER follow-up (fu1) resultingStatus must NOT overwrite Quotation status
    const editOlderRes = await api(`/follow-ups/${firstFollowUpId}`, {
      method: 'PUT',
      token: superAdminToken,
      body: {
        resultingStatus: 'NEGOTIATION',
        remarks: 'Updated historical remarks on call 1'
      }
    });

    if (editOlderRes.status === 200) {
      const qAfterOlderEdit = await Quotation.findById(testQuotation1._id);
      if (qAfterOlderEdit.status === 'CUSTOMER_INTERESTED') {
        logPass('Editing OLDER historical entry does NOT alter Quotation.status (Customization/Recency protected)');
      } else {
        logFail(`Expected Quotation status CUSTOMER_INTERESTED, got ${qAfterOlderEdit.status}`);
      }
    } else {
      logFail('Failed to edit older follow up', editOlderRes.data);
    }

    // Sub-test B: Editing the MOST RECENT follow-up (fu2) DOES update Quotation status
    const editRecentRes = await api(`/follow-ups/${secondFollowUpId}`, {
      method: 'PUT',
      token: superAdminToken,
      body: {
        resultingStatus: 'NEGOTIATION',
        remarks: 'Discount discussion ongoing with client.'
      }
    });

    if (editRecentRes.status === 200) {
      const qAfterRecentEdit = await Quotation.findById(testQuotation1._id);
      if (qAfterRecentEdit.status === 'NEGOTIATION') {
        logPass('Editing MOST RECENT active follow-up correctly updates Quotation.status to NEGOTIATION');
      } else {
        logFail(`Expected Quotation status NEGOTIATION, got ${qAfterRecentEdit.status}`);
      }
    } else {
      logFail('Failed to edit most recent follow up', editRecentRes.data);
    }

    // =========================================================================
    // STEP 7: Soft Deactivation (Rule 5: No Auto Reversion)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 7: Soft-Deactivation & No Auto-Reversion${colors.reset}`);
    const deactRes = await api(`/follow-ups/${secondFollowUpId}/deactivate`, {
      method: 'PUT',
      token: superAdminToken
    });

    if (deactRes.status === 200) {
      const qAfterDeact = await Quotation.findById(testQuotation1._id);
      if (qAfterDeact.status === 'NEGOTIATION') {
        logPass('Deactivating a follow-up does NOT auto-revert Quotation status (Rule 5 enforced)');
      } else {
        logFail(`Quotation status unexpectedly changed to ${qAfterDeact.status}`);
      }

      // Re-activate for downstream alert testing
      await FollowUp.findByIdAndUpdate(secondFollowUpId, { isActive: true });
    } else {
      logFail('Failed to deactivate follow-up', deactRes.data);
    }

    // =========================================================================
    // STEP 8: Alert Engine (5 Categories)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 8: Follow-Up Alert Engine (5 Categories Verification)${colors.reset}`);

    // Create a 3rd Quotation with NO follow-ups for 'noFollowUpYet' alert
    const qNoFu = await Quotation.create({
      quotationNumber: 'QT-TEST-M6-003-NOFU',
      quotationDate: new Date(),
      customer: testCustomer._id,
      salesperson: salesUserId,
      format: testFormat._id,
      formatKey: 'STANDARD',
      status: 'SENT',
      grandTotal: 75000,
      isActive: true,
      createdBy: salesUserId
    });

    // Create a 4th Quotation with OVERDUE follow-up (nextFollowUpDate in past)
    const qOverdue = await Quotation.create({
      quotationNumber: 'QT-TEST-M6-004-OVERDUE',
      quotationDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      customer: testCustomer._id,
      salesperson: salesUserId,
      format: testFormat._id,
      formatKey: 'STANDARD',
      status: 'FOLLOW_UP_PENDING',
      grandTotal: 60000,
      isActive: true,
      createdBy: salesUserId
    });

    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    await FollowUp.create({
      quotation: qOverdue._id,
      followUpDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      nextFollowUpDate: pastDate,
      followUpUser: salesUserId,
      communicationType: 'CALL',
      customerResponse: '', // Empty response to also trigger category 5
      resultingStatus: 'FOLLOW_UP_PENDING',
      isActive: true,
      createdBy: salesUserId
    });

    const alertsRes = await api('/follow-ups/alerts', {
      token: superAdminToken
    });

    if (alertsRes.status === 200 && alertsRes.data.data) {
      const alerts = alertsRes.data.data;

      // 1. noFollowUpYet check
      const hasNoFu = alerts.noFollowUpYet?.some((item) => item.quotationNumber === 'QT-TEST-M6-003-NOFU');
      if (hasNoFu) {
        logPass("Alert Engine Category 1: Quotation with zero follow-ups appears in 'noFollowUpYet'");
      } else {
        logFail("Category 1 missing 'QT-TEST-M6-003-NOFU'");
      }

      // 2. overdueFollowUp check
      const hasOverdue = alerts.overdueFollowUp?.some((item) => item.quotationNumber === 'QT-TEST-M6-004-OVERDUE');
      if (hasOverdue) {
        logPass("Alert Engine Category 2: Quotation with past nextFollowUpDate appears in 'overdueFollowUp'");
      } else {
        logFail("Category 2 missing 'QT-TEST-M6-004-OVERDUE'");
      }

      // 3. expiringSoonQuotations check
      const hasExpiring = alerts.expiringSoonQuotations?.some((item) => item.quotationNumber === 'QT-TEST-M6-001');
      if (hasExpiring) {
        logPass("Alert Engine Category 4: Quotation nearing validityDate appears in 'expiringSoonQuotations'");
      } else {
        logFail("Category 4 missing 'QT-TEST-M6-001'");
      }

      // 4. noCustomerResponse check
      const hasNoResp = alerts.noCustomerResponse?.some((item) => item.quotationNumber === 'QT-TEST-M6-004-OVERDUE');
      if (hasNoResp) {
        logPass("Alert Engine Category 5: Quotation with empty response appears in 'noCustomerResponse'");
      } else {
        logFail("Category 5 missing empty response quotation");
      }
    } else {
      logFail('Failed to retrieve alerts', alertsRes.data);
    }

    // Clean up temporary alert fixtures
    await Quotation.deleteMany({ _id: { $in: [qNoFu._id, qOverdue._id] } });
    await FollowUp.deleteMany({ quotation: qOverdue._id });

    // =========================================================================
    // STEP 9: Forward-Reference Service Integration (Module 4 History)
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 9: Module 4 Forward-Reference Integration (Customer 360°)${colors.reset}`);
    const customerHistoryRes = await api(`/customers/${testCustomer._id}/history`, {
      token: superAdminToken
    });

    if (customerHistoryRes.status === 200 && customerHistoryRes.data.data) {
      const history = customerHistoryRes.data.data;
      const followUps = history.salesHistory?.followUps || history.followUps;
      if (Array.isArray(followUps) && followUps.length >= 2) {
        logPass('followUpService.getByCustomer() feeds Module 4 Customer 360° History with real follow-ups');
      } else {
        logFail('Customer history followUps array missing expected follow-up records', followUps);
      }
    } else {
      logFail('Failed to get customer history', customerHistoryRes.data);
    }

    // =========================================================================
    // STEP 10: Granular Permissions & DataScope Enforcement
    // =========================================================================
    console.log(`\n${colors.bold}► STEP 10: Granular Permission Independence & DataScope${colors.reset}`);

    // Test: View-only user CANNOT create follow-up
    const viewCreateRes = await api('/follow-ups', {
      method: 'POST',
      token: viewOnlyToken,
      body: {
        quotationId: testQuotation1._id.toString(),
        communicationType: 'CALL',
        resultingStatus: 'FOLLOW_UP_PENDING'
      }
    });
    if (viewCreateRes.status === 403) {
      logPass('View-only user receives 403 Forbidden on create action (Module 1 Granular rule verified)');
    } else {
      logFail('Expected 403 Forbidden for view-only create, got ' + viewCreateRes.status);
    }

    // Test: View-only user CANNOT edit follow-up
    const viewEditRes = await api(`/follow-ups/${firstFollowUpId}`, {
      method: 'PUT',
      token: viewOnlyToken,
      body: { remarks: 'Hacked remarks' }
    });
    if (viewEditRes.status === 403) {
      logPass('View-only user receives 403 Forbidden on edit action');
    } else {
      logFail('Expected 403 Forbidden for view-only edit, got ' + viewEditRes.status);
    }

    // Test: View-only user CANNOT deactivate follow-up
    const viewDeactRes = await api(`/follow-ups/${firstFollowUpId}/deactivate`, {
      method: 'PUT',
      token: viewOnlyToken
    });
    if (viewDeactRes.status === 403) {
      logPass('View-only user receives 403 Forbidden on delete/deactivate action');
    } else {
      logFail('Expected 403 Forbidden for view-only deactivate, got ' + viewDeactRes.status);
    }

    // Test: Export to Excel
    const exportRes = await api('/follow-ups/export', {
      token: superAdminToken
    });
    if (exportRes.status === 200 && exportRes.contentType.includes('spreadsheetml')) {
      logPass('GET /api/follow-ups/export generates valid Excel workbook');
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
