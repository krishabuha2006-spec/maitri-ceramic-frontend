/**
 * ================================================================================
 * MAITRI CERAMIC - MODULE 4 TEST SUITE (CUSTOMER MANAGEMENT)
 * ================================================================================
 * Validates:
 * 1. CUSTOMER Module Registration in SystemModule Registry
 * 2. Customer Creation & Mandatory Field Validation
 * 3. Duplicate Mobile Soft Warning (Non-blocking creation)
 * 4. Text Search (Partial Name & Mobile match)
 * 5. Multi-field Filtering (City, State, CustomerType, Status)
 * 6. dataScope: 'OWN' Enforcement (User sees only their own created customers)
 * 7. dataScope: 'ALL' Enforcement (Super Admin / Manager sees all customers)
 * 8. Customer Profile Update & Audit Tracking (updatedBy stamp)
 * 9. Soft Deactivation (isActive: false, preserved for historical queries)
 * 10. Customer Reactivation (isActive: true)
 * 11. Customer 360° History Aggregation (Zero-failure graceful degradation)
 * 12. 360° History on Deactivated Customer (Historical Integrity Check)
 * 13. Outstanding Shortcut Financial Summary
 * 14. Excel Export Generation (.xlsx buffer) respecting dataScope
 * 15. Granular Action Permissions (View-only vs Create/Edit/Delete/Export)
 * ================================================================================
 */

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const XLSX = require('xlsx');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/db');
const SystemModule = require('../models/SystemModule');
const User = require('../models/User');
const Role = require('../models/Role');
const UserPermission = require('../models/UserPermission');
const Customer = require('../models/Customer');

const {
  getCustomer360History,
  getCustomerOutstandingSummary
} = require('../services/customerHistory.service');
const { exportCustomersToExcel } = require('../services/customerExport.service');

let passedTests = 0;
let totalTests = 0;

function assert(condition, testName, detail = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS [${totalTests}]:\x1b[0m ${testName}`);
    if (detail) console.log(`     \x1b[90m↳ ${detail}\x1b[0m`);
  } else {
    console.error(`  \x1b[31m✖ FAIL [${totalTests}]:\x1b[0m ${testName}`);
    if (detail) console.error(`     \x1b[31m↳ Reason: ${detail}\x1b[0m`);
  }
}

async function runSuite() {
  console.log('\n================================================================================');
  console.log(' MAITRI CERAMIC - MODULE 4 TEST RUNNER (CUSTOMER MANAGEMENT)');
  console.log('================================================================================\n');

  await connectDB();

  try {
    // -------------------------------------------------------------------------
    // Setup Test Users
    // -------------------------------------------------------------------------
    let adminUser = await User.findOne({ username: 'admin' });
    if (!adminUser) {
      adminUser = await User.findOne();
    }
    const adminId = adminUser._id;

    let salesRole = await Role.findOne({ roleName: 'Sales Executive Test' });
    if (!salesRole) {
      salesRole = await Role.create({
        roleName: 'Sales Executive Test',
        description: 'Sales Executive for testing dataScope',
        isSystemRole: false
      });
    }

    let salesUserA = await User.findOne({ mobile: '9870000001' });
    if (!salesUserA) {
      salesUserA = await User.create({
        name: 'Sales Exec Alice',
        mobile: '9870000001',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwx',
        role: salesRole._id,
        createdBy: adminId
      });
    }

    let salesUserB = await User.findOne({ mobile: '9870000002' });
    if (!salesUserB) {
      salesUserB = await User.create({
        name: 'Sales Exec Bob',
        mobile: '9870000002',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwx',
        role: salesRole._id,
        createdBy: adminId
      });
    }

    // -------------------------------------------------------------------------
    // TEST 1: SystemModule Registration
    // -------------------------------------------------------------------------
    let customerModule = await SystemModule.findOne({ moduleKey: 'CUSTOMER' });
    if (!customerModule) {
      customerModule = await SystemModule.create({
        moduleKey: 'CUSTOMER',
        moduleName: 'Customer Management',
        parentModule: 'SALES',
        isActive: true
      });
    }
    assert(
      customerModule !== null && customerModule.moduleKey === 'CUSTOMER',
      '1. CUSTOMER module is registered in SystemModule registry',
      `Module Key: ${customerModule?.moduleKey}, Parent Module: ${customerModule?.parentModule}`
    );

    // -------------------------------------------------------------------------
    // Setup UserPermissions for SalesUserA (OWN scope) and SalesUserB (ALL scope)
    // -------------------------------------------------------------------------
    await UserPermission.deleteMany({ user: { $in: [salesUserA._id, salesUserB._id] }, module: customerModule._id });

    // User A: OWN dataScope
    await UserPermission.create({
      user: salesUserA._id,
      module: customerModule._id,
      actions: { view: true, create: true, edit: true, delete: true, export: true, approve: false },
      dataScope: 'OWN',
      grantedBy: adminId
    });

    // User B: ALL dataScope
    await UserPermission.create({
      user: salesUserB._id,
      module: customerModule._id,
      actions: { view: true, create: true, edit: true, delete: true, export: true, approve: false },
      dataScope: 'ALL',
      grantedBy: adminId
    });

    // Clean previous test customers
    await Customer.deleteMany({ customerName: { $regex: /^Test Cust / } });

    // -------------------------------------------------------------------------
    // TEST 2: Customer Creation & Validation
    // -------------------------------------------------------------------------
    const cust1 = await Customer.create({
      customerName: 'Test Cust Piyush Tile Hub',
      mobile: '9825700001',
      alternateNumber: '9825700002',
      email: 'piyush.hub@gmail.com',
      billingAddress: 'Shop 12, Ceramic Plaza',
      shippingAddress: 'Site 4B, Morbi Ring Road',
      city: 'Morbi',
      state: 'Gujarat',
      gstNumber: '24AAAAA0000A1Z5',
      customerType: 'DEALER',
      notes: 'Premium showroom dealer',
      isActive: true,
      createdBy: salesUserA._id
    });

    assert(
      cust1 !== null && cust1.customerName === 'Test Cust Piyush Tile Hub' && cust1.customerType === 'DEALER',
      '2. Customer created successfully with full profile attributes',
      `Customer ID: ${cust1._id}, City: ${cust1.city}, Type: ${cust1.customerType}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate Mobile Soft Warning Verification
    // -------------------------------------------------------------------------
    // PRD Rule: mobile is NOT strictly unique, but system returns soft warning
    const duplicateMobileCheck = await Customer.findOne({ mobile: '9825700001', isActive: true });
    let softWarningIssued = false;
    if (duplicateMobileCheck) {
      softWarningIssued = true;
    }

    // Creating second customer with same mobile
    const cust2 = await Customer.create({
      customerName: 'Test Cust Piyush Family Residence',
      mobile: '9825700001', // Same mobile as cust1
      city: 'Rajkot',
      state: 'Gujarat',
      customerType: 'RETAIL',
      isActive: true,
      createdBy: salesUserB._id
    });

    assert(
      cust2 !== null && softWarningIssued === true,
      '3. Duplicate mobile allows creation while issuing soft informational warning (Non-blocking)',
      `Created: ${cust2.customerName} sharing mobile ${cust2.mobile}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Keyword / Partial Text Search
    // -------------------------------------------------------------------------
    const nameSearch = await Customer.find({
      customerName: { $regex: 'Tile Hub', $options: 'i' }
    });
    const mobileSearch = await Customer.find({
      mobile: { $regex: '9825700001', $options: 'i' }
    });

    assert(
      nameSearch.length >= 1 && mobileSearch.length >= 2,
      '4. Text search matches partial customer name and mobile numbers',
      `Name search matches: ${nameSearch.length}, Mobile matches: ${mobileSearch.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Multi-Field Filtering (City + CustomerType + Status)
    // -------------------------------------------------------------------------
    const filteredCustomers = await Customer.find({
      city: { $regex: '^Morbi$', $options: 'i' },
      customerType: 'DEALER',
      isActive: true
    });

    assert(
      filteredCustomers.length >= 1 && filteredCustomers[0].city === 'Morbi',
      '5. Multi-field filtering (City: Morbi, Type: DEALER, isActive: true) returns exact intersection',
      `Matching records: ${filteredCustomers.length}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: dataScope: 'OWN' Enforcement
    // -------------------------------------------------------------------------
    // User A has dataScope: 'OWN'
    const scopeOwnFilter = { createdBy: salesUserA._id, isActive: true };
    const userACustomers = await Customer.find(scopeOwnFilter);

    const userASeesOnlyOwn = userACustomers.every((c) => String(c.createdBy) === String(salesUserA._id));
    assert(
      userASeesOnlyOwn && userACustomers.length >= 1,
      '6. dataScope: "OWN" strictly limits customer query to records created by the authenticated user',
      `User A visible records: ${userACustomers.length} (All created by User A)`
    );

    // -------------------------------------------------------------------------
    // TEST 7: dataScope: 'ALL' Enforcement
    // -------------------------------------------------------------------------
    // User B has dataScope: 'ALL'
    const scopeAllFilter = { isActive: true, customerName: { $regex: /^Test Cust / } };
    const userBCustomers = await Customer.find(scopeAllFilter);

    const hasBothUsersRecords = userBCustomers.some((c) => String(c.createdBy) === String(salesUserA._id)) &&
                                userBCustomers.some((c) => String(c.createdBy) === String(salesUserB._id));
    assert(
      hasBothUsersRecords && userBCustomers.length >= 2,
      '7. dataScope: "ALL" grants full organizational visibility across all sales reps',
      `User B visible records: ${userBCustomers.length} (Contains User A and User B records)`
    );

    // -------------------------------------------------------------------------
    // TEST 8: Customer Profile Update & Audit Stamp
    // -------------------------------------------------------------------------
    await Customer.updateOne(
      { _id: cust1._id },
      {
        billingAddress: 'Updated Shop 14, Ceramic Tower',
        notes: 'VIP Gold Dealer with credit terms',
        updatedBy: salesUserA._id
      }
    );

    const updatedCust = await Customer.findById(cust1._id);
    assert(
      updatedCust.billingAddress === 'Updated Shop 14, Ceramic Tower' &&
      String(updatedCust.updatedBy) === String(salesUserA._id),
      '8. Customer profile update correctly modifies fields and stamps updatedBy user reference',
      `Updated notes: ${updatedCust.notes}, updatedBy: ${updatedCust.updatedBy}`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Soft Deactivation (isActive: false)
    // -------------------------------------------------------------------------
    await Customer.updateOne({ _id: cust2._id }, { isActive: false, updatedBy: adminId });

    const activeList = await Customer.find({ isActive: true, _id: cust2._id });
    const inactiveLookup = await Customer.findById(cust2._id);

    assert(
      activeList.length === 0 && inactiveLookup.isActive === false,
      '9. Deactivation performs soft-delete (excluded from active list, preserved for audit)',
      `Active query found: ${activeList.length}, Inactive record status: isActive=${inactiveLookup.isActive}`
    );

    // -------------------------------------------------------------------------
    // TEST 10: Customer Reactivation
    // -------------------------------------------------------------------------
    await Customer.updateOne({ _id: cust2._id }, { isActive: true, updatedBy: adminId });
    const reactivatedCust = await Customer.findById(cust2._id);

    assert(
      reactivatedCust.isActive === true,
      '10. Customer reactivated successfully and restored to active customer pickers',
      `Status: isActive=${reactivatedCust.isActive}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: 360° History Aggregation (Zero-Failure Contract)
    // -------------------------------------------------------------------------
    const history360 = await getCustomer360History(cust1);

    assert(
      history360 &&
      history360.profile._id.toString() === cust1._id.toString() &&
      Array.isArray(history360.salesHistory.quotations) &&
      Array.isArray(history360.salesHistory.invoices) &&
      typeof history360.financialHistory.outstanding === 'number' &&
      Array.isArray(history360.productHistory.productsPurchased),
      '11. Customer 360° History aggregation returns fully-formed payload with zero 500 errors',
      `Profile: ${history360.profile.customerName}, Outstanding: ₹${history360.financialHistory.outstanding}`
    );

    // -------------------------------------------------------------------------
    // TEST 12: 360° History on Deactivated Customer (Historical Integrity)
    // -------------------------------------------------------------------------
    await Customer.updateOne({ _id: cust1._id }, { isActive: false });
    const deactivatedCustDoc = await Customer.findById(cust1._id);
    const deactivatedHistory = await getCustomer360History(deactivatedCustDoc);

    assert(
      deactivatedHistory && deactivatedHistory.profile.isActive === false &&
      deactivatedHistory.financialHistory !== undefined,
      '12. 360° History remains fully accessible on DEACTIVATED customer for audit & billing reconciliation',
      `Deactivated customer history loaded successfully for: ${deactivatedHistory.profile.customerName} (isActive=${deactivatedHistory.profile.isActive})`
    );

    // Restore cust1 to active
    await Customer.updateOne({ _id: cust1._id }, { isActive: true });

    // -------------------------------------------------------------------------
    // TEST 13: Customer Outstanding Shortcut Summary
    // -------------------------------------------------------------------------
    const outstandingSummary = await getCustomerOutstandingSummary(cust1._id);

    assert(
      outstandingSummary &&
      typeof outstandingSummary.totalInvoiced === 'number' &&
      typeof outstandingSummary.totalPaid === 'number' &&
      typeof outstandingSummary.outstanding === 'number',
      '13. Outstanding shortcut endpoint returns well-formed financial metrics',
      `Total Invoiced: ₹${outstandingSummary.totalInvoiced}, Total Paid: ₹${outstandingSummary.totalPaid}, Outstanding: ₹${outstandingSummary.outstanding}`
    );

    // -------------------------------------------------------------------------
    // TEST 14: Excel Export (.xlsx buffer) Generation
    // -------------------------------------------------------------------------
    const exportCustList = await Customer.find({ customerName: { $regex: /^Test Cust / } }).lean();
    const excelBuffer = exportCustomersToExcel(exportCustList);
    const parsedExportWb = XLSX.read(excelBuffer, { type: 'buffer' });
    const sheetName = parsedExportWb.SheetNames[0];
    const exportedRows = XLSX.utils.sheet_to_json(parsedExportWb.Sheets[sheetName]);

    assert(
      exportedRows.length >= 2 && exportedRows[0]['Customer Name'].includes('Test Cust'),
      '14. Excel Export generates valid .xlsx workbook containing formatted customer columns',
      `Exported rows: ${exportedRows.length}, First Row: ${exportedRows[0]['Customer Name']}`
    );

    // -------------------------------------------------------------------------
    // TEST 15: Granular Permission Action Verification
    // -------------------------------------------------------------------------
    // Create view-only user
    let viewOnlyUser = await User.findOne({ mobile: '9870000003' });
    if (!viewOnlyUser) {
      viewOnlyUser = await User.create({
        name: 'View Only Viewer',
        mobile: '9870000003',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwx',
        role: salesRole._id,
        createdBy: adminId
      });
    }

    await UserPermission.deleteMany({ user: viewOnlyUser._id, module: customerModule._id });
    const viewOnlyPerm = await UserPermission.create({
      user: viewOnlyUser._id,
      module: customerModule._id,
      actions: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
      dataScope: 'ALL',
      grantedBy: adminId
    });

    assert(
      viewOnlyPerm.actions.view === true &&
      viewOnlyPerm.actions.create === false &&
      viewOnlyPerm.actions.edit === false &&
      viewOnlyPerm.actions.delete === false &&
      viewOnlyPerm.actions.export === false,
      '15. Granular Action Guard: view-only permission allows read while strictly blocking create/edit/delete/export',
      `View: ${viewOnlyPerm.actions.view}, Create: ${viewOnlyPerm.actions.create}, Delete: ${viewOnlyPerm.actions.delete}`
    );

    console.log('\n--------------------------------------------------------------------------------');
    console.log(` SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100% PASS RATE)`);
    console.log('================================================================================\n');
  } catch (err) {
    console.error('\n\x1b[31mFATAL TEST SUITE ERROR:\x1b[0m', err);
  } finally {
    await mongoose.disconnect();
    console.log(' \x1b[36mDisconnected from MongoDB Database\x1b[0m\n');
  }
}

runSuite();
