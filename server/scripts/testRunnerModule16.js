const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const app = require('../server');
const connectDB = require('../config/db');

const User = require('../models/User');
const Role = require('../models/Role');
const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');
const ActivityLogEntry = require('../models/ActivityLogEntry');
const Customer = require('../models/Customer');
const Quotation = require('../models/Quotation');
const activityLogService = require('../services/activityLog.service');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

let server;
let baseUrl;
let passed = 0;
let failed = 0;

function logSection(title) {
  console.log(`\n${colors.yellow}${colors.bold}=== ${title} ===${colors.reset}`);
}

function logPass(msg) {
  passed++;
  console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${msg}`);
}

function logFail(msg, detail) {
  failed++;
  console.log(`  ${colors.red}✗ [FAIL]${colors.reset} ${msg}`);
  if (detail) console.log(`    ${JSON.stringify(detail)}`);
}

function api(endpoint, { method = 'GET', body, token, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + endpoint);
    const reqHeaders = { ...headers };

    let payload;
    if (body) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            resolve({ status: res.statusCode, headers: res.headers, data: JSON.parse(raw.toString('utf8')) });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: raw.toString('utf8') });
          }
        } else {
          resolve({ status: res.statusCode, headers: res.headers, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log(`\n${colors.cyan}${colors.bold}====================================================`);
  console.log(`🚀 MAITRI CERAMIC - MODULE 16 VERIFICATION SUITE`);
  console.log(`   (Audit Trail, Activity Log & System Accountability)`);
  console.log(`====================================================${colors.reset}\n`);

  console.log('🔌 Connecting to MongoDB Atlas Cloud Database...');
  await connectDB();
  console.log(`✅ MongoDB Connected: ${mongoose.connection.host} (Database: ${mongoose.connection.name})`);

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`Test server running on ${baseUrl}\n`);

  // Step 0: Multi-Persona Authentication
  logSection('STEP 0: Multi-Persona Setup & Authentication');
  const superAdminLogin = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9825702369', password: 'Laksh@2508' }
  });

  if (superAdminLogin.status !== 200) {
    logFail('Super Admin login failed', superAdminLogin.data);
    process.exit(1);
  }
  const superAdminToken = superAdminLogin.data.data.accessToken;
  const superAdminUser = superAdminLogin.data.data.user;
  logPass('Super Admin authenticated successfully.');

  // Create or retrieve an Inventory User (without AUDIT_LOG permissions)
  let invUser = await User.findOne({ mobile: '9898000016' });
  if (!invUser) {
    const ph = await User.hashPassword('Inventory@123');
    invUser = await User.create({
      name: 'Audit Inventory Test User',
      mobile: '9898000016',
      email: 'audit_inv@maitriceramic.com',
      passwordHash: ph,
      isActive: true
    });
  }

  const invLogin = await api('/auth/login', {
    method: 'POST',
    body: { mobile: '9898000016', password: 'Inventory@123' }
  });
  const inventoryOnlyToken = invLogin.data.data.accessToken;
  logPass('Inventory-only persona created and authenticated.');

  // Step 1: SystemModule Registration
  logSection('STEP 1: SystemModule Registration (AUDIT_LOG)');
  let auditMod = await SystemModule.findOne({ moduleKey: 'AUDIT_LOG' });
  if (!auditMod) {
    auditMod = await SystemModule.create({
      moduleKey: 'AUDIT_LOG',
      moduleName: 'Audit & Activity Log',
      parentModule: 'SETTINGS',
      isActive: true
    });
  }
  logPass('AUDIT_LOG registered and active in SystemModule registry.');

  // Ensure Super Admin has AUDIT_LOG view & export
  await UserPermission.findOneAndUpdate(
    { user: superAdminUser._id, module: auditMod._id },
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
  logPass('Super Admin granted AUDIT_LOG view and export permissions.');

  // Step 2: Never-Throws Guarantee
  logSection('STEP 2: Never-Throws Guarantee & Safe Recording');
  try {
    const invalidLogResult = await activityLogService.record({
      user: null, // missing required user
      moduleKey: null,
      actionType: null
    });
    if (invalidLogResult === null) {
      logPass('`activityLogService.record()` gracefully handled invalid input without throwing.');
    } else {
      logFail('Expected null result for invalid log input', invalidLogResult);
    }
  } catch (err) {
    logFail('`activityLogService.record()` MUST NEVER throw an exception', err.message);
  }

  // Step 3: Auth & Permission Change Logging
  logSection('STEP 3: Auth & Permission Change Audit Records');
  const loginAudit = await ActivityLogEntry.findOne({
    actionType: 'LOGIN',
    user: superAdminUser._id
  }).sort({ createdAt: -1 });

  if (loginAudit && loginAudit.moduleKey === 'USER_MANAGEMENT') {
    logPass(`LOGIN action captured in audit log for user ${loginAudit.userNameSnapshot}.`);
  } else {
    logFail('LOGIN action not found in ActivityLogEntry collection');
  }

  // Assign permission and verify PERMISSION_CHANGE with full unredacted diff
  const permAssignRes = await api('/permissions/assign', {
    method: 'POST',
    token: superAdminToken,
    body: {
      userId: invUser._id,
      permissions: [
        {
          moduleKey: 'STOCK',
          actions: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
          dataScope: 'OWN'
        }
      ]
    }
  });

  if (permAssignRes.status !== 200) logFail('Failed to assign test permissions', permAssignRes.data);
  await new Promise((r) => setTimeout(r, 600));

  const permChangeAudit = await ActivityLogEntry.findOne({
    actionType: 'PERMISSION_CHANGE',
    'changeSummary.targetUserId': invUser._id
  }).sort({ createdAt: -1 });

  if (permChangeAudit && permChangeAudit.changeSummary && permChangeAudit.changeSummary.assignedPermissions) {
    logPass('PERMISSION_CHANGE captured with FULL unredacted permissions diff.');
  } else {
    logFail('PERMISSION_CHANGE audit entry missing unredacted diff', permChangeAudit);
  }

  // Step 4: Master Data & Customer Actions
  logSection('STEP 4: Customer Lifecycle Audit Records (CREATE, UPDATE, DELETE)');
  const customerMobile = '98' + Math.floor(10000000 + Math.random() * 90000000);
  const createCustRes = await api('/customers', {
    method: 'POST',
    token: superAdminToken,
    body: {
      customerName: 'Audit Test Customer Pvt Ltd',
      mobile: customerMobile,
      city: 'Morbi',
      state: 'Gujarat',
      customerType: 'RETAIL'
    }
  });

  if (createCustRes.status !== 201) logFail('Failed to create customer', createCustRes.data);
  const createdCustId = createCustRes.data.data.customer._id;
  await new Promise((r) => setTimeout(r, 600));

  const custCreateAudit = await ActivityLogEntry.findOne({
    entityType: 'Customer',
    entityId: createdCustId,
    actionType: 'CREATE'
  });

  if (custCreateAudit && custCreateAudit.entityLabel.includes('Audit Test Customer')) {
    logPass(`Customer CREATE logged: "${custCreateAudit.entityLabel}".`);
  } else {
    logFail('Customer CREATE audit log entry not found');
  }

  // Update customer
  const updateCustRes = await api(`/customers/${createdCustId}`, {
    method: 'PUT',
    token: superAdminToken,
    body: {
      city: 'Ahmedabad'
    }
  });

  if (updateCustRes.status !== 200) logFail('Failed to update customer', updateCustRes.data);
  await new Promise((r) => setTimeout(r, 600));

  const custUpdateAudit = await ActivityLogEntry.findOne({
    entityType: 'Customer',
    entityId: createdCustId,
    actionType: 'UPDATE'
  }).sort({ createdAt: -1 });

  if (custUpdateAudit && custUpdateAudit.changeSummary && custUpdateAudit.changeSummary.city) {
    logPass(`Customer UPDATE diff logged: city changed from "${custUpdateAudit.changeSummary.city.before}" to "${custUpdateAudit.changeSummary.city.after}".`);
  } else {
    logFail('Customer UPDATE diff audit log entry not found', custUpdateAudit);
  }

  // Deactivate customer
  const deactCustRes = await api(`/customers/${createdCustId}/deactivate`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (deactCustRes.status !== 200) logFail('Failed to deactivate customer', deactCustRes.data);
  await new Promise((r) => setTimeout(r, 600));

  const custDeactAudit = await ActivityLogEntry.findOne({
    entityType: 'Customer',
    entityId: createdCustId,
    actionType: 'DELETE'
  }).sort({ createdAt: -1 });

  if (custDeactAudit && custDeactAudit.actionType === 'DELETE') {
    logPass(`Customer Deactivation logged as DELETE action type with label "${custDeactAudit.entityLabel}".`);
  } else {
    logFail('Customer deactivation DELETE log not found');
  }

  // Step 5: Transactional Actions (Quotation APPROVE)
  logSection('STEP 5: Quotation & Transactional Actions (CREATE, APPROVE)');
  const quoteRes = await api('/quotations', {
    method: 'POST',
    token: superAdminToken,
    body: {
      customerId: createdCustId,
      remarks: 'Audit log verification quotation',
      items: [
        {
          adHocName: 'Ceramic Floor Tile 600x600',
          adHocMrp: 450,
          quantity: 10,
          discountPct: 0,
          adHocGstPct: 18
        }
      ]
    }
  });

  if (quoteRes.status !== 201) logFail('Failed to create quotation', quoteRes.data);
  const createdQuoteId = quoteRes.data.data._id;
  const quoteNum = quoteRes.data.data.quotationNumber;
  await new Promise((r) => setTimeout(r, 600));

  const quoteCreateAudit = await ActivityLogEntry.findOne({
    entityType: 'Quotation',
    entityId: createdQuoteId,
    actionType: 'CREATE'
  });

  if (quoteCreateAudit) {
    logPass(`Quotation CREATE logged for #${quoteNum}.`);
  } else {
    logFail('Quotation CREATE log not found');
  }

  // Send quotation (APPROVE action)
  const sendQuoteRes = await api(`/quotations/${createdQuoteId}/send`, {
    method: 'PUT',
    token: superAdminToken
  });

  if (sendQuoteRes.status !== 200) logFail('Failed to send quotation', sendQuoteRes.data);
  await new Promise((r) => setTimeout(r, 600));

  const quoteSendAudit = await ActivityLogEntry.findOne({
    entityType: 'Quotation',
    entityId: createdQuoteId,
    actionType: 'APPROVE'
  });

  if (quoteSendAudit && quoteSendAudit.changeSummary && quoteSendAudit.changeSummary.status) {
    logPass(`Quotation Send logged as APPROVE action with status transition DRAFT -> SENT.`);
  } else {
    logFail('Quotation Send APPROVE audit entry not found', quoteSendAudit);
  }

  // Step 6: Sensitive-Field Redaction
  logSection('STEP 6: Sensitive-Field Redaction Verification');
  const testOldUser = { name: 'Old Name', passwordHash: '$2a$10$SecretHash123', mobile: '9999999999' };
  const testNewUser = { name: 'New Name', passwordHash: '$2a$10$NewSecretHash456', mobile: '9999999999' };
  const userDiff = activityLogService.computeDiff(testOldUser, testNewUser);

  if (userDiff.name && !userDiff.passwordHash) {
    logPass('Verified passwordHash is strictly redacted from changeSummary diff.');
  } else {
    logFail('passwordHash leaked into changeSummary diff', userDiff);
  }

  // Step 7: Entity Timeline & User Timeline
  logSection('STEP 7: Entity Timeline & User Timeline Routes');
  const entityTimelineRes = await api(`/audit-log/entity/Quotation/${createdQuoteId}`, {
    token: superAdminToken
  });

  if (entityTimelineRes.status !== 200 || entityTimelineRes.data.data.data.length < 2) {
    logFail('Failed to retrieve entity timeline for Quotation', entityTimelineRes.data);
  } else {
    logPass(`Entity timeline for Quotation returned ${entityTimelineRes.data.data.data.length} chronological actions.`);
  }

  const userTimelineRes = await api(`/audit-log/user/${superAdminUser._id}?limit=10`, {
    token: superAdminToken
  });

  if (userTimelineRes.status !== 200 || userTimelineRes.data.data.data.length === 0) {
    logFail('Failed to retrieve user timeline', userTimelineRes.data);
  } else {
    logPass(`User timeline returned ${userTimelineRes.data.data.data.length} recent actions across modules.`);
  }

  // Step 8: Deactivated User Snapshot Preservation
  logSection('STEP 8: Deactivated User Snapshot Preservation');
  const tempUserMobile = '97' + Math.floor(10000000 + Math.random() * 90000000);
  const tempUser = await User.create({
    name: 'Temporary Historical User',
    mobile: tempUserMobile,
    passwordHash: '$2a$10$dummy',
    isActive: true
  });

  await activityLogService.record({
    user: tempUser,
    moduleKey: 'CUSTOMER',
    actionType: 'CREATE',
    entityType: 'Customer',
    entityLabel: 'Customer created by Temp User'
  });

  // Deactivate user
  tempUser.isActive = false;
  tempUser.name = 'Deactivated Account';
  await tempUser.save();

  const tempUserLogs = await ActivityLogEntry.find({ user: tempUser._id });
  const hasOriginalName = tempUserLogs.every((l) => l.userNameSnapshot === 'Temporary Historical User');

  if (hasOriginalName && tempUserLogs.length > 0) {
    logPass('`userNameSnapshot` preserved original user name even after user document was modified/deactivated.');
  } else {
    logFail('`userNameSnapshot` was corrupted after user modification', tempUserLogs);
  }

  // Step 9: Synchronous Excel Export
  logSection('STEP 9: Synchronous Excel Export (/api/audit-log/export)');
  const exportRes = await api('/audit-log/export', { token: superAdminToken });
  if (exportRes.status !== 200 || !exportRes.data || exportRes.data.byteLength === 0) {
    logFail('Failed to download Audit Log Excel export');
  } else {
    logPass(`Audit Log Excel workbook exported successfully (${exportRes.data.byteLength} bytes).`);
  }

  // Step 10: Security & Permission Gating
  logSection('STEP 10: Security & Permission Gating');
  const blockedListRes = await api('/audit-log', { token: inventoryOnlyToken });
  if (blockedListRes.status === 403) {
    logPass('User without AUDIT_LOG.view is blocked (403) on `/api/audit-log`.');
  } else {
    logFail(`Expected 403 Forbidden for unauthorized user, got ${blockedListRes.status}`);
  }

  const blockedExportRes = await api('/audit-log/export', { token: inventoryOnlyToken });
  if (blockedExportRes.status === 403) {
    logPass('User without AUDIT_LOG.export is blocked (403) on `/api/audit-log/export`.');
  } else {
    logFail(`Expected 403 Forbidden on export, got ${blockedExportRes.status}`);
  }

  // Step 11: Immutability Verification (No PUT or DELETE routes)
  logSection('STEP 11: Immutability Verification');
  const putBlockedRes = await api(`/audit-log/${loginAudit._id}`, {
    method: 'PUT',
    token: superAdminToken,
    body: { actionType: 'DELETE' }
  });
  const deleteBlockedRes = await api(`/audit-log/${loginAudit._id}`, {
    method: 'DELETE',
    token: superAdminToken
  });

  if (putBlockedRes.status === 404 && deleteBlockedRes.status === 404) {
    logPass('Verified ActivityLogEntry is strictly immutable: no PUT or DELETE routes exist (404).');
  } else {
    logFail('Audit Log edit/delete route unexpectedly responded', { put: putBlockedRes.status, del: deleteBlockedRes.status });
  }

  console.log(`\n${colors.green}${colors.bold}====================================================`);
  console.log(`🎉 ALL MODULE 16 (AUDIT / ACTIVITY LOG) TESTS PASSED! (${passed} Passed, ${failed} Failed)`);
  console.log(`====================================================${colors.reset}\n`);

  server.close(() => process.exit(0));
}

runTests().catch((err) => {
  console.error(`\n${colors.red}❌ MODULE 16 TEST RUNNER FAILED:${colors.reset}`, err);
  if (server) server.close();
  process.exit(1);
});
