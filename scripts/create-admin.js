/**
 * Run once to create the first admin account:
 *   node scripts/create-admin.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const readline = require('readline');
const User     = require('../models/User');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(res => rl.question(q, res));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('\n🌿 FoodBridge – Create Admin Account\n');

  const name     = await ask('Admin Name     : ');
  const email    = await ask('Admin Email    : ');
  const password = await ask('Admin Password : ');

  if (!name || !email || !password) { console.log('❌ All fields required.'); process.exit(1); }
  if (password.length < 6)          { console.log('❌ Password must be at least 6 characters.'); process.exit(1); }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'admin') {
      await User.findByIdAndUpdate(existing._id, { role: 'admin' });
      console.log('✅ Existing user promoted to admin:', email);
    } else {
      console.log('ℹ️  Admin already exists with this email.');
    }
    rl.close(); mongoose.disconnect(); return;
  }

  await new User({ name, email, password, role: 'admin' }).save();
  console.log('\n✅ Admin created successfully!');
  console.log('   Login at: http://localhost:3000/login\n');
  rl.close(); mongoose.disconnect();
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
