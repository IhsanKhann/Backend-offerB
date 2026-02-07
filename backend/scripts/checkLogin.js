// scripts/checkLogin.js
// Check why Chairman can't login

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import FinalizedEmployee from '../models/HRModals/FinalizedEmployees.model.js';

dotenv.config();

async function checkLogin() {
  try {
    console.log('\n🔍 LOGIN DIAGNOSTIC\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Check if Chairman exists
    const chairmanById = await FinalizedEmployee.findById('6985b6e2fd7dce090e44445a');
    
    console.log('📋 Chairman by ID:');
    if (chairmanById) {
      console.log(`   ✅ Found: ${chairmanById.individualName}`);
      console.log(`   UserId: "${chairmanById.UserId}"`);
      console.log(`   Password Hash: ${chairmanById.passwordHash ? 'Present' : 'MISSING'}`);
      console.log(`   Password field: ${chairmanById.password ? 'Present' : 'MISSING'}`);
      console.log('');
    } else {
      console.log('   ❌ Not found by ID\n');
    }

    // Try finding by exact UserId from your data
    const byUserId1 = await FinalizedEmployee.findOne({ UserId: 'AbdusSaboorKhanOBE1' });
    console.log('📋 Search by UserId "AbdusSaboorKhanOBE1":');
    console.log(byUserId1 ? `   ✅ Found: ${byUserId1.individualName}` : '   ❌ Not found');
    console.log('');

    // Try case-insensitive search
    const byUserIdInsensitive = await FinalizedEmployee.findOne({ 
      UserId: /^AbdusSaboorKhanOBE1$/i 
    });
    console.log('📋 Search by UserId (case-insensitive):');
    console.log(byUserIdInsensitive ? `   ✅ Found: ${byUserIdInsensitive.individualName}` : '   ❌ Not found');
    console.log('');

    // List all employees
    const allEmployees = await FinalizedEmployee.find({}, 'UserId individualName');
    console.log('📋 All Employees in Database:');
    allEmployees.forEach(emp => {
      console.log(`   - UserId: "${emp.UserId}" | Name: ${emp.individualName}`);
    });
    console.log('');

    // Check password method
    if (chairmanById) {
      console.log('🔐 Password Method Check:');
      console.log(`   comparePassword exists: ${typeof chairmanById.comparePassword === 'function'}`);
      console.log(`   Model name: ${chairmanById.constructor.modelName}`);
      
      // Try to check if method is on schema
      const schema = FinalizedEmployee.schema;
      const hasMethods = schema.methods && Object.keys(schema.methods).length > 0;
      console.log(`   Schema has methods: ${hasMethods}`);
      if (hasMethods) {
        console.log(`   Methods: ${Object.keys(schema.methods).join(', ')}`);
      }
      console.log('');
    }

    // Check if password is hashed
    if (chairmanById && chairmanById.passwordHash) {
      console.log('🔒 Password Hash Check:');
      console.log(`   Starts with $2b$: ${chairmanById.passwordHash.startsWith('$2b$')}`);
      console.log(`   Length: ${chairmanById.passwordHash.length}`);
      console.log('');
    }

    console.log('✅ Diagnostic complete\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
    process.exit(1);
  }
}

checkLogin();