const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const SystemModule = require('../models/SystemModule');
const { SYSTEM_MODULES_LIST } = require('../controllers/permission.controller');

const seed = async () => {
  try {
    console.log('🌱 Connecting to database for module seeding...');
    await connectDB();

    console.log('📦 Seeding System Modules...');
    for (const mod of SYSTEM_MODULES_LIST) {
      await SystemModule.findOneAndUpdate(
        { moduleKey: mod.moduleKey },
        {
          $set: {
            moduleName: mod.moduleName,
            parentModule: mod.parentModule,
            isActive: true
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`  ✓ Seeded module: ${mod.moduleKey} (${mod.moduleName})`);
    }

    console.log('✅ All System Modules seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seed();
}

module.exports = seed;
