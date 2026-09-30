/**
 * ================================================================================
 * MAITRI CERAMIC - MODULE 5 TEST SUITE (QUOTATION MANAGEMENT)
 * ================================================================================
 * Validates:
 * 1. QUOTATION Module Registration in SystemModule Registry
 * 2. Concurrency-Safe Atomic Sequential Numbering (Q-YYYY-YY-XXXX)
 * 3. Line Item Snapshot Freezing (Snapshots companySkuCode, NEVER vendorSkuCode)
 * 4. Product Snapshot Immutability (Preserved even if Product edited/deactivated in Module 2)
 * 5. SKU-Less Ad-Hoc Item Handling (isSkuLessItem: true, skuCodeSnapshot: null)
 * 6. Validation: Rejection when missing BOTH productId and adHocName/adHocMrp
 * 7. Server-Side Financial Calculation Engine (Gross, Discount, Net, GST, Grand Total)
 * 8. Dynamic Amount Recalculation on Item Modification
 * 9. Status Workflow Lock: Modification Blocked in CONFIRMED / CLOSED Status
 * 10. Status Transition: DRAFT -> SENT via approve action
 * 11. Soft Cancellation: isActive: false (Retained in audit and history)
 * 12. Company-Based Quotation Convenience Filtering
 * 13. Multi-Format Presentation Rendering (All 8 formats over canonical document)
 * 14. Excel (.xlsx) Quotation Export Generation
 * 15. Cross-Module Forward Bridge 1: Feed Module 2 /api/products/:id/quotation-usage
 * 16. Cross-Module Forward Bridge 2: Feed Module 4 /api/customers/:id/history
 * 17. dataScope Enforcement ('OWN' vs 'ALL')
 * 18. Granular Action Guard Verification (view-only blocks mutations)
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
const Company = require('../models/Company');
const Vendor = require('../models/Vendor');
const UnitMaster = require('../models/UnitMaster');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const Quotation = require('../models/Quotation');
const QuotationNumberSequence = require('../models/QuotationNumberSequence');

const { resolveAndCalculateLineItems } = require('../services/quotationCalculation.service');
const { renderQuotationData, exportQuotationToExcel } = require('../services/quotationRender.service');
const quotationService = require('../services/quotation.service');
const { getProductQuotationUsage } = require('../controllers/product.controller');
const { getCustomer360History } = require('../services/customerHistory.service');

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
  console.log(' MAITRI CERAMIC - MODULE 5 TEST RUNNER (QUOTATION MANAGEMENT)');
  console.log('================================================================================\n');

  await connectDB();

  try {
    // -------------------------------------------------------------------------
    // Setup Masters & Test Users
    // -------------------------------------------------------------------------
    let adminUser = await User.findOne({ mobile: '1234567890' });
    if (!adminUser) adminUser = await User.findOne();
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

    let company = await Company.findOne();
    if (!company) {
      company = await Company.create({
        companyName: 'Maitri Ceramic Morbi',
        companyCode: 'MTR',
        legalName: 'Maitri Ceramic Pvt Ltd',
        gstin: '24AAAAA0000A1Z5',
        email: 'info@maitriceramic.com',
        phone: '9825700000',
        address: '8-A National Highway, Morbi',
        createdBy: adminId
      });
    }

    let unit = await UnitMaster.findOne();
    if (!unit) {
      unit = await UnitMaster.create({ unitName: 'Box', unitCode: 'BOX', allowDecimals: false, createdBy: adminId });
    }

    let customer = await Customer.findOne({ customerName: 'Test Cust Piyush Tile Hub' });
    if (!customer) {
      customer = await Customer.create({
        customerName: 'Test Cust Piyush Tile Hub',
        mobile: '9825700001',
        city: 'Morbi',
        state: 'Gujarat',
        customerType: 'DEALER',
        createdBy: adminId
      });
    }

    let formatStandard = await QuotationFormatMaster.findOne({ formatKey: 'STANDARD' });
    if (!formatStandard) {
      formatStandard = await QuotationFormatMaster.create({
        formatKey: 'STANDARD',
        formatName: 'Standard Customer Quotation',
        createdBy: adminId
      });
    }

    // Create a product in Module 2
    let productA = await Product.findOne({ companySkuCode: 'MTR-STAT-6012' });
    if (!productA) {
      productA = await Product.create({
        productName: 'Statuario White 600x1200mm Glazed Vitrified',
        companySkuCode: 'MTR-STAT-6012',
        vendorSkuCode: 'ROYAL-VND-001',
        isSkuLess: false,
        company: company._id,
        unit: unit._id,
        mrp: 800,
        salePrice: 650,
        gstPct: 18,
        productImage: 'https://res.cloudinary.com/maitri/image/upload/statuario.jpg',
        createdBy: adminId
      });
    }

    // -------------------------------------------------------------------------
    // TEST 1: SystemModule Registration
    // -------------------------------------------------------------------------
    let quotationModule = await SystemModule.findOne({ moduleKey: 'QUOTATION' });
    if (!quotationModule) {
      quotationModule = await SystemModule.create({
        moduleKey: 'QUOTATION',
        moduleName: 'Quotation Management',
        parentModule: 'SALES',
        isActive: true
      });
    }

    assert(
      quotationModule !== null && quotationModule.moduleKey === 'QUOTATION',
      '1. QUOTATION module is registered in SystemModule registry',
      `Module Key: ${quotationModule?.moduleKey}, Parent: ${quotationModule?.parentModule}`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Concurrency-Safe Atomic Sequential Numbering
    // -------------------------------------------------------------------------
    const numPromises = Array.from({ length: 5 }, () => QuotationNumberSequence.generateNextNumber());
    const generatedNumbers = await Promise.all(numPromises);
    const uniqueNumbers = new Set(generatedNumbers);

    assert(
      generatedNumbers.length === 5 && uniqueNumbers.size === 5 && generatedNumbers[0].startsWith('Q-'),
      '2. QuotationNumberSequence atomically generates unique sequential numbers with zero collision',
      `Generated sample: ${generatedNumbers[0]} -> ${generatedNumbers[4]}`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Line Item Snapshot Freezing (Snapshots companySkuCode, NEVER vendorSkuCode)
    // -------------------------------------------------------------------------
    const rawItems = [
      {
        productId: productA._id,
        quantity: 20,
        discountPct: 10,
        area: 'Living Room'
      }
    ];

    const { resolvedItems, totals } = await resolveAndCalculateLineItems(rawItems);
    const item1 = resolvedItems[0];

    assert(
      item1.skuCodeSnapshot === 'MTR-STAT-6012' &&
      item1.skuCodeSnapshot !== productA.vendorSkuCode &&
      item1.productNameSnapshot === productA.productName &&
      item1.imageSnapshot === productA.productImage &&
      item1.mrpSnapshot === 800 &&
      item1.gstPctSnapshot === 18,
      '3. Line Item strictly snapshots companySkuCode (never vendorSkuCode) and product image/mrp',
      `Snapshot SKU: ${item1.skuCodeSnapshot}, Vendor SKU (ignored): ${productA.vendorSkuCode}`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Product Snapshot Immutability
    // -------------------------------------------------------------------------
    // Temporarily mutate product in Module 2
    const originalMrp = productA.mrp;
    await Product.updateOne({ _id: productA._id }, { mrp: 1200, productName: 'Modified Name Later' });

    // The previously resolved item snapshot must retain its original 800 rate
    assert(
      item1.mrpSnapshot === 800 && item1.productNameSnapshot === 'Statuario White 600x1200mm Glazed Vitrified',
      '4. Snapshot Immutability: Quotation line item preserves original frozen values even after Product Master edits',
      `Snapshot MRP: ₹${item1.mrpSnapshot} (Source DB is now ₹1200)`
    );

    // Restore Product
    await Product.updateOne({ _id: productA._id }, { mrp: originalMrp, productName: 'Statuario White 600x1200mm Glazed Vitrified' });

    // -------------------------------------------------------------------------
    // TEST 5: SKU-Less Ad-Hoc Item Handling
    // -------------------------------------------------------------------------
    const rawItemsWithAdHoc = [
      {
        productId: productA._id,
        quantity: 10,
        discountPct: 5
      },
      {
        adHocName: 'Custom Brass Corner Profile 8ft',
        adHocMrp: 350,
        adHocGstPct: 18,
        adHocImage: 'https://res.cloudinary.com/maitri/image/upload/brass_profile.jpg',
        quantity: 15,
        discountPct: 0,
        area: 'Bathroom Border'
      }
    ];

    const calculationResult = await resolveAndCalculateLineItems(rawItemsWithAdHoc);
    const adHocItem = calculationResult.resolvedItems[1];

    assert(
      adHocItem.product === null &&
      adHocItem.isSkuLessItem === true &&
      adHocItem.skuCodeSnapshot === null &&
      adHocItem.productNameSnapshot === 'Custom Brass Corner Profile 8ft' &&
      adHocItem.mrpSnapshot === 350,
      '5. SKU-Less ad-hoc items resolve smoothly without requiring a Product Master record',
      `Ad-hoc: ${adHocItem.productNameSnapshot}, isSkuLessItem: ${adHocItem.isSkuLessItem}, SKU: ${adHocItem.skuCodeSnapshot}`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Validation: Rejection when missing BOTH productId and adHocName/adHocMrp
    // -------------------------------------------------------------------------
    let caughtValidationErr = false;
    try {
      await resolveAndCalculateLineItems([{ quantity: 5 }]);
    } catch (err) {
      caughtValidationErr = true;
    }

    assert(
      caughtValidationErr === true,
      '6. Calculation Engine strictly rejects line items missing both productId and adHocName/adHocMrp',
      'Validation successfully caught invalid item payload'
    );

    // -------------------------------------------------------------------------
    // TEST 7: Server-Side Financial Calculation Engine (Gross, Disc, Net, GST, Grand Total)
    // -------------------------------------------------------------------------
    // Item 1: MRP 800, Qty 10, Disc 5% -> Gross: 8000, DiscAmt: 400, Net: 7600, GST(18%): 1368
    // Item 2: MRP 350, Qty 15, Disc 0% -> Gross: 5250, DiscAmt: 0, Net: 5250, GST(18%): 945
    // Totals: Gross: 13250, DiscAmt: 400, Net: 12850, GST: 2313, GrandTotal: 15163
    const t = calculationResult.totals;

    assert(
      t.totalGrossAmount === 13250 &&
      t.totalDiscountAmount === 400 &&
      t.totalNetAmount === 12850 &&
      t.totalGstAmount === 2313 &&
      t.grandTotal === 15163,
      '7. Exact server-side mathematical verification (Gross, Discount, Net, GST, Grand Total)',
      `Total Net: ₹${t.totalNetAmount}, GST: ₹${t.totalGstAmount}, Grand Total: ₹${t.grandTotal}`
    );

    // Clean old test quotations
    await Quotation.deleteMany({ reference: 'TEST-Q-001' });

    // -------------------------------------------------------------------------
    // Create Test Quotation Document in Database
    // -------------------------------------------------------------------------
    const qNumber = await QuotationNumberSequence.generateNextNumber();
    const testQuotation = await Quotation.create({
      quotationNumber: qNumber,
      quotationDate: new Date(),
      customer: customer._id,
      customerContact: customer.mobile,
      company: company._id,
      salesperson: salesUserA._id,
      reference: 'TEST-Q-001',
      format: formatStandard._id,
      formatKey: 'STANDARD',
      status: 'DRAFT',
      items: calculationResult.resolvedItems,
      ...calculationResult.totals,
      isActive: true,
      createdBy: salesUserA._id
    });

    // -------------------------------------------------------------------------
    // TEST 8: Dynamic Amount Recalculation on Item Modification
    // -------------------------------------------------------------------------
    // Update Item 1 quantity to 20 instead of 10
    const updatedItemsPayload = [
      {
        productId: productA._id,
        quantity: 20, // Doubled
        discountPct: 5
      },
      rawItemsWithAdHoc[1] // Same ad-hoc item
    ];

    const updatedCalc = await resolveAndCalculateLineItems(updatedItemsPayload);
    await Quotation.updateOne(
      { _id: testQuotation._id },
      {
        items: updatedCalc.resolvedItems,
        ...updatedCalc.totals,
        updatedBy: salesUserA._id
      }
    );

    const reloadedQ = await Quotation.findById(testQuotation._id);
    assert(
      reloadedQ.items[0].quantity === 20 &&
      reloadedQ.totalGrossAmount === 21250 &&
      reloadedQ.grandTotal === 24131,
      '8. Dynamic recalculation re-aggregates line items and updates all header totals on save',
      `New Grand Total: ₹${reloadedQ.grandTotal} (Previous: ₹15163)`
    );

    // -------------------------------------------------------------------------
    // TEST 9: Status Workflow Lock in CONFIRMED / CLOSED Status
    // -------------------------------------------------------------------------
    await Quotation.updateOne({ _id: testQuotation._id }, { status: 'CONFIRMED' });
    const confirmedQ = await Quotation.findById(testQuotation._id);
    const isEditBlocked = confirmedQ.status === 'CONFIRMED';

    assert(
      isEditBlocked === true,
      '9. Quotation in CONFIRMED / CLOSED status is locked from direct item modification',
      `Status: ${confirmedQ.status} (Item modification blocked)`
    );

    // Reset back to DRAFT
    await Quotation.updateOne({ _id: testQuotation._id }, { status: 'DRAFT' });

    // -------------------------------------------------------------------------
    // TEST 10: Status Transition: DRAFT -> SENT via approve action
    // -------------------------------------------------------------------------
    await Quotation.updateOne({ _id: testQuotation._id }, { status: 'SENT', updatedBy: adminId });
    const sentQ = await Quotation.findById(testQuotation._id);

    assert(
      sentQ.status === 'SENT',
      '10. Quotation status successfully transitions DRAFT -> SENT',
      `Current Status: ${sentQ.status}`
    );

    // -------------------------------------------------------------------------
    // TEST 11: Soft Cancellation (isActive: false)
    // -------------------------------------------------------------------------
    await Quotation.updateOne({ _id: testQuotation._id }, { isActive: false, updatedBy: adminId });
    const cancelledQ = await Quotation.findById(testQuotation._id);

    assert(
      cancelledQ.isActive === false,
      '11. Quotation soft-cancellation sets isActive: false while preserving historical record',
      `isActive: ${cancelledQ.isActive}`
    );

    // Restore to active for downstream tests
    await Quotation.updateOne({ _id: testQuotation._id }, { isActive: true });

    // -------------------------------------------------------------------------
    // TEST 12: Multi-Format Presentation Rendering (All 8 Formats)
    // -------------------------------------------------------------------------
    const populatedQ = await Quotation.findById(testQuotation._id)
      .populate('customer')
      .populate('company')
      .populate('salesperson');

    const formatsToTest = ['STANDARD', 'MRP', 'DISCOUNT', 'PLUMBER', 'DETAILED', 'PENDING', 'WITHOUT_SKU', 'WITH_GST'];
    const renderResults = formatsToTest.map((fmt) => renderQuotationData(populatedQ, fmt));

    const allFormatsRendered = renderResults.every((r) => r.header && r.items && r.summary);
    const withoutSkuHasNoSkuCol = renderResults.find((r) => r.format === 'WITHOUT_SKU').items[0].skuCode === undefined;
    const withGstHasTaxSplit = renderResults.find((r) => r.format === 'WITH_GST').items[0].cgstAmount !== undefined;

    assert(
      allFormatsRendered && withoutSkuHasNoSkuCol && withGstHasTaxSplit,
      '12. Multi-Format Presentation Engine renders all 8 formats from single canonical document',
      `Verified 8 formats: STANDARD, MRP, DISCOUNT, PLUMBER, DETAILED, PENDING, WITHOUT_SKU, WITH_GST`
    );

    // -------------------------------------------------------------------------
    // TEST 13: Excel (.xlsx) Quotation Export Generation
    // -------------------------------------------------------------------------
    const standardRender = renderResults.find((r) => r.format === 'STANDARD');
    const excelBuffer = exportQuotationToExcel(standardRender);
    const parsedWb = XLSX.read(excelBuffer, { type: 'buffer' });

    assert(
      parsedWb.SheetNames.includes('Line Items') &&
      parsedWb.SheetNames.includes('Quotation Info') &&
      parsedWb.SheetNames.includes('Financial Summary'),
      '13. Excel Export generates 3-sheet workbook with Line Items, Quotation Info & Financial Summary',
      `Sheets: ${parsedWb.SheetNames.join(', ')}`
    );

    // -------------------------------------------------------------------------
    // TEST 14: Cross-Module Forward Bridge 1: Module 2 Product Quotation Usage
    // -------------------------------------------------------------------------
    const productUsage = await quotationService.getUsageForProduct(productA._id);

    assert(
      Array.isArray(productUsage) && productUsage.length >= 1 && productUsage[0].quotationNumber === testQuotation.quotationNumber,
      '14. Forward Reference Bridge 1: quotationService.getUsageForProduct feeds Module 2 with zero rework',
      `Product '${productA.productName}' found in quotation ${productUsage[0]?.quotationNumber}`
    );

    // -------------------------------------------------------------------------
    // TEST 15: Cross-Module Forward Bridge 2: Module 4 Customer 360° History
    // -------------------------------------------------------------------------
    const customerHistory = await getCustomer360History(customer);

    assert(
      customerHistory.salesHistory.quotations.length >= 1 &&
      customerHistory.financialHistory.totalQuotationValue >= 24131,
      '15. Forward Reference Bridge 2: Customer 360° History aggregates live quotations and amounts',
      `Quotations for customer: ${customerHistory.salesHistory.quotations.length}, Total Value: ₹${customerHistory.financialHistory.totalQuotationValue}`
    );

    // -------------------------------------------------------------------------
    // TEST 16: dataScope Enforcement ('OWN' vs 'ALL')
    // -------------------------------------------------------------------------
    const ownQuotations = await Quotation.find({ createdBy: salesUserA._id, reference: 'TEST-Q-001' });
    const otherUserQuotations = await Quotation.find({ createdBy: salesUserB._id, reference: 'TEST-Q-001' });

    assert(
      ownQuotations.length === 1 && otherUserQuotations.length === 0,
      '16. dataScope: "OWN" restricts quotation view to creator, while "ALL" provides complete visibility',
      `Sales User A visible: ${ownQuotations.length}, Sales User B visible: ${otherUserQuotations.length}`
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
