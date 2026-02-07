// scripts/diagnoseAndFix.js
// COMPREHENSIVE DATABASE DIAGNOSTIC & REPAIR

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { BranchModel } from '../models/HRModals/BranchModel.js';
import { OrgUnitModel } from '../models/HRModals/OrgUnit.js';
import { PermissionModel } from '../models/HRModals/Permissions.model.js';
import RoleModel from '../models/HRModals/Role.model.js';
import FinalizedEmployee from '../models/HRModals/FinalizedEmployees.model.js';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';

dotenv.config();

class SystemDiagnostic {
  constructor() {
    this.issues = [];
    this.fixes = [];
  }

  async run() {
    console.log('\n========================================');
    console.log('🔍 COMPREHENSIVE SYSTEM DIAGNOSTIC');
    console.log('========================================\n');

    await this.connect();
    
    // Run all diagnostic checks
    await this.checkBranches();
    await this.checkOrgUnits();
    await this.checkPermissions();
    await this.checkRoles();
    await this.checkEmployees();
    await this.checkRoleAssignments();
    await this.checkChairmanSetup();
    
    // Print report
    await this.printReport();
    
    // Apply fixes
    if (this.issues.length > 0) {
      await this.applyFixes();
    }

    console.log('\n========================================');
    console.log('✅ DIAGNOSTIC COMPLETE');
    console.log('========================================\n');

    process.exit(0);
  }

