const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const { app, connectDB } = require('../server');
const User = require('../models/User');
const Role = require('../models/Role');
const SystemModule = require('../models/SystemModule');
const UserPermission = require('../models/UserPermission');
const Company = require('../models/Company');
const ProductGroup = require('../models/ProductGroup');
const UnitMaster = require('../models/UnitMaster');
const TaxMaster = require('../models/TaxMaster');
const PaymentModeMaster = require('../models/PaymentModeMaster');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const { validateProductData } = require('../services/productValidation.service');

let server;
let baseUrl;

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
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
  console.log(`${colors.bright}${colors.cyan}  MAITRI CERAMIC - MODULE 2 MASTER MANAGEMENT TEST SUITE              ${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}========================================================================${colors.reset}\n`);

  try {
    // 1. Connect to Database & Sync Indexes
    await connectDB();
    try {
      await Product.syncIndexes();
    } catch (e) {
      // ignore
    }

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

    // 3. Ensure Super Admin Role & User exist with known credentials
    let superAdminRole = await Role.findOne({ roleName: 'Super Admin' });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        roleName: 'Super Admin',
        description: 'System Administrator',
        isSystemRole: true
      });
    } else {
      superAdminRole.isSystemRole = true;
      await superAdminRole.save();
    }

    const adminMobile = '9999999999';
    const adminPassword = 'AdminPassword123!';
    let adminUser = await User.findOne({ mobile: adminMobile });
    const passwordHash = await User.hashPassword(adminPassword);
    if (!adminUser) {
      adminUser = await User.create({
        name: 'Piyush Bhai (Admin)',
        mobile: adminMobile,
        passwordHash,
        role: superAdminRole._id,
        isActive: true
      });
    } else {
      adminUser.passwordHash = passwordHash;
      adminUser.role = superAdminRole._id;
      adminUser.isActive = true;
      await adminUser.save();
    }

    // Login as Super Admin
    const adminLoginRes = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: adminMobile, password: adminPassword }
    });
    const adminToken = adminLoginRes.body.data?.accessToken;
    assertTest(adminLoginRes.status === 200 && Boolean(adminToken), 'Super Admin successfully authenticated');

    // -------------------------------------------------------------
    // Test 1: Module 1 SystemModule Registry Check
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 1: SystemModule Registry Verification (All 8 Master Keys)${colors.reset}`);
    await makeRequest('/api/permissions/modules/seed', { method: 'POST' });
    
    const requiredKeys = [
      'COMPANY_MASTER',
      'PRODUCT_GROUP_MASTER',
      'PRODUCT_MASTER',
      'VENDOR_MASTER',
      'UNIT_MASTER',
      'TAX_MASTER',
      'PAYMENT_MODE_MASTER',
      'QUOTATION_FORMAT_MASTER'
    ];

    const seededModules = await SystemModule.find({ moduleKey: { $in: requiredKeys } });
    assertTest(seededModules.length === 8, 'All 8 Master module keys are successfully registered in SystemModule registry');

    // -------------------------------------------------------------
    // Test 2: Simple Masters CRUD & Uniqueness
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 2: Simple Masters (Unit, Tax, Payment Mode, Quotation Format, Product Group)${colors.reset}`);

    // Clean up test master records from previous runs
    await UnitMaster.deleteMany({ unitCode: { $in: ['TBOX', 'TBOX2'] } });
    await TaxMaster.deleteMany({ taxName: { $regex: '^Test ', $options: 'i' } });
    await PaymentModeMaster.deleteMany({ modeName: { $regex: '^Test ', $options: 'i' } });
    await QuotationFormatMaster.deleteMany({ formatKey: { $regex: '^TEST_', $options: 'i' } });
    await ProductGroup.deleteMany({ groupName: { $regex: '^Test ', $options: 'i' } });

    // Unit Master
    const unitRes = await makeRequest('/api/units', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { unitName: 'Test Box', unitCode: 'TBOX' }
    });
    const unitId = unitRes.body.data?._id;
    assertTest(unitRes.status === 201 && Boolean(unitId), 'Unit Master record created (Test Box - TBOX)');

    const dupUnitRes = await makeRequest('/api/units', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { unitName: 'Another Box', unitCode: 'TBOX' }
    });
    assertTest(dupUnitRes.status === 400, 'Duplicate unitCode is rejected with 400 Bad Request');

    // Tax Master
    const taxRes = await makeRequest('/api/tax-presets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { taxName: 'Test GST 18%', gstPct: 18, cgstPct: 9, sgstPct: 9 }
    });
    const taxId = taxRes.body.data?._id;
    assertTest(taxRes.status === 201 && Boolean(taxId), 'Tax Master preset created');

    const dupTaxRes = await makeRequest('/api/tax-presets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { taxName: 'Test GST 18%', gstPct: 18 }
    });
    assertTest(dupTaxRes.status === 400, 'Duplicate taxName is rejected');

    // Payment Mode Master
    const payRes = await makeRequest('/api/payment-modes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { modeName: 'Test UPI Transfer' }
    });
    assertTest(payRes.status === 201, 'Payment Mode Master created');

    // Quotation Format Master
    const qfRes = await makeRequest('/api/quotation-formats', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { formatKey: 'TEST_FORMAT', formatName: 'Test Format Name' }
    });
    assertTest(qfRes.status === 201, 'Quotation Format Master created');

    // Product Group Master
    const groupRes = await makeRequest('/api/product-groups', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { groupName: 'Test Premium Glazed Tiles' }
    });
    const groupId = groupRes.body.data?._id;
    assertTest(groupRes.status === 201 && Boolean(groupId), 'Product Group created');

    // Soft-deactivation verification
    const deactUnitRes = await makeRequest(`/api/units/${unitId}/deactivate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const checkUnitInDb = await UnitMaster.findById(unitId);
    assertTest(deactUnitRes.status === 200 && checkUnitInDb.isActive === false, 'Deactivating Unit performs soft-delete (isActive: false) without dropping document');

    // -------------------------------------------------------------
    // Test 3: Company Master & Single 'OWN' Rule
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 3: Company Master & Single 'OWN' Company Enforcement${colors.reset}`);

    // Ensure clean state for OWN company
    await Company.deleteMany({ companyName: { $regex: 'Test Own', $options: 'i' } });

    // Create Brand Manufacturer Company
    const brandCompanyRes = await makeRequest('/api/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        companyName: 'Somany Ceramics Ltd',
        companyType: 'BRAND_MANUFACTURER',
        gstNumber: '24ABCDE1234F1Z5'
      }
    });
    const brandCompanyId = brandCompanyRes.body.data?._id;
    assertTest(brandCompanyRes.status === 201 && Boolean(brandCompanyId), 'BRAND_MANUFACTURER company created successfully');

    // Attempt to create second OWN company when one exists
    const secondOwnCompanyRes = await makeRequest('/api/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        companyName: 'Duplicate Own Enterprise',
        companyType: 'OWN',
        gstNumber: '24AAAAA9999A1Z9'
      }
    });
    assertTest(secondOwnCompanyRes.status === 400 && secondOwnCompanyRes.body.message.includes('OWN'), 'System prevents creating more than one active OWN company');

    // -------------------------------------------------------------
    // Test 4: Vendor Master CRUD
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 4: Vendor Master CRUD${colors.reset}`);

    const vendorRes = await makeRequest('/api/vendors', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        vendorName: 'Morbi Clay Suppliers Pvt Ltd',
        mobile: '9898989898',
        email: 'morbi@claysuppliers.com',
        gstNumber: '24XYZAB1234C1Z1'
      }
    });
    const vendorId = vendorRes.body.data?._id;
    assertTest(vendorRes.status === 201 && Boolean(vendorId), 'Vendor Master record created successfully');

    // -------------------------------------------------------------
    // Test 5: Core Product Master & Dual SKU Behavior
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 5: Core Product Master & Dual SKU Logic${colors.reset}`);

    // Reactivate or use active unit
    const activeUnit = await UnitMaster.findOne({ isActive: true });

    // Clean test products
    await Product.deleteMany({ productName: { $regex: 'Test Product', $options: 'i' } });

    // Product 1 with Company SKU & Vendor SKU
    const p1Res = await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product 600x1200 Glossy',
        companySkuCode: 'MC-TL-600-01',
        vendorSkuCode: 'SOM-GLS-101',
        company: brandCompanyId,
        vendor: vendorId,
        productGroup: groupId,
        unit: activeUnit._id,
        mrp: 850,
        purchaseRate: 450,
        salePrice: 650,
        openingStock: 100,
        reorderAlertQty: 20,
        gstPct: 18
      }
    });
    const p1Id = p1Res.body.data?._id;
    assertTest(p1Res.status === 201 && p1Res.body.data?.currentStock === 100, 'Product-1 created with openingStock automatically initializing currentStock (100)');

    // Duplicate companySkuCode rejected
    const dupSkuRes = await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product Duplicate SKU',
        companySkuCode: 'MC-TL-600-01',
        unit: activeUnit._id
      }
    });
    assertTest(dupSkuRes.status === 400, 'Duplicate companySkuCode is strictly rejected');

    // Product 2 sharing the SAME vendorSkuCode (Allowed)
    const p2Res = await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product 2 Different Company SKU',
        companySkuCode: 'MC-TL-600-02',
        vendorSkuCode: 'SOM-GLS-101', // Same vendor SKU as P1
        unit: activeUnit._id,
        openingStock: 50,
        reorderAlertQty: 10
      }
    });
    assertTest(p2Res.status === 201, 'Duplicate vendorSkuCode across different products is ACCEPTED (vendor SKU is non-unique)');

    // SKU-less products (isSkuLess: true)
    const skuLess1 = await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product SKU Less 1',
        isSkuLess: true,
        unit: activeUnit._id
      }
    });
    const skuLess2 = await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product SKU Less 2',
        isSkuLess: true,
        unit: activeUnit._id
      }
    });
    assertTest(
      skuLess1.status === 201 && skuLess2.status === 201,
      'Multiple SKU-less products (isSkuLess: true) save cleanly without sparse-index collisions'
    );

    // -------------------------------------------------------------
    // Test 6: Search by Dual SKU & Low Stock
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 6: Dual SKU Search & Low-Stock Alerts${colors.reset}`);

    // Search by Company SKU
    const searchByCompSku = await makeRequest('/api/products/search-by-sku?code=MC-TL-600-01', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest(
      searchByCompSku.status === 200 && searchByCompSku.body.data?.length === 1 && searchByCompSku.body.data[0].companySkuCode === 'MC-TL-600-01',
      'Search by Company SKU correctly resolves the product'
    );

    // Search by Vendor SKU (returns both matching products)
    const searchByVenSku = await makeRequest('/api/products/search-by-sku?code=SOM-GLS-101', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest(
      searchByVenSku.status === 200 && searchByVenSku.body.data?.length === 2,
      'Search by Vendor SKU correctly returns all products sharing that vendor code'
    );

    // Create Low Stock Product
    await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product Low Stock Item',
        companySkuCode: 'MC-LOW-01',
        unit: activeUnit._id,
        openingStock: 5,
        reorderAlertQty: 15
      }
    });

    const lowStockRes = await makeRequest('/api/products/low-stock', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const hasLowStockItem = lowStockRes.body.data?.some((p) => p.companySkuCode === 'MC-LOW-01');
    assertTest(lowStockRes.status === 200 && hasLowStockItem, 'Low stock endpoint correctly identifies products with currentStock <= reorderAlertQty');

    // -------------------------------------------------------------
    // Test 7: currentStock Write Protection
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 7: currentStock Write Protection in PUT API${colors.reset}`);

    // Attempt to illegally modify currentStock via PUT /api/products/:id
    const editAttemptRes = await makeRequest(`/api/products/${p1Id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        productName: 'Test Product 600x1200 Glossy (Updated)',
        currentStock: 9999 // Should be ignored/stripped
      }
    });

    const p1AfterEdit = await Product.findById(p1Id);
    assertTest(
      editAttemptRes.status === 200 && p1AfterEdit.currentStock === 100,
      'Direct modifications to currentStock in PUT API are strictly ignored (Value remains 100)'
    );

    // -------------------------------------------------------------
    // Test 8: Forward Reference Quotation Usage (Module 5 Bridge)
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 8: Forward-Reference Quotation Usage Endpoint${colors.reset}`);

    const qUsageRes = await makeRequest(`/api/products/${p1Id}/quotation-usage`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest(
      qUsageRes.status === 200 && Array.isArray(qUsageRes.body.data) && qUsageRes.body.data.length === 0,
      'Quotation usage endpoint returns empty array [] gracefully when Module 5 is not yet installed'
    );

    // -------------------------------------------------------------
    // Test 9: Referential Integrity on Deactivation
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 9: Referential Integrity After Master Deactivation${colors.reset}`);

    // Deactivate the Brand Company
    await makeRequest(`/api/companies/${brandCompanyId}/deactivate`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    // Verify Product still populates the company correctly
    const p1Fetch = await makeRequest(`/api/products/${p1Id}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assertTest(
      p1Fetch.status === 200 && p1Fetch.body.data?.company?.companyName === 'Somany Ceramics Ltd',
      'Product preserves populated reference data even after parent Company is deactivated (Zero historical data loss)'
    );

    // -------------------------------------------------------------
    // Test 10: Shared Validation Service
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 10: Shared Validation Service (for Module 3 Import Reuse)${colors.reset}`);

    // 1. Missing name & unit
    const v1 = await validateProductData({});
    assertTest(!v1.isValid && v1.errors.length >= 2, 'Validation flags missing mandatory fields (productName, unit)');

    // 2. Missing SKU when not isSkuLess
    const v2 = await validateProductData({ productName: 'Tile', unit: activeUnit._id });
    assertTest(!v2.isValid && v2.errors.some((e) => e.includes('SKU')), 'Validation flags missing SKU code when isSkuLess is false');

    // 3. Invalid GST (>100)
    const v3 = await validateProductData({ productName: 'Tile', unit: activeUnit._id, isSkuLess: true, gstPct: 150 });
    assertTest(!v3.isValid && v3.errors.some((e) => e.includes('gstPct')), 'Validation flags invalid GST % (> 100)');

    // 4. Negative Price
    const v4 = await validateProductData({ productName: 'Tile', unit: activeUnit._id, isSkuLess: true, mrp: -50 });
    assertTest(!v4.isValid && v4.errors.some((e) => e.includes('mrp')), 'Validation flags negative price/rates');

    // -------------------------------------------------------------
    // Test 11: Granular Action Permission Check (Module 1 Integration)
    // -------------------------------------------------------------
    console.log(`\n${colors.yellow}► STEP 11: Granular Permission Enforcement on Masters${colors.reset}`);

    // Create a restricted user with view-only on PRODUCT_MASTER
    const restrictedMobile = '9888888888';
    await User.deleteOne({ mobile: restrictedMobile });
    const userRole = await Role.findOne({ roleName: 'Sales Executive' });

    const createRestrictedUser = await makeRequest('/api/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'View Only User',
        mobile: restrictedMobile,
        password: 'Password123',
        roleId: userRole?._id
      }
    });
    const rUserId = createRestrictedUser.body.data?._id;

    // Grant ONLY view permission on PRODUCT_MASTER
    const prodMasterMod = await SystemModule.findOne({ moduleKey: 'PRODUCT_MASTER' });
    await UserPermission.findOneAndUpdate(
      { user: rUserId, module: prodMasterMod._id },
      {
        $set: {
          actions: { view: true, create: false, edit: false, delete: false, export: false, approve: false },
          isActive: true
        }
      },
      { upsert: true }
    );

    // Login restricted user
    const rLogin = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: { mobile: restrictedMobile, password: 'Password123' }
    });
    const rToken = rLogin.body.data?.accessToken;

    // View products -> ALLOWED (200)
    const rViewRes = await makeRequest('/api/products', {
      headers: { Authorization: `Bearer ${rToken}` }
    });
    assertTest(rViewRes.status === 200, 'View-only user successfully views product listing (200 OK)');

    // Create product -> FORBIDDEN (403)
    const rCreateRes = await makeRequest('/api/products', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rToken}` },
      body: { productName: 'Illegal Product', unit: activeUnit._id, isSkuLess: true }
    });
    assertTest(rCreateRes.status === 403, 'View-only user is blocked from creating products (403 Forbidden)');

    // Export products -> FORBIDDEN (403)
    const rExportRes = await makeRequest('/api/products/export', {
      headers: { Authorization: `Bearer ${rToken}` }
    });
    assertTest(rExportRes.status === 403, 'View-only user is blocked from exporting products (403 Forbidden)');

    // -------------------------------------------------------------
    // Test Summary
    // -------------------------------------------------------------
    console.log(`\n${colors.bright}${colors.cyan}========================================================================${colors.reset}`);
    console.log(`${colors.bright}MODULE 2 TEST RESULTS SUMMARY:${colors.reset}`);
    console.log(`  ${colors.green}Total Passed: ${passedCount}${colors.reset}`);
    console.log(`  ${failedCount > 0 ? colors.red : colors.green}Total Failed: ${failedCount}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}========================================================================${colors.reset}\n`);

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error(`\n${colors.red}Module 2 Test Runner Failed:${colors.reset}`, err);
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
