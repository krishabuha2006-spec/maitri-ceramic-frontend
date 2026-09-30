const connectDB = require('../config/db');
const User = require('../models/User');
const authController = require('../controllers/auth.controller');

async function test() {
  await connectDB();
  console.log('MongoDB Connected');

  const superAdminPassword = process.env.ADMIN_PASSWORD || 'Laksh@2508';

  // Helper mock res
  const mockRes = () => {
    const res = {};
    res.statusCode = 200;
    res.status = function(code) { this.statusCode = code; return this; };
    res.json = function(data) { this.body = data; return this; };
    return res;
  };

  console.log('\n--- 1. Login with Mobile Number ---');
  const req1 = { body: { mobile: '9825702369', password: superAdminPassword } };
  const res1 = mockRes();
  await authController.login(req1, res1, () => {});
  console.log('Mobile Login Status:', res1.statusCode, '| User:', res1.body?.data?.user?.name, '| Mobile:', res1.body?.data?.user?.mobile);

  console.log('\n--- 2. Login with Email Address ---');
  const req2 = { body: { email: 'admin@maitriceramic.com', password: superAdminPassword } };
  const res2 = mockRes();
  await authController.login(req2, res2, () => {});
  console.log('Email Login Status:', res2.statusCode, '| User:', res2.body?.data?.user?.name, '| Email:', res2.body?.data?.user?.email);

  console.log('\n--- 3. Login with generic identifier (Mobile in identifier field) ---');
  const req3 = { body: { identifier: '9825702369', password: superAdminPassword } };
  const res3 = mockRes();
  await authController.login(req3, res3, () => {});
  console.log('Identifier(Mobile) Status:', res3.statusCode, '| User:', res3.body?.data?.user?.name);

  console.log('\n--- 4. Login with generic identifier (Email in identifier field) ---');
  const req4 = { body: { identifier: 'admin@maitriceramic.com', password: superAdminPassword } };
  const res4 = mockRes();
  await authController.login(req4, res4, () => {});
  console.log('Identifier(Email) Status:', res4.statusCode, '| User:', res4.body?.data?.user?.name);

  await mongoose.disconnect();
}

test().catch(console.error);