  async connect() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
  }

  // ============================================
  // DIAGNOSTIC CHECKS
  // ============================================

  async checkBranches() {
    console.log('🏢 Checking Branches...\n');
    
    const branches = await BranchModel.find();
    
    if (branches.length === 0) {
      this.issues.push({
        severity: 'CRITICAL',
        category: 'BRANCHES',
        message: 'No branches found in database',
        fix: 'CREATE_HEAD_OFFICE'
      });
    } else {
      const headOffice = branches.find(b => b.isHeadOffice);
      if (!headOffice) {
        this.issues.push({
          severity: 'CRITICAL',
          category: 'BRANCHES',
          message: 'No head office branch marked',
          fix: 'MARK_HEAD_OFFICE',
          data: { branchId: branches[0]._id }
        });
      } else {
        console.log(`  ✅ Head Office found: ${headOffice.name} (${headOffice._id})`);
      }
    }
    
    console.log('');
  }

  async checkOrgUnits() {
    console.log('🏗️  Checking OrgUnits...\n');
    
    const chairman = await OrgUnitModel.findOne({ name: 'CHAIRMAN', level: 0 });
    
    if (!chairman) {
      this.issues.push({
        severity: 'CRITICAL',
        category: 'ORGUNITS',
        message: 'CHAIRMAN orgUnit (level 0) not found',
        fix: 'CREATE_CHAIRMAN_ORGUNIT'
      });
    } else {
      console.log(`  ✅ Chairman OrgUnit found: ${chairman._id}`);
      
      // Check branchId
      if (!chairman.branchId) {
        this.issues.push({
          severity: 'HIGH',
          category: 'ORGUNITS',
          message: 'Chairman OrgUnit missing branchId',
          fix: 'SET_CHAIRMAN_BRANCH',
          data: { orgUnitId: chairman._id }
        });
      }
    }
    
    console.log('');
  }

  async checkPermissions() {
    console.log('🔐 Checking Permissions...\n');
    
    const permissions = await PermissionModel.find({ isActive: true });
    console.log(`  Total active permissions: ${permissions.length}`);
    
    // Check for required fields
    const missingAction = permissions.filter(p => !p.action);
    if (missingAction.length > 0) {
      this.issues.push({
        severity: 'HIGH',
        category: 'PERMISSIONS',
        message: `${missingAction.length} permissions missing 'action' field`,
        fix: 'SET_PERMISSION_ACTIONS',
        data: { permissionIds: missingAction.map(p => p._id) }
      });
    }
    
    // Check statusScope
    const missingScope = permissions.filter(p => !p.statusScope || p.statusScope.length === 0);
    if (missingScope.length > 0) {
      console.log(`  ⚠️  ${missingScope.length} permissions missing statusScope`);
    }
    
    console.log('');
  }

  async checkRoles() {
    console.log('👔 Checking Roles...\n');
    
    const roles = await RoleModel.find({ isActive: true });
    console.log(`  Total active roles: ${roles.length}`);
    
    // Check Chairman role specifically
    const chairmanRoleId = '6986b94fd789c0c2e4f8690e';
    const chairmanRole = await RoleModel.findById(chairmanRoleId);
    
    if (!chairmanRole) {
      this.issues.push({
        severity: 'CRITICAL',
        category: 'ROLES',
        message: `Chairman role (${chairmanRoleId}) not found`,
        fix: 'CREATE_CHAIRMAN_ROLE',
        data: { roleId: chairmanRoleId }
      });
    } else {
      console.log(`  ✅ Chairman role found with ${chairmanRole.permissions.length} permissions`);
      
      // Verify permissions exist
      const invalidPerms = [];
      for (const permId of chairmanRole.permissions) {
        const exists = await PermissionModel.exists({ _id: permId });
        if (!exists) {
          invalidPerms.push(permId);
        }
      }
      
      if (invalidPerms.length > 0) {
        this.issues.push({
          severity: 'HIGH',
          category: 'ROLES',
          message: `Chairman role has ${invalidPerms.length} invalid permission references`,
          fix: 'CLEAN_ROLE_PERMISSIONS',
          data: { roleId: chairmanRoleId, invalidPerms }
        });
      }
    }
    
    console.log('');
  }

  async checkEmployees() {
    console.log('👥 Checking Employees...\n');
    
    const employees = await FinalizedEmployee.find();
    console.log(`  Total employees: ${employees.length}`);
    
    for (const emp of employees) {
      // Check role reference
      if (!emp.role) {
        this.issues.push({
          severity: 'HIGH',
          category: 'EMPLOYEES',
          message: `Employee ${emp.individualName} has no role`,
          fix: 'SET_EMPLOYEE_ROLE',
          data: { employeeId: emp._id }
        });
      } else {
        const roleExists = await RoleModel.exists({ _id: emp.role });
        if (!roleExists) {
          this.issues.push({
            severity: 'HIGH',
            category: 'EMPLOYEES',
            message: `Employee ${emp.individualName} has invalid role reference: ${emp.role}`,
            fix: 'FIX_EMPLOYEE_ROLE',
            data: { employeeId: emp._id, invalidRoleId: emp.role }
          });
        }
      }
      
      // Check orgUnit reference
      if (!emp.orgUnit) {
        this.issues.push({
          severity: 'HIGH',
          category: 'EMPLOYEES',
          message: `Employee ${emp.individualName} has no orgUnit`,
          fix: 'SET_EMPLOYEE_ORGUNIT',
          data: { employeeId: emp._id }
        });
      } else {
        const orgUnitExists = await OrgUnitModel.exists({ _id: emp.orgUnit });
        if (!orgUnitExists) {
          this.issues.push({
            severity: 'HIGH',
            category: 'EMPLOYEES',
            message: `Employee ${emp.individualName} has invalid orgUnit reference: ${emp.orgUnit}`,
            fix: 'FIX_EMPLOYEE_ORGUNIT',
            data: { employeeId: emp._id, invalidOrgUnitId: emp.orgUnit }
          });
        }
      }
    }
    
    console.log('');
  }

  async checkRoleAssignments() {
    console.log('📋 Checking Role Assignments...\n');
    
    const assignments = await RoleAssignmentModel.find();
    console.log(`  Total role assignments: ${assignments.length}`);
    
    for (const assignment of assignments) {
      // ⚠️ CRITICAL: Check branchId
      if (!assignment.branchId) {
        this.issues.push({
          severity: 'CRITICAL',
          category: 'ROLEASSIGNMENTS',
          message: `RoleAssignment for employee ${assignment.employeeId} missing branchId`,
          fix: 'SET_ASSIGNMENT_BRANCH',
          data: { assignmentId: assignment._id, orgUnitId: assignment.orgUnit }
        });
      }
      
      // Check employeeId
      const empExists = await FinalizedEmployee.exists({ _id: assignment.employeeId });
      if (!empExists) {
        this.issues.push({
          severity: 'HIGH',
          category: 'ROLEASSIGNMENTS',
          message: `RoleAssignment has invalid employeeId: ${assignment.employeeId}`,
          fix: 'DELETE_ORPHAN_ASSIGNMENT',
          data: { assignmentId: assignment._id }
        });
      }
      
      // Check roleId
      const roleExists = await RoleModel.exists({ _id: assignment.roleId });
      if (!roleExists) {
        this.issues.push({
          severity: 'HIGH',
          category: 'ROLEASSIGNMENTS',
          message: `RoleAssignment has invalid roleId: ${assignment.roleId}`,
          fix: 'FIX_ASSIGNMENT_ROLE',
          data: { assignmentId: assignment._id, invalidRoleId: assignment.roleId }
        });
      }
      
      // Check orgUnit
      const orgUnitExists = await OrgUnitModel.exists({ _id: assignment.orgUnit });
      if (!orgUnitExists) {
        this.issues.push({
          severity: 'HIGH',
          category: 'ROLEASSIGNMENTS',
          message: `RoleAssignment has invalid orgUnit: ${assignment.orgUnit}`,
          fix: 'FIX_ASSIGNMENT_ORGUNIT',
          data: { assignmentId: assignment._id, invalidOrgUnitId: assignment.orgUnit }
        });
      }
    }
    
    console.log('');
  }

  async checkChairmanSetup() {
    console.log('👑 Checking Chairman Complete Setup...\n');
    
    const chairman = await FinalizedEmployee.findOne({ 
      individualName: 'AbdusSaboorKhan' 
    });
    
    if (!chairman) {
      console.log('  ❌ Chairman employee not found');
      return;
    }
    
    console.log(`  ✅ Chairman employee found: ${chairman._id}`);
    
    // Check role
    const role = await RoleModel.findById(chairman.role);
    if (!role) {
      console.log(`  ❌ Chairman's role not found: ${chairman.role}`);
    } else {
      console.log(`  ✅ Chairman's role: ${role.roleName} (${role.permissions.length} permissions)`);
    }
    
    // Check orgUnit
    const orgUnit = await OrgUnitModel.findById(chairman.orgUnit);
    if (!orgUnit) {
      console.log(`  ❌ Chairman's orgUnit not found: ${chairman.orgUnit}`);
    } else {
      console.log(`  ✅ Chairman's orgUnit: ${orgUnit.name} (level ${orgUnit.level})`);
    }
    
    // Check role assignment
    const assignment = await RoleAssignmentModel.findOne({ 
      employeeId: chairman._id, 
      isActive: true 
    });
    
    if (!assignment) {
      console.log('  ❌ Chairman has no active role assignment');
      this.issues.push({
        severity: 'CRITICAL',
        category: 'CHAIRMAN',
        message: 'Chairman missing active role assignment',
        fix: 'CREATE_CHAIRMAN_ASSIGNMENT',
        data: { employeeId: chairman._id }
      });
    } else {
      console.log(`  ✅ Chairman has active role assignment`);
      console.log(`     - Department: ${assignment.departmentCode}`);
      console.log(`     - BranchId: ${assignment.branchId || 'NULL ⚠️'}`);
      
      if (!assignment.branchId) {
        this.issues.push({
          severity: 'CRITICAL',
          category: 'CHAIRMAN',
          message: 'Chairman assignment missing branchId',
          fix: 'SET_CHAIRMAN_ASSIGNMENT_BRANCH',
          data: { assignmentId: assignment._id }
        });
      }
    }
    
    console.log('');
  }

  // ============================================
  // FIX APPLICATION
  // ============================================

  async applyFixes() {
    console.log('\n========================================');
    console.log('🔧 APPLYING FIXES');
    console.log('========================================\n');
    
    for (const issue of this.issues) {
      await this.applyFix(issue);
    }
    
    console.log('');
  }

  async applyFix(issue) {
    try {
      switch (issue.fix) {
        case 'CREATE_HEAD_OFFICE':
          await this.createHeadOffice();
          break;
          
        case 'MARK_HEAD_OFFICE':
          await this.markHeadOffice(issue.data.branchId);
          break;
          
        case 'CREATE_CHAIRMAN_ORGUNIT':
          await this.createChairmanOrgUnit();
          break;
          
        case 'SET_CHAIRMAN_BRANCH':
          await this.setChairmanBranch(issue.data.orgUnitId);
          break;
          
        case 'CREATE_CHAIRMAN_ROLE':
          await this.createChairmanRole(issue.data.roleId);
          break;
          
        case 'SET_ASSIGNMENT_BRANCH':
          await this.setAssignmentBranch(issue.data.assignmentId, issue.data.orgUnitId);
          break;
          
        case 'SET_CHAIRMAN_ASSIGNMENT_BRANCH':
          await this.setChairmanAssignmentBranch(issue.data.assignmentId);
          break;
          
        default:
          console.log(`  ⚠️  No fix handler for: ${issue.fix}`);
      }
    } catch (error) {
      console.error(`  ❌ Fix failed for ${issue.fix}:`, error.message);
    }
  }

  async createHeadOffice() {
    const headOffice = await BranchModel.create({
      name: 'Head Office',
      code: 'HQ',
      isHeadOffice: true,
      branchType: 'HeadOffice',
      location: { city: 'Headquarters', country: 'Pakistan' },
      isActive: true
    });
    
    console.log(`  ✅ Created Head Office: ${headOffice._id}`);
    this.fixes.push('Created Head Office branch');
  }

  async markHeadOffice(branchId) {
    await BranchModel.findByIdAndUpdate(branchId, { isHeadOffice: true });
    console.log(`  ✅ Marked branch ${branchId} as Head Office`);
    this.fixes.push('Marked existing branch as Head Office');
  }

  async createChairmanOrgUnit() {
    const headOffice = await BranchModel.findOne({ isHeadOffice: true });
    
    const chairman = await OrgUnitModel.create({
      name: 'CHAIRMAN',
      type: 'ORG_ROOT',
      departmentCode: 'All',
      parent: null,
      path: 'chairman',
      level: 0,
      branchId: headOffice._id,
      isGlobal: true,
      isActive: true
    });
    
    console.log(`  ✅ Created CHAIRMAN orgUnit: ${chairman._id}`);
    this.fixes.push('Created CHAIRMAN orgUnit');
  }

  async setChairmanBranch(orgUnitId) {
    const headOffice = await BranchModel.findOne({ isHeadOffice: true });
    await OrgUnitModel.findByIdAndUpdate(orgUnitId, { branchId: headOffice._id });
    console.log(`  ✅ Set branchId for Chairman orgUnit`);
    this.fixes.push('Set Chairman orgUnit branchId');
  }

  async createChairmanRole(roleId) {
    const allPermissions = await PermissionModel.find({ isActive: true });
    
    const role = await RoleModel.create({
      _id: new mongoose.Types.ObjectId(roleId),
      roleName: 'Chairman',
      description: 'Highest authority responsible for leading the board',
      category: 'Management',
      permissions: allPermissions.map(p => p._id),
      salaryRules: {
        baseSalary: 100000,
        salaryType: 'monthly',
        allowances: [],
        deductions: [],
        terminalBenefits: []
      },
      isActive: true
    });
    
    console.log(`  ✅ Created Chairman role with ${allPermissions.length} permissions`);
    this.fixes.push(`Created Chairman role with ${allPermissions.length} permissions`);
  }

  async setAssignmentBranch(assignmentId, orgUnitId) {
    const orgUnit = await OrgUnitModel.findById(orgUnitId);
    
    if (!orgUnit || !orgUnit.branchId) {
      console.log(`  ⚠️  Cannot set branch - orgUnit ${orgUnitId} has no branchId`);
      return;
    }
    
    await RoleAssignmentModel.findByIdAndUpdate(assignmentId, { 
      branchId: orgUnit.branchId,
      departmentCode: orgUnit.departmentCode 
    });
    
    console.log(`  ✅ Set branchId for assignment ${assignmentId}`);
    this.fixes.push('Fixed RoleAssignment branchId');
  }

  async setChairmanAssignmentBranch(assignmentId) {
    const headOffice = await BranchModel.findOne({ isHeadOffice: true });
    
    await RoleAssignmentModel.findByIdAndUpdate(assignmentId, { 
      branchId: headOffice._id 
    });
    
    console.log(`  ✅ Set branchId for Chairman assignment`);
    this.fixes.push('Fixed Chairman RoleAssignment branchId');
  }

  // ============================================
  // REPORTING
  // ============================================

  printReport() {
    console.log('\n========================================');
    console.log('📊 DIAGNOSTIC REPORT');
    console.log('========================================\n');
    
    if (this.issues.length === 0) {
      console.log('✅ NO ISSUES FOUND - System is healthy!\n');
      return;
    }
    
    const critical = this.issues.filter(i => i.severity === 'CRITICAL');
    const high = this.issues.filter(i => i.severity === 'HIGH');
    const medium = this.issues.filter(i => i.severity === 'MEDIUM');
    
    console.log(`🔴 CRITICAL Issues: ${critical.length}`);
    console.log(`🟠 HIGH Issues: ${high.length}`);
    console.log(`🟡 MEDIUM Issues: ${medium.length}`);
    console.log(`───────────────────────────────────────`);
    console.log(`📋 TOTAL: ${this.issues.length} issues\n`);
    
    // Print critical issues
    if (critical.length > 0) {
      console.log('🔴 CRITICAL ISSUES:\n');
      critical.forEach((issue, i) => {
        console.log(`${i + 1}. [${issue.category}] ${issue.message}`);
        console.log(`   Fix: ${issue.fix}\n`);
      });
    }
    
    // Print high issues
    if (high.length > 0) {
      console.log('🟠 HIGH PRIORITY ISSUES:\n');
      high.forEach((issue, i) => {
        console.log(`${i + 1}. [${issue.category}] ${issue.message}`);
        console.log(`   Fix: ${issue.fix}\n`);
      });
    }
    
    if (this.fixes.length > 0) {
      console.log('✅ FIXES APPLIED:\n');
      this.fixes.forEach((fix, i) => {
        console.log(`${i + 1}. ${fix}`);
      });
      console.log('');
    }
  }
}

// Run diagnostic
const diagnostic = new SystemDiagnostic();
diagnostic.run();