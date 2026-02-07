// scripts/quickFix.js
// IMMEDIATE FIX FOR CHAIRMAN'S BRANCHID

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { BranchModel } from '../models/HRModals/BranchModel.js';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';

dotenv.config();

async function quickFix() {
  try {
    console.log('\n🔧 QUICK FIX: Setting Chairman RoleAssignment branchId\n');

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get Head Office
    let headOffice = await BranchModel.findOne({ isHeadOffice: true });
    
    if (!headOffice) {
      // Create if doesn't exist
      headOffice = await BranchModel.create({
        name: 'Head Office',
        code: 'HQ',
        isHeadOffice: true,
        branchType: 'HeadOffice',
        location: { city: 'Headquarters', country: 'Pakistan' },
        isActive: true
      });
      console.log(`✅ Created Head Office: ${headOffice._id}\n`);
    } else {
      console.log(`✅ Found Head Office: ${headOffice._id}\n`);
    }

    // Fix all RoleAssignments with null branchId
    const result = await RoleAssignmentModel.updateMany(
      { branchId: null },
      { $set: { branchId: headOffice._id } }
    );

    console.log(`✅ Fixed ${result.modifiedCount} RoleAssignment(s)\n`);

    // Verify Chairman's assignment
    const chairmanAssignment = await RoleAssignmentModel.findOne({
      employeeId: new mongoose.Types.ObjectId('6985b6e2fd7dce090e44445a')
    });

    if (chairmanAssignment) {
      console.log('📋 Chairman RoleAssignment:');
      console.log(`   EmployeeId: ${chairmanAssignment.employeeId}`);
      console.log(`   RoleId: ${chairmanAssignment.roleId}`);
      console.log(`   BranchId: ${chairmanAssignment.branchId}`);
      console.log(`   DepartmentCode: ${chairmanAssignment.departmentCode}`);
      console.log(`   OrgUnit: ${chairmanAssignment.orgUnit}`);
      console.log(`   IsActive: ${chairmanAssignment.isActive}\n`);

      if (!chairmanAssignment.branchId) {
        console.log('❌ STILL NULL - Fix failed!');
      } else {
        console.log('✅ BranchId is now set correctly!');
      }
    } else {
      console.log('❌ Chairman RoleAssignment not found');
    }

    console.log('\n✅ Quick fix complete\n');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Quick fix failed:', error);
    process.exit(1);
  }
}

quickFix();