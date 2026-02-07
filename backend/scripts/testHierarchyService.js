// scripts/fixDatabaseReferences.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { BranchModel } from '../models/HRModals/BranchModel.js';
import { OrgUnitModel } from '../models/HRModals/OrgUnit.js';
import { PermissionModel } from '../models/HRModals/Permissions.model.js';
import RoleModel from '../models/HRModals/Role.model.js';
import FinalizedEmployee from '../models/HRModals/FinalizedEmployees.model.js';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';

dotenv.config();

/**
 * ============================================
 * DATABASE REFERENCE INTEGRITY FIXER
 * ============================================
 * 
 * This script:
 * 1. Validates all references across collections
 * 2. Identifies broken references
 * 3. Repairs or removes broken data
 * 4. Creates missing role if needed
 * 5. Ensures branchId consistency
 */

class DatabaseReferenceFixer {
  constructor() {
    this.stats = {
      brokenReferences: {
        roles: 0,
        orgUnits: 0,
        permissions: 0,
        employees: 0,
        roleAssignments: 0
      },
      fixed: {
        roles: 0,
        orgUnits: 0,
        permissions: 0,
        employees: 0,
        roleAssignments: 0
      },
      created: {
        roles: 0,
        branches: 0
      }
    };

    this.validIds = {
      branches: new Set(),
      orgUnits: new Set(),
      roles: new Set(),
      permissions: new Set(),
      employees: new Set()
    };
  }

  async run() {
    try {
      console.log('\n========================================');
      console.log('🔧 DATABASE REFERENCE INTEGRITY FIXER');
      console.log('========================================\n');

      await this.connect();
      await this.buildValidIdSets();
      await this.fixBranches();
      await this.fixRoles();
      await this.fixOrgUnits();
      await this.fixEmployees();
      await this.fixRoleAssignments();
      await this.validateFinalState();
      await this.printReport();

      console.log('\n========================================');
      console.log('✅ DATABASE REFERENCES FIXED');
      console.log('========================================\n');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ FIXER FAILED:', error);
      process.exit(1);
    }
  }

  async connect() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
  }

  /**
   * Build sets of valid IDs for quick lookup
   */
  async buildValidIdSets() {
    console.log('📊 Building Valid ID Index...\n');

    // Branches
    const branches = await BranchModel.find({}, '_id');
    branches.forEach(b => this.validIds.branches.add(b._id.toString()));
    console.log(`  ✅ Branches: ${this.validIds.branches.size}`);

    // OrgUnits
    const orgUnits = await OrgUnitModel.find({}, '_id');
    orgUnits.forEach(o => this.validIds.orgUnits.add(o._id.toString()));
    console.log(`  ✅ OrgUnits: ${this.validIds.orgUnits.size}`);

    // Roles
    const roles = await RoleModel.find({}, '_id');
    roles.forEach(r => this.validIds.roles.add(r._id.toString()));
    console.log(`  ✅ Roles: ${this.validIds.roles.size}`);

    // Permissions
    const permissions = await PermissionModel.find({}, '_id');
    permissions.forEach(p => this.validIds.permissions.add(p._id.toString()));
    console.log(`  ✅ Permissions: ${this.validIds.permissions.size}`);

    // Employees
    const employees = await FinalizedEmployee.find({}, '_id');
    employees.forEach(e => this.validIds.employees.add(e._id.toString()));
    console.log(`  ✅ Employees: ${this.validIds.employees.size}\n`);
  }

  /**
   * Ensure Head Office branch exists
   */
  async fixBranches() {
    console.log('🏢 Checking Branches...\n');

    if (this.validIds.branches.size === 0) {
      console.log('  ⚠️  No branches found. Creating Head Office...');
      
      const headOffice = await BranchModel.create({
        name: 'Head Office',
        code: 'HQ',
        isHeadOffice: true,
        branchType: 'HeadOffice',
        location: {
          city: 'Headquarters',
          country: 'Pakistan'
        },
        isActive: true
      });

      this.validIds.branches.add(headOffice._id.toString());
      this.stats.created.branches++;
      
      console.log(`  ✅ Created Head Office (${headOffice._id})`);
    } else {
      console.log('  ✅ Branches OK');
    }

    console.log('');
  }

  /**
   * Fix role references and create missing Chairman role
   */
  async fixRoles() {
    console.log('👔 Fixing Roles...\n');

    // Check for missing role 6986b94fd789c0c2e4f8690e
    const missingRoleId = '6986b94fd789c0c2e4f8690e';
    
    if (!this.validIds.roles.has(missingRoleId)) {
      console.log(`  ⚠️  Missing role ${missingRoleId} - Creating Chairman role...`);

      // Get Chairman's permissions (all 47)
      const allPermissions = await PermissionModel.find({ isActive: true }, '_id');
      
      const chairmanRole = await RoleModel.create({
        _id: new mongoose.Types.ObjectId(missingRoleId),
        roleName: 'Chairman',
        description: 'Highest authority responsible for leading the board',
        category: 'Management',
        permissions: allPermissions.map(p => p._id),
        salaryRules: {
          baseSalary: 100000,
          salaryType: 'monthly',
          allowances: [
            { name: 'Administrative Allowance', type: 'percentage', value: 100 },
            { name: 'House Rent', type: 'percentage', value: 40 },
            { name: 'Medical Allowance', type: 'percentage', value: 10 },
            { name: 'Medicine Allowance', type: 'fixed', value: 3000 },
            { name: 'Fuel Expenses', type: 'fixed', value: 5000 },
            { name: 'Training Allowance Expenses', type: 'fixed', value: 2000 },
            { name: 'Hospitalization', type: 'fixed', value: 2500 },
            { name: 'Utility Expenses', type: 'fixed', value: 4000 },
            { name: 'Special Allowance', type: 'fixed', value: 3000 },
            { name: 'Servant', type: 'fixed', value: 6000 },
            { name: 'Telephone', type: 'fixed', value: 1500 },
            { name: 'Car Maintenance', type: 'fixed', value: 5000 }
          ],
          deductions: [
            { name: 'Provident Fund Deduction', type: 'percentage', value: 8 },
            { name: 'Income Tax', type: 'percentage', value: 10 },
            { name: 'EOBI', type: 'fixed', value: 2000 },
            { name: 'Cost of Funds', type: 'percentage', value: 2 }
          ],
          terminalBenefits: [
            { name: 'Gratuity Deduction', type: 'percentage', value: 5 }
          ]
        },
        isActive: true
      });

      this.validIds.roles.add(chairmanRole._id.toString());
      this.stats.created.roles++;
      
      console.log(`  ✅ Created Chairman role with ${allPermissions.length} permissions`);
    }

    // Validate all role permissions
    const roles = await RoleModel.find().populate('permissions');
    
    for (const role of roles) {
      let fixed = false;
      const validPermissions = [];

      for (const permId of role.permissions) {
        const permIdStr = permId.toString();
        if (this.validIds.permissions.has(permIdStr)) {
          validPermissions.push(permId);
        } else {
          console.log(`  ⚠️  Role "${role.roleName}" has invalid permission: ${permIdStr}`);
          this.stats.brokenReferences.permissions++;
          fixed = true;
        }
      }

      if (fixed) {
        role.permissions = validPermissions;
        await role.save();
        this.stats.fixed.permissions++;
        console.log(`  ✅ Fixed role "${role.roleName}" permissions`);
      }
    }

    console.log('');
  }

  /**
   * Fix orgUnit references and ensure branchId
   */
  async fixOrgUnits() {
    console.log('🏗️  Fixing OrgUnits...\n');

    const headOfficeBranch = await BranchModel.findOne({ isHeadOffice: true });
    
    if (!headOfficeBranch) {
      console.log('  ❌ No Head Office branch found!');
      return;
    }

    const orgUnits = await OrgUnitModel.find();

    for (const orgUnit of orgUnits) {
      let fixed = false;

      // Fix missing branchId
      if (!orgUnit.branchId) {
        orgUnit.branchId = headOfficeBranch._id;
        fixed = true;
        console.log(`  ⚠️  OrgUnit "${orgUnit.name}" missing branchId - assigning Head Office`);
      }

      // Validate branchId exists
      if (!this.validIds.branches.has(orgUnit.branchId.toString())) {
        orgUnit.branchId = headOfficeBranch._id;
        fixed = true;
        this.stats.brokenReferences.orgUnits++;
        console.log(`  ⚠️  OrgUnit "${orgUnit.name}" has invalid branchId - fixing`);
      }

      // Validate parent reference
      if (orgUnit.parent && !this.validIds.orgUnits.has(orgUnit.parent.toString())) {
        console.log(`  ❌ OrgUnit "${orgUnit.name}" has invalid parent reference`);
        this.stats.brokenReferences.orgUnits++;
        // Don't auto-fix parent - this requires manual intervention
      }

      if (fixed) {
        await orgUnit.save();
        this.stats.fixed.orgUnits++;
      }
    }

    console.log('');
  }

  /**
   * Fix employee references
   */
  async fixEmployees() {
    console.log('👥 Fixing Employees...\n');

    const employees = await FinalizedEmployee.find();

    for (const emp of employees) {
      let fixed = false;

      // Fix role reference
      if (emp.role && !this.validIds.roles.has(emp.role.toString())) {
        console.log(`  ❌ Employee "${emp.individualName}" has invalid role: ${emp.role}`);
        this.stats.brokenReferences.employees++;
        
        // Try to find a default role
        const defaultRole = await RoleModel.findOne({ roleName: 'Officer' });
        if (defaultRole) {
          emp.role = defaultRole._id;
          fixed = true;
          console.log(`  ✅ Assigned default "Officer" role to ${emp.individualName}`);
        }
      }

      // Fix orgUnit reference
      if (emp.orgUnit && !this.validIds.orgUnits.has(emp.orgUnit.toString())) {
        console.log(`  ❌ Employee "${emp.individualName}" has invalid orgUnit: ${emp.orgUnit}`);
        this.stats.brokenReferences.employees++;
        
        // Try to find Chairman orgUnit
        const chairmanOrgUnit = await OrgUnitModel.findOne({ name: 'CHAIRMAN' });
        if (chairmanOrgUnit) {
          emp.orgUnit = chairmanOrgUnit._id;
          fixed = true;
          console.log(`  ✅ Assigned CHAIRMAN orgUnit to ${emp.individualName}`);
        }
      }

      if (fixed) {
        await emp.save();
        this.stats.fixed.employees++;
      }
    }

    console.log('');
  }

  /**
   * Fix role assignment references
   */
  async fixRoleAssignments() {
    console.log('📋 Fixing Role Assignments...\n');

    const headOfficeBranch = await BranchModel.findOne({ isHeadOffice: true });
    const assignments = await RoleAssignmentModel.find();

    for (const assignment of assignments) {
      let fixed = false;

      // Fix employeeId
      if (!this.validIds.employees.has(assignment.employeeId.toString())) {
        console.log(`  ❌ Assignment has invalid employeeId: ${assignment.employeeId}`);
        this.stats.brokenReferences.roleAssignments++;
        await assignment.deleteOne();
        continue;
      }

      // Fix roleId
      if (!this.validIds.roles.has(assignment.roleId.toString())) {
        console.log(`  ❌ Assignment has invalid roleId: ${assignment.roleId}`);
        this.stats.brokenReferences.roleAssignments++;
        await assignment.deleteOne();
        continue;
      }

      // Fix orgUnit
      if (!this.validIds.orgUnits.has(assignment.orgUnit.toString())) {
        console.log(`  ❌ Assignment has invalid orgUnit: ${assignment.orgUnit}`);
        this.stats.brokenReferences.roleAssignments++;
        await assignment.deleteOne();
        continue;
      }

      // Fix missing branchId
      if (!assignment.branchId) {
        const orgUnit = await OrgUnitModel.findById(assignment.orgUnit);
        assignment.branchId = orgUnit?.branchId || headOfficeBranch._id;
        assignment.departmentCode = orgUnit?.departmentCode || 'All';
        fixed = true;
        console.log(`  ✅ Fixed branchId for assignment`);
      }

      if (fixed) {
        await assignment.save();
        this.stats.fixed.roleAssignments++;
      }
    }

    console.log('');
  }

  /**
   * Validate final state
   */
  async validateFinalState() {
    console.log('🔍 Validating Final State...\n');

    // Check all employees have valid references
    const employees = await FinalizedEmployee.find()
      .populate('role')
      .populate('orgUnit');

    const invalidEmployees = employees.filter(e => !e.role || !e.orgUnit);
    
    if (invalidEmployees.length > 0) {
      console.log(`  ⚠️  ${invalidEmployees.length} employees still have invalid references`);
      invalidEmployees.forEach(e => {
        console.log(`    - ${e.individualName}: role=${!!e.role}, orgUnit=${!!e.orgUnit}`);
      });
    } else {
      console.log('  ✅ All employees have valid references');
    }

    // Check all role assignments
    const assignments = await RoleAssignmentModel.find()
      .populate('employeeId')
      .populate('roleId')
      .populate('orgUnit');

    const invalidAssignments = assignments.filter(a => !a.employeeId || !a.roleId || !a.orgUnit);
    
    if (invalidAssignments.length > 0) {
      console.log(`  ⚠️  ${invalidAssignments.length} role assignments still have invalid references`);
    } else {
      console.log('  ✅ All role assignments have valid references');
    }

    console.log('');
  }

  /**
   * Print final report
   */
  async printReport() {
    console.log('📊 Final Report\n');
    console.log('═══════════════════════════════════════════════════════');
    console.log('Broken References Found:');
    console.log(`  Roles: ${this.stats.brokenReferences.roles}`);
    console.log(`  OrgUnits: ${this.stats.brokenReferences.orgUnits}`);
    console.log(`  Permissions: ${this.stats.brokenReferences.permissions}`);
    console.log(`  Employees: ${this.stats.brokenReferences.employees}`);
    console.log(`  RoleAssignments: ${this.stats.brokenReferences.roleAssignments}`);
    console.log('───────────────────────────────────────────────────────');
    console.log('References Fixed:');
    console.log(`  Roles: ${this.stats.fixed.roles}`);
    console.log(`  OrgUnits: ${this.stats.fixed.orgUnits}`);
    console.log(`  Permissions: ${this.stats.fixed.permissions}`);
    console.log(`  Employees: ${this.stats.fixed.employees}`);
    console.log(`  RoleAssignments: ${this.stats.fixed.roleAssignments}`);
    console.log('───────────────────────────────────────────────────────');
    console.log('Created:');
    console.log(`  Roles: ${this.stats.created.roles}`);
    console.log(`  Branches: ${this.stats.created.branches}`);
    console.log('═══════════════════════════════════════════════════════');

    // Final counts
    const finalCounts = {
      branches: await BranchModel.countDocuments(),
      orgUnits: await OrgUnitModel.countDocuments(),
      roles: await RoleModel.countDocuments(),
      permissions: await PermissionModel.countDocuments(),
      employees: await FinalizedEmployee.countDocuments(),
      roleAssignments: await RoleAssignmentModel.countDocuments()
    };

    console.log('\nFinal Database State:');
    console.log(`  Branches: ${finalCounts.branches}`);
    console.log(`  OrgUnits: ${finalCounts.orgUnits}`);
    console.log(`  Roles: ${finalCounts.roles}`);
    console.log(`  Permissions: ${finalCounts.permissions}`);
    console.log(`  Employees: ${finalCounts.employees}`);
    console.log(`  RoleAssignments: ${finalCounts.roleAssignments}`);
  }
}

// Run the fixer
const fixer = new DatabaseReferenceFixer();
fixer.run();