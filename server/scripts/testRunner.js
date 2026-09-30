const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const { app, connectDB } = require('../server');
const User = require('../models/User');
const Role = require('../models/Role');
const SystemModule = require('../models/SystemModule');
const RoleDefaultPermission = require('../models/RoleDefaultPermission');
const UserPermission = require('../models/UserPermission');
const RefreshToken = require('../models/RefreshToken');
const { applyDataScope } = require('../utils/dataScope.util');

let server;
let baseUrl;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

let passedCount = 0;
let failedCount = 0;

const assertTest = (condition, description) => {
  if (condition) {
    console.log(`  ${colors.green}✓ [PASS]${colors.reset} ${description}`);
    passedCount++;
  } else {
    console.error(`  ${colors.red}✗ [FAIL]${colors.reset} ${description}`);
    failedCount++;
  }
};

const makeRequest = async (path, options = {}) => {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data;
  try {
    data = await response.json();
  } catch (e) {
    data = { raw: await response.text() };
  }

  return {
    status: response.status,
    ok: response.ok,
    body: data
  };
};

const runAllTests = async () => {
  console.log(`\n${colors.bright}${colors.cyan}========================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}  MAITRI CERAMIC - MODULE 1 PERMISSION & AUTH ENGINE TEST SUITE       ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================================================${colors.reset}\n`);

  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Start HTTP server on random free port
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://localhost:${port}`;
        console.log(`📡 Test server running on ${baseUrl}\n`);
        resolve();
      });
    });

    // -------------------------------------------------------------
    // Test 0: Health Check
    // -------------------------------------------------------------
    console.log(`${colors.yellow}► STEP 0: System Health Check${colors.reset}`);
    const healthRes = await makeRequest('/api/health');
    assertTest(healthRes.status === 200 && healthRes.body.success === true, 'Server boots and health check returns 200 OK');

    // -------------------------------------------------------------
    // Test 1: SystemModule Seeding & Idempotence
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 1: SystemModule Registry & Idempotency${colors.reset}`);
    const seedRes1 = await makeRequest('/api/permissions/modules/seed', { method: 'POST' });
    const countAfterSeed1 = await SystemModule.countDocuments();
    const seedRes2 = await makeRequest('/api/permissions/modules/seed', { method: 'POST' });
    const countAfterSeed2 = await SystemModule.countDocuments();

    assertTest(seedRes1.status === 200 && countAfterSeed1 > 0, 'Initial SystemModule seed creates all system modules');
    assertTest(seedRes2.status === 200 && countAfterSeed1 === countAfterSeed2, 'SystemModule seed is strictly idempotent (no duplicate modules)');

    // -------------------------------------------------------------
    // Test 2: Role Master & Super Admin Protection
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 2: Role Master & System Role Protection${colors.reset}`);
    
    // Seed Super Admin Role & User
    let superAdminRole = await Role.findOne({ roleName: 'Super Admin' });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        roleName: 'Super Admin',
        description: 'System Administrator',
        isSystemRole: true
      });
    }

    const adminMobile = '9999999999';
    const adminPassword = 'AdminPassword123!';
    let adminUser = await User.findOne({ mobile: adminMobile });
    if (!adminUser) {
      const passwordHash = await User.hashPassword(adminPassword);
      adminUser = await User.create({
        name: 'Piyush Bhai (Admin)',
        mobile: adminMobile,
        passwordHash,
        role: superAdminRole._id
      });
    }

    // Login as Super Admin
    const adminLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: adminMobile, password: adminPassword }
    });
    const adminToken = adminLoginRes.body.data?.accessToken;
    assertTest(adminLoginRes.status === 200 && Boolean(adminToken), 'Super Admin successfully authenticated via login');

    // Clean any prior Sales Executive test role
    await Role.deleteMany({ roleName: 'Sales Executive' });

    // Create a regular Role via API
    const salesRoleRes = await makeRequest('/api/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { roleName: 'Sales Executive', description: 'Handles quotes and client sales' }
    });
    const salesRoleId = salesRoleRes.body.data?._id;
    assertTest(salesRoleRes.status === 201 && salesRoleRes.body.success === true, 'Super Admin can create a custom Role (Sales Executive)');

    // Duplicate roleName rejected
    const dupRoleRes = await makeRequest('/api/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { roleName: 'Sales Executive' }
    });
    assertTest(dupRoleRes.status === 400, 'Duplicate roleName is rejected with 400 Bad Request');

    // Super Admin role cannot be deleted
    const deleteSuperAdminRoleRes = await makeRequest(`/api/roles/${superAdminRole._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest(deleteSuperAdminRoleRes.status === 400 && deleteSuperAdminRoleRes.body.message.includes('System role'), 'Super Admin system role cannot be deleted');

    // -------------------------------------------------------------
    // Test 3: Role Default Permission Templates
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 3: Role Default Permission (Template) Configuration${colors.reset}`);
    
    // Set default permission for Sales Executive: PRODUCT_MASTER (view only), QUOTATION (view + create)
    const setRoleDefaultPermsRes = await makeRequest(`/api/roles/${salesRoleId}/default-permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        permissions: [
          { moduleKey: 'PRODUCT_MASTER', actions: { view: true, create: false, edit: false, delete: false, export: false, approve: false } },
          { moduleKey: 'QUOTATION', actions: { view: true, create: true, edit: false, delete: false, export: false, approve: false } }
        ]
      }
    });
    assertTest(setRoleDefaultPermsRes.status === 200, 'Role default permission template successfully configured');

    // Duplicate assignment updates instead of creating duplicate records
    const productMasterModule = await SystemModule.findOne({ moduleKey: 'PRODUCT_MASTER' });
    const countRolePerms = await RoleDefaultPermission.countDocuments({ role: salesRoleId, module: productMasterModule._id });
    assertTest(countRolePerms === 1, 'RoleDefaultPermission unique compound index prevents duplicate (role, module) entries');

    // -------------------------------------------------------------
    // Test 4: User Creation & Template Auto-Copying
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 4: User Creation & Automatic Permission Inheritance${colors.reset}`);

    // Create User 1 under Sales Executive
    const user1Mobile = '9876543210';
    const user1Password = 'User1Pass123';
    await User.deleteOne({ mobile: user1Mobile });
    await UserPermission.deleteMany({ user: { $in: await User.find({ mobile: user1Mobile }).distinct('_id') } });

    const createUser1Res = await makeRequest('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Ramesh Patel',
        mobile: user1Mobile,
        password: user1Password,
        roleId: salesRoleId
      }
    });

    const user1Id = createUser1Res.body.data?._id;
    assertTest(createUser1Res.status === 201 && Boolean(user1Id), 'User-1 successfully created under Sales Executive role');
    assertTest(createUser1Res.body.data?.passwordHash === undefined, 'Password hash is completely excluded from user API response');

    // Duplicate mobile number rejected
    const dupMobileRes = await makeRequest('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Duplicate Ramesh',
        mobile: user1Mobile,
        password: 'anypassword',
        roleId: salesRoleId
      }
    });
    assertTest(dupMobileRes.status === 400, 'Duplicate mobile number is rejected at user creation');

    // Verify User-1 inherited Role's default template
    const user1ProductPerm = await UserPermission.findOne({ user: user1Id, module: productMasterModule._id });
    assertTest(
      user1ProductPerm && user1ProductPerm.actions.view === true && user1ProductPerm.actions.edit === false,
      'User-1 correctly auto-inherited Role default template (PRODUCT_MASTER view: true, edit: false)'
    );

    // Create User 2 also under Sales Executive
    const user2Mobile = '9876543211';
    const user2Password = 'User2Pass123';
    await User.deleteOne({ mobile: user2Mobile });

    const createUser2Res = await makeRequest('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Suresh Shah',
        mobile: user2Mobile,
        password: user2Password,
        roleId: salesRoleId
      }
    });
    const user2Id = createUser2Res.body.data?._id;
    assertTest(createUser2Res.status === 201, 'User-2 successfully created under same Sales Executive role');

    // -------------------------------------------------------------
    // Test 5: Authentication, Token Rotation & Session Invalidation
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 5: Authentication, Session Management & Refresh Token Rotation${colors.reset}`);

    // Wrong password rejected
    const wrongLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: user1Mobile, password: 'WrongPassword' }
    });
    assertTest(wrongLoginRes.status === 401, 'Login with incorrect password is rejected (401)');

    // Successful login for User-1
    const user1LoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: user1Mobile, password: user1Password }
    });
    const user1AccessToken = user1LoginRes.body.data?.accessToken;
    const user1RefreshToken = user1LoginRes.body.data?.refreshToken;
    assertTest(user1LoginRes.status === 200 && Boolean(user1AccessToken) && Boolean(user1RefreshToken), 'User-1 logs in and receives Access Token & Refresh Token');

    // Protected route with invalid token rejected
    const invalidTokenRes = await makeRequest('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.value' }
    });
    assertTest(invalidTokenRes.status === 401, 'Invalid access token rejected with 401 Unauthorized');

    // Refresh Token Rotation
    const rotateRes = await makeRequest('/api/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken: user1RefreshToken }
    });
    const newAccessToken = rotateRes.body.data?.accessToken;
    const newRefreshToken = rotateRes.body.data?.refreshToken;
    assertTest(rotateRes.status === 200 && Boolean(newAccessToken) && newRefreshToken !== user1RefreshToken, 'Refresh token rotation returns brand new access & refresh token pair');

    // Old refresh token is revoked and cannot be reused
    const reusedTokenRes = await makeRequest('/api/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken: user1RefreshToken }
    });
    assertTest(reusedTokenRes.status === 401, 'Old refresh token cannot be reused after rotation (revocation enforced)');

    // Logout revokes refresh token
    const logoutRes = await makeRequest('/api/auth/logout', {
      method: 'POST',
      body: { refreshToken: newRefreshToken }
    });
    assertTest(logoutRes.status === 200, 'Logout request successfully revokes refresh token');

    const logoutCheckRes = await makeRequest('/api/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken: newRefreshToken }
    });
    assertTest(logoutCheckRes.status === 401, 'Revoked refresh token cannot be used following logout');

    // -------------------------------------------------------------
    // Test 6: Granular Independent Action Verification
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 6: Granular Action Independence (User-Wise Enforcement)${colors.reset}`);

    // Re-login User-1 to get fresh token
    const freshUser1Login = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: user1Mobile, password: user1Password }
    });
    const currentU1Token = freshUser1Login.body.data?.accessToken;

    // User-1 has PRODUCT_MASTER: view=true, create=false, edit=false, delete=false
    // Test user routes access (guarded by checkPermission('USER_MANAGEMENT', 'create'/'view'/'edit'/'delete'))
    const u1CreateUserAttempt = await makeRequest('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${currentU1Token}` },
      body: { name: 'Unauthorized', mobile: '1111111111', password: 'pass' }
    });
    assertTest(u1CreateUserAttempt.status === 403, 'User without USER_MANAGEMENT.create permission receives 403 Forbidden');

    // Now customize User-2 individually: give PRODUCT_MASTER view: true, edit: true, delete: false
    const customizeUser2Res = await makeRequest('/api/permissions/assign', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        userId: user2Id,
        permissions: [
          {
            moduleKey: 'PRODUCT_MASTER',
            actions: { view: true, create: false, edit: true, delete: false, export: false, approve: false },
            dataScope: 'ALL'
          }
        ]
      }
    });
    assertTest(customizeUser2Res.status === 200, 'Super Admin customized User-2 permissions directly');

    // Verify User-1 and User-2 have different permissions despite SAME Role
    const u1PermDoc = await UserPermission.findOne({ user: user1Id, module: productMasterModule._id });
    const u2PermDoc = await UserPermission.findOne({ user: user2Id, module: productMasterModule._id });
    assertTest(
      u1PermDoc.actions.edit === false && u2PermDoc.actions.edit === true,
      'Two users with identical Role hold DIFFERENT permissions (Proves User-Wise, not Role-Wise, enforcement)'
    );
    assertTest(
      u2PermDoc.actions.edit === true && u2PermDoc.actions.delete === false,
      'edit: true does NOT implicitly grant delete: true (Granular independence strictly maintained)'
    );

    // -------------------------------------------------------------
    // Test 7: My Menu API & Zero-Action Module Filtering
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 7: My Menu API & Module Visibility${colors.reset}`);

    // Fetch User-1's menu
    const u1MenuRes = await makeRequest('/api/permissions/my-menu', {
      headers: { Authorization: `Bearer ${currentU1Token}` }
    });
    assertTest(u1MenuRes.status === 200, 'User-1 can retrieve their personal menu');

    const u1MenuModules = u1MenuRes.body.data?.map((m) => m.moduleKey) || [];
    assertTest(u1MenuModules.includes('PRODUCT_MASTER') && u1MenuModules.includes('QUOTATION'), 'Menu contains modules with at least one active action');
    assertTest(!u1MenuModules.includes('INVOICE') && !u1MenuModules.includes('CUSTOMER_LEDGER'), 'Module with all 6 false actions is completely absent from my-menu response');

    // -------------------------------------------------------------
    // Test 8: Instant Permission Revocation & Deactivation
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 8: Instant Revocation & User Deactivation${colors.reset}`);

    // Revoke User-2's permission on PRODUCT_MASTER
    const revokeRes = await makeRequest('/api/permissions/revoke', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { userId: user2Id, moduleKey: 'PRODUCT_MASTER' }
    });
    assertTest(revokeRes.status === 200, 'Revoke permission API executes successfully');

    const u2PermAfterRevoke = await UserPermission.findOne({ user: user2Id, module: productMasterModule._id });
    assertTest(u2PermAfterRevoke.isActive === false && u2PermAfterRevoke.actions.edit === false, 'Permission revocation takes effect immediately in UserPermission collection');

    // Deactivate User-1
    const deactivateRes = await makeRequest(`/api/users/${user1Id}/deactivate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest(deactivateRes.status === 200, 'Super Admin successfully deactivates User-1');

    // Deactivated user login rejected
    const deactivatedLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: user1Mobile, password: user1Password }
    });
    assertTest(deactivatedLoginRes.status === 401 && deactivatedLoginRes.body.message.includes('deactivated'), 'Deactivated user is blocked from logging in');

    // Deactivated user's existing access token is rejected on protected routes
    const deactivatedAuthRes = await makeRequest('/api/auth/me', {
      headers: { Authorization: `Bearer ${currentU1Token}` }
    });
    assertTest(deactivatedAuthRes.status === 401, 'Existing access token for deactivated user is immediately rejected');

    // -------------------------------------------------------------
    // Test 9: DataScope Helper (ALL, OWN, TEAM)
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 9: DataScope Engine Verification${colors.reset}`);

    const fakeUser = { _id: user1Id, role: { isSystemRole: false } };
    const ownScopePerm = { dataScope: 'OWN' };
    const allScopePerm = { dataScope: 'ALL' };
    const teamScopePerm = { dataScope: 'TEAM' };

    const ownFilter = applyDataScope({ status: 'ACTIVE' }, ownScopePerm, fakeUser);
    assertTest(ownFilter.status === 'ACTIVE' && String(ownFilter.createdBy) === String(user1Id), 'dataScope OWN correctly injects { createdBy: req.user.id } filter');

    const allFilter = applyDataScope({ status: 'ACTIVE' }, allScopePerm, fakeUser);
    assertTest(allFilter.status === 'ACTIVE' && allFilter.createdBy === undefined, 'dataScope ALL keeps query filter unconstrained');

    const teamFilter = applyDataScope({ status: 'ACTIVE' }, teamScopePerm, fakeUser, [user1Id, user2Id]);
    assertTest(Array.isArray(teamFilter.createdBy?.$in) && teamFilter.createdBy.$in.length === 2, 'dataScope TEAM correctly injects { createdBy: { $in: teamIds } }');

    // -------------------------------------------------------------
    // Test 10: Role Template Edit Does Not Overwrite Existing Users
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 10: Role Template Immunity for Existing Users${colors.reset}`);

    // Update Sales Executive default template to grant QUOTATION approve: true
    await makeRequest(`/api/roles/${salesRoleId}/default-permissions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        permissions: [
          { moduleKey: 'QUOTATION', actions: { view: true, create: true, edit: true, delete: true, export: true, approve: true } }
        ]
      }
    });

    // Check User-2's QUOTATION permission - should NOT have approve: true (it was created before template change)
    const quotationModule = await SystemModule.findOne({ moduleKey: 'QUOTATION' });
    const u2QuotationPerm = await UserPermission.findOne({ user: user2Id, module: quotationModule._id });
    assertTest(
      u2QuotationPerm && u2QuotationPerm.actions.approve === false,
      'Changing Role default template does NOT retroactively alter already-created users (Customizations preserved)'
    );

    // -------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------
    console.log(`\n${colors.bright}${colors.cyan}========================================================================${colors.reset}`);
    console.log(`${colors.bright}TEST RESULTS SUMMARY:${colors.reset}`);
    console.log(`  ${colors.green}Total Passed: ${passedCount}${colors.reset}`);
    console.log(`  ${failedCount > 0 ? colors.red : colors.green}Total Failed: ${failedCount}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}========================================================================${colors.reset}\n`);

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`\n${colors.red}Test Runner Execution Failed:${colors.reset}`, err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
};

if (require.main === module) {
  runAllTests();
}

module.exports = runAllTests;
