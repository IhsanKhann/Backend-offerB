// scripts/verify-constants.js
// Quick script to verify CONSTANTS.DEPARTMENTS.ALL matches database

import mongoose from 'mongoose';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';
import CONSTANTS from '../configs/constants.js';
import dotenv from 'dotenv';
import RoleModel from '../models/HRModals/Role.model.js';
import finalizedEmployee from '../models/HRModals/FinalizedEmployees.model.js';

dotenv.config();

async function verifyConstants() {
  try {
    console.log('🔍 Verifying constants match database values...\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name');
    console.log('✅ Connected to MongoDB\n');
    
    // Check what CONSTANTS.DEPARTMENTS.ALL is set to
    console.log('📋 Checking CONSTANTS.DEPARTMENTS.ALL:');
    console.log(`   Value: "${CONSTANTS.DEPARTMENTS.ALL}"`);
    console.log(`   Type: ${typeof CONSTANTS.DEPARTMENTS.ALL}\n`);
    
    // Check database values
    console.log('📊 Checking database departmentCode values:');
    const uniqueDepts = await RoleAssignmentModel.distinct('departmentCode');
    console.log(`   Found: ${uniqueDepts.join(', ')}\n`);
    
    // Check for Chairman assignment
    const chairmanAssignment = await RoleAssignmentModel.findOne({
      isActive: true
    })
      .populate('roleId')
      .populate('employeeId', 'individualName UserId')
      .sort({ 'roleId.roleName': 1 })
      .limit(1);
    
    if (chairmanAssignment) {
      console.log('👑 Sample Executive Assignment:');
      console.log(`   User: ${chairmanAssignment.employeeId?.individualName}`);
      console.log(`   Role: ${chairmanAssignment.roleId?.roleName}`);
      console.log(`   Department Code: "${chairmanAssignment.departmentCode}"`);
      console.log(`   Type: ${typeof chairmanAssignment.departmentCode}\n`);
      
      // ✅ CRITICAL CHECK
      console.log('🎯 CRITICAL COMPARISON:');
      console.log(`   CONSTANTS.DEPARTMENTS.ALL: "${CONSTANTS.DEPARTMENTS.ALL}"`);
      console.log(`   Database value: "${chairmanAssignment.departmentCode}"`);
      
      if (CONSTANTS.DEPARTMENTS.ALL === chairmanAssignment.departmentCode) {
        console.log(`   ✅ MATCH! Constants are correctly configured.\n`);
      } else {
        console.log(`   ❌ MISMATCH! This is causing your 403 errors!\n`);
        console.log(`   🔧 FIX: Update CONSTANTS.DEPARTMENTS.ALL to "${chairmanAssignment.departmentCode}"\n`);
      }
    }
    
    // Check for case variations
    const deptVariations = uniqueDepts.filter(d => 
      d.toLowerCase() === 'all'
    );
    
    if (deptVariations.length > 1) {
      console.log('⚠️  WARNING: Multiple case variations of "All" found:');
      deptVariations.forEach(d => console.log(`   - "${d}"`));
      console.log('   This can cause comparison failures!\n');
    }
    
    await mongoose.disconnect();
    console.log('✅ Verification complete!\n');
    
  } catch (error) {
    console.error('❌ Verification error:', error);
    process.exit(1);
  }
}

verifyConstants();