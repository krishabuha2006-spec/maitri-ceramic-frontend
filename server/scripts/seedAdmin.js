const mongoose = require('mongoose');
require('dotenv').config();
const connectDB = require('../config/db');
const Role = require('../models/Role');
const User = require('../models/User');
const SystemModule = require('../models/SystemModule');
const RoleDefaultPermission = require('../models/RoleDefaultPermission');
const UserPermission = require('../models/UserPermission');

const seedAdmin = async () => {
  try {
    console.log('🌱 Connecting to database for Super Admin bootstrap...');
    await connectDB();

    // 1. Create or Find Super Admin Role
    let superAdminRole = await Role.findOne({ roleName: 'Super Admin' });
    if (!superAdminRole) {
      superAdminRole = await Role.create({
        roleName: 'Super Admin',
        description: 'System-level Super Administrator with full unrestricted platform access',
        isSystemRole: true,
        isActive: true
      });
      console.log('✅ Created Super Admin System Role.');
    } else {
      superAdminRole.isSystemRole = true;
      await superAdminRole.save();
      console.log('ℹ️ Super Admin Role already exists (ensured isSystemRole: true).');
    }

    // 2. Fetch all system modules
    const modules = await SystemModule.find({ isActive: true });
    if (modules.length === 0) {
      console.warn('⚠️ No System Modules found. Running module seeder first...');
      const seedModules = require('./seedModules');
      // We will loop through if needed
    }

    // 3. Upsert Role Default Permissions for Super Admin (all true)
    for (const mod of modules) {
      await RoleDefaultPermission.findOneAndUpdate(
        { role: superAdminRole._id, module: mod._id },
        {
          $set: {
            actions: {
              view: true,
              create: true,
              edit: true,
              delete: true,
              export: true,
              approve: true
            }
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Configured default permissions for Super Admin on ${modules.length} modules.`);

    // 4. Create or Find Super Admin User
    const adminMobile = process.env.ADMIN_MOBILE || '1234567890';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Krisha@2006';
    const adminName = 'Krisha Bhua';
    const adminEmail = 'krishabhua2006@gmail.com';

    let adminUser = await User.findOne({ mobile: adminMobile });
    if (!adminUser) {
      const passwordHash = await User.hashPassword(adminPassword);
      adminUser = await User.create({
        name: adminName,
        mobile: adminMobile,
        email: adminEmail,
        passwordHash,
        role: superAdminRole._id,
        isActive: true
      });
      console.log(`✅ Created Bootstrap Super Admin User: Mobile: ${adminMobile} | Password: ${adminPassword}`);
    } else {
      adminUser.role = superAdminRole._id;
      adminUser.isActive = true;
      await adminUser.save();
      console.log(`ℹ️ Super Admin User already exists (${adminMobile}).`);
    }

    // 5. Assign UserPermission directly to Super Admin
    for (const mod of modules) {
      await UserPermission.findOneAndUpdate(
        { user: adminUser._id, module: mod._id },
        {
          $set: {
            actions: {
              view: true,
              create: true,
              edit: true,
              delete: true,
              export: true,
              approve: true
            },
            dataScope: 'ALL',
            grantedBy: adminUser._id,
            isActive: true
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    console.log(`✅ Granted full UserPermission set to Super Admin user.`);

    console.log('\n==================================================');
    console.log('🎉 Super Admin Bootstrap Completed Successfully!');
    console.log(`👤 Name:     ${adminName}`);
    console.log(`📱 Mobile:   ${adminMobile}`);
    console.log(`🔑 Password: ${adminPassword}`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Super Admin Seeding Error:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;
