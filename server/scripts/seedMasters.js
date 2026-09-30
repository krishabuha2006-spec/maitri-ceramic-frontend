const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');

const UnitMaster = require('../models/UnitMaster');
const TaxMaster = require('../models/TaxMaster');
const PaymentModeMaster = require('../models/PaymentModeMaster');
const QuotationFormatMaster = require('../models/QuotationFormatMaster');
const ProductGroup = require('../models/ProductGroup');
const Company = require('../models/Company');
const User = require('../models/User');

const seedMasters = async () => {
  try {
    console.log('🌱 Connecting to database for Master reference seeding...');
    await connectDB();

    // Get Admin user for createdBy reference
    const admin = await User.findOne();
    const adminId = admin ? admin._id : new mongoose.Types.ObjectId();

    // 1. Seed Units
    const defaultUnits = [
      { unitName: 'Piece', unitCode: 'PCS' },
      { unitName: 'Box', unitCode: 'BOX' },
      { unitName: 'Square Feet', unitCode: 'SQFT' },
      { unitName: 'Meter', unitCode: 'MTR' },
      { unitName: 'Kilogram', unitCode: 'KG' }
    ];

    for (const u of defaultUnits) {
      await UnitMaster.findOneAndUpdate(
        { unitCode: u.unitCode },
        { $set: { unitName: u.unitName, isActive: true, createdBy: adminId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Seeded ${defaultUnits.length} default Units.`);

    // 2. Seed Tax Presets
    const defaultTaxes = [
      { taxName: 'GST 0%', gstPct: 0, igstPct: 0, cgstPct: 0, sgstPct: 0, cessPct: 0 },
      { taxName: 'GST 5%', gstPct: 5, igstPct: 5, cgstPct: 2.5, sgstPct: 2.5, cessPct: 0 },
      { taxName: 'GST 12%', gstPct: 12, igstPct: 12, cgstPct: 6, sgstPct: 6, cessPct: 0 },
      { taxName: 'GST 18%', gstPct: 18, igstPct: 18, cgstPct: 9, sgstPct: 9, cessPct: 0 },
      { taxName: 'GST 28%', gstPct: 28, igstPct: 28, cgstPct: 14, sgstPct: 14, cessPct: 0 }
    ];

    for (const t of defaultTaxes) {
      await TaxMaster.findOneAndUpdate(
        { taxName: t.taxName },
        { $set: { ...t, isActive: true, createdBy: adminId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Seeded ${defaultTaxes.length} default Tax Presets.`);

    // 3. Seed Payment Modes
    const defaultPaymentModes = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Debit/Credit Card'];
    for (const mode of defaultPaymentModes) {
      await PaymentModeMaster.findOneAndUpdate(
        { modeName: mode },
        { $set: { modeName: mode, isActive: true, createdBy: adminId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Seeded ${defaultPaymentModes.length} default Payment Modes.`);

    // 4. Seed Quotation Formats (8 formats per PRD)
    const defaultFormats = [
      { formatKey: 'STANDARD', formatName: 'Standard Quotation', description: 'Default quotation with standard pricing' },
      { formatKey: 'MRP', formatName: 'MRP Quotation', description: 'Quotation highlighting product MRP rates' },
      { formatKey: 'DISCOUNT', formatName: 'Discounted Quotation', description: 'Quotation with explicit discounts displayed' },
      { formatKey: 'PLUMBER', formatName: 'Plumber Quotation', description: 'Tailored quotation for contractors & plumbers' },
      { formatKey: 'DETAILED', formatName: 'Detailed Quotation', description: 'Comprehensive quotation with extensive specs' },
      { formatKey: 'PENDING', formatName: 'Pending Items Quotation', description: 'Quotation tracking pending supply items' },
      { formatKey: 'WITHOUT_SKU', formatName: 'Quotation Without SKU Code', description: 'Simplified customer-facing quote omitting internal SKU codes' },
      { formatKey: 'WITH_GST', formatName: 'Quotation With GST Breakdown', description: 'Full tax breakdown quote with CGST/SGST/IGST details' }
    ];

    for (const f of defaultFormats) {
      await QuotationFormatMaster.findOneAndUpdate(
        { formatKey: f.formatKey },
        { $set: { ...f, isActive: true, createdBy: adminId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Seeded ${defaultFormats.length} default Quotation Formats.`);

    // 5. Seed Product Groups
    const defaultGroups = [
      { groupName: 'Ceramic & Porcelain Tiles', description: 'Floor and wall tiles' },
      { groupName: 'Sanitaryware', description: 'Toilets, basins, urinals' },
      { groupName: 'CP Fittings & Faucets', description: 'Taps, mixers, showers' },
      { groupName: 'Bathroom Accessories', description: 'Towel rails, soap holders, mirrors' },
      { groupName: 'Adhesives & Grouts', description: 'Tile bonding agents and fillers' }
    ];

    for (const g of defaultGroups) {
      await ProductGroup.findOneAndUpdate(
        { groupName: g.groupName },
        { $set: { ...g, isActive: true, createdBy: adminId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Seeded ${defaultGroups.length} default Product Groups.`);

    // 6. Seed Own Company
    await Company.findOneAndUpdate(
      { companyType: 'OWN' },
      {
        $set: {
          companyName: 'Maitri Ceramic',
          companyType: 'OWN',
          gstNumber: '24AAAAA0000A1Z5',
          address: 'National Highway 8A, Morbi, Gujarat - 363642',
          contactPerson: 'Piyush Bhai',
          contactMobile: '9825702369',
          isActive: true,
          createdBy: adminId
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`✅ Seeded Primary 'OWN' Company (Maitri Ceramic).`);

    console.log('\n🎉 Master Reference Data Seeding Complete!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Master Seeding Error:', err);
    process.exit(1);
  }
};

if (require.main === module) {
  seedMasters();
}

module.exports = seedMasters;
