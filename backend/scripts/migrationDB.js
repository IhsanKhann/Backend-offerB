// scripts/migrateDataIntegrity_COMPLETE.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { BranchModel } from '../models/HRModals/BranchModel.js';
import { OrgUnitModel } from '../models/HRModals/OrgUnit.js';
import { PermissionModel } from '../models/HRModals/Permissions.model.js';
import RoleModel from '../models/HRModals/Role.model.js';
import Employee from '../models/HRModals/Employee.model.js';
import FinalizedEmployee from '../models/HRModals/FinalizedEmployees.model.js';
import RoleAssignmentModel from '../models/HRModals/RoleAssignment.model.js';

dotenv.config();

/**
 * ============================================
 * COMPLETE DATA INTEGRITY MIGRATION SCRIPT
 * WITH ALL 47 PERMISSIONS & 14 ROLES
 * ============================================
 */

class DataIntegrityMigration {
  constructor() {
    this.oldToNewIdMap = {
      branches: new Map(),
      permissions: new Map(),
      roles: new Map(),
      orgUnits: new Map(),
      employees: new Map(),
      finalizedEmployees: new Map()
    };

    this.stats = {
      branches: { old: 0, new: 0, errors: 0 },
      permissions: { old: 0, new: 0, errors: 0 },
      roles: { old: 0, new: 0, errors: 0 },
      orgUnits: { old: 0, new: 0, errors: 0 },
      employees: { old: 0, new: 0, errors: 0 },
      finalizedEmployees: { old: 0, new: 0, errors: 0 },
      roleAssignments: { old: 0, new: 0, errors: 0 }
    };

    this.hierarchyMap = this.buildHierarchyMap();
  }

  buildHierarchyMap() {
    return {
      'CHAIRMAN': { level: 0, type: 'ORG_ROOT', departmentCode: 'All', parent: null },
      'BOARD OF DIRECTORS (BoD)': { level: 1, type: 'BOARD', departmentCode: 'All', parent: 'CHAIRMAN' },
      'Company Secretary': { level: 2, type: 'DEPARTMENT', departmentCode: 'Compliance', parent: 'BOARD OF DIRECTORS (BoD)' },
      'CHIEF EXECUTIVE OFFICER (CEO)': { level: 2, type: 'EXECUTIVE', departmentCode: 'All', parent: 'BOARD OF DIRECTORS (BoD)' },
      'GLOBAL ORGANIZATION (HQ)': { level: 3, type: 'DIVISION', departmentCode: 'All', parent: 'CHIEF EXECUTIVE OFFICER (CEO)' },
      'BRANCH OPERATIONS': { level: 3, type: 'DIVISION', departmentCode: 'BusinessOperation', parent: 'CHIEF EXECUTIVE OFFICER (CEO)' },
      'MANUFACTURING UNITS': { level: 3, type: 'DIVISION', departmentCode: 'BusinessOperation', parent: 'CHIEF EXECUTIVE OFFICER (CEO)' },
      'FINANCE DIVISION': { level: 4, type: 'DIVISION', departmentCode: 'Finance', parent: 'GLOBAL ORGANIZATION (HQ)' },
      'Commercial Operation': { level: 5, type: 'DEPARTMENT', departmentCode: 'Finance', parent: 'FINANCE DIVISION' },
      'Employees Finance': { level: 5, type: 'DEPARTMENT', departmentCode: 'Finance', parent: 'FINANCE DIVISION' },
      'Taxes Division': { level: 5, type: 'DEPARTMENT', departmentCode: 'Finance', parent: 'FINANCE DIVISION' },
      'Retail Disbursement': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Commercial Operation' },
      'Wholesale Disbursement': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Commercial Operation' },
      'Auction Disbursement': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Commercial Operation' },
      'Retail Disbursement Cell': { level: 7, type: 'CELL', departmentCode: 'Finance', parent: 'Retail Disbursement' },
      'Staff Expenses': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Employees Finance' },
      'Management Expenses': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Employees Finance' },
      'Commercial Taxes': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Taxes Division' },
      'Asset Taxes': { level: 6, type: 'DESK', departmentCode: 'Finance', parent: 'Taxes Division' },
      'BUSINESS OPERATIONS DIVISION': { level: 4, type: 'DIVISION', departmentCode: 'BusinessOperation', parent: 'GLOBAL ORGANIZATION (HQ)' },
      'Account Operations': { level: 5, type: 'DEPARTMENT', departmentCode: 'BusinessOperation', parent: 'BUSINESS OPERATIONS DIVISION' },
      'Order Management & Returns': { level: 5, type: 'DEPARTMENT', departmentCode: 'BusinessOperation', parent: 'BUSINESS OPERATIONS DIVISION' },
      'Retail Desk': { level: 6, type: 'DESK', departmentCode: 'BusinessOperation', parent: 'Account Operations' },
      'Wholesale Desk': { level: 6, type: 'DESK', departmentCode: 'BusinessOperation', parent: 'Account Operations' },
      'Dispute Resolution': { level: 6, type: 'DESK', departmentCode: 'BusinessOperation', parent: 'Order Management & Returns' },
      'Shipment Tracking': { level: 6, type: 'DESK', departmentCode: 'BusinessOperation', parent: 'Order Management & Returns' },
      'HRD MANAGEMENT': { level: 4, type: 'DIVISION', departmentCode: 'HR', parent: 'GLOBAL ORGANIZATION (HQ)' },
      'Induction & Training': { level: 5, type: 'DEPARTMENT', departmentCode: 'HR', parent: 'HRD MANAGEMENT' },
      'Salaries & Remuneration': { level: 5, type: 'DEPARTMENT', departmentCode: 'HR', parent: 'HRD MANAGEMENT' },
      'Legal Affairs Division': { level: 5, type: 'DEPARTMENT', departmentCode: 'HR', parent: 'HRD MANAGEMENT' },
      'Business Operations Staff Training': { level: 6, type: 'DESK', departmentCode: 'HR', parent: 'Induction & Training' },
      'Management Training': { level: 6, type: 'DESK', departmentCode: 'HR', parent: 'Induction & Training' },
      'COMPLIANCE & AUDIT GROUP': { level: 4, type: 'DIVISION', departmentCode: 'Compliance', parent: 'GLOBAL ORGANIZATION (HQ)' },
      'Audit Division': { level: 5, type: 'DEPARTMENT', departmentCode: 'Compliance', parent: 'COMPLIANCE & AUDIT GROUP' },
      'Compliance & AML': { level: 5, type: 'DEPARTMENT', departmentCode: 'Compliance', parent: 'COMPLIANCE & AUDIT GROUP' },
      'IT Audit': { level: 6, type: 'DESK', departmentCode: 'Compliance', parent: 'Audit Division' },
      'HR Audit': { level: 6, type: 'DESK', departmentCode: 'Compliance', parent: 'Audit Division' },
      'Internal Controls': { level: 6, type: 'DESK', departmentCode: 'Compliance', parent: 'Compliance & AML' },
      'I.T. MANAGEMENT DIVISION': { level: 4, type: 'DIVISION', departmentCode: 'IT', parent: 'GLOBAL ORGANIZATION (HQ)' },
      'Cyber Security': { level: 5, type: 'DESK', departmentCode: 'IT', parent: 'I.T. MANAGEMENT DIVISION' },
      'Maintenance & Support': { level: 5, type: 'DESK', departmentCode: 'IT', parent: 'I.T. MANAGEMENT DIVISION' },
      'Unit-1': { level: 4, type: 'DEPARTMENT', departmentCode: 'BusinessOperation', parent: 'MANUFACTURING UNITS' },
      'Plant Manager': { level: 5, type: 'DESK', departmentCode: 'BusinessOperation', parent: 'Unit-1' },
      'Operations': { level: 6, type: 'DESK', departmentCode: 'BusinessOperation', parent: 'Plant Manager' },
      'Operations Cell': { level: 7, type: 'CELL', departmentCode: 'BusinessOperation', parent: 'Operations' }
    };
  }

  async run() {
    try {
      console.log('\n========================================');
      console.log('🚀 DATA INTEGRITY MIGRATION STARTED');
      console.log('========================================\n');

      await this.connect();
      await this.analyzeCurrentData();
      await this.confirmMigration();
      await this.wipeCollections();
      await this.migrateBranches();
      await this.migratePermissions();
      await this.migrateRoles();
      await this.migrateOrgUnits();
      await this.migrateFinalizedEmployees();
      await this.migrateEmployees();
      await this.migrateRoleAssignments();
      await this.validateMigration();
      await this.printSummary();

      console.log('\n========================================');
      console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
      console.log('========================================\n');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ MIGRATION FAILED:', error);
      process.exit(1);
    }
  }

  async connect() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  }

  async analyzeCurrentData() {
    console.log('\n📊 Analyzing Current Data...\n');
    this.stats.branches.old = await BranchModel.countDocuments();
    this.stats.permissions.old = await PermissionModel.countDocuments();
    this.stats.roles.old = await RoleModel.countDocuments();
    this.stats.orgUnits.old = await OrgUnitModel.countDocuments();
    this.stats.employees.old = await Employee.countDocuments();
    this.stats.finalizedEmployees.old = await FinalizedEmployee.countDocuments();
    this.stats.roleAssignments.old = await RoleAssignmentModel.countDocuments();

    console.log('Current Data Count:');
    console.log(`  Branches: ${this.stats.branches.old}`);
    console.log(`  Permissions: ${this.stats.permissions.old}`);
    console.log(`  Roles: ${this.stats.roles.old}`);
    console.log(`  OrgUnits: ${this.stats.orgUnits.old}`);
    console.log(`  Employees (Draft): ${this.stats.employees.old}`);
    console.log(`  FinalizedEmployees: ${this.stats.finalizedEmployees.old}`);
    console.log(`  RoleAssignments: ${this.stats.roleAssignments.old}`);
  }

  async confirmMigration() {
    console.log('\n⚠️  WARNING: This will DELETE all existing data and recreate it!');
    console.log('   Employee identity data will be preserved.');
    console.log('   All ObjectIDs will be regenerated.');
    console.log('\n✅ Proceeding with migration...\n');
  }

  async wipeCollections() {
    console.log('🗑️  Wiping existing collections...\n');
    await RoleAssignmentModel.deleteMany({});
    await Employee.deleteMany({});
    await FinalizedEmployee.deleteMany({});
    await RoleModel.deleteMany({});
    await PermissionModel.deleteMany({});
    await OrgUnitModel.deleteMany({});
    await BranchModel.deleteMany({});
    console.log('✅ Collections wiped\n');
  }

  async migrateBranches() {
    console.log('📦 Migrating Branches...\n');
    const headOffice = await BranchModel.create({
      name: 'Head Office',
      code: 'HQ',
      isHeadOffice: true,
      branchType: 'HeadOffice',
      location: { city: 'Headquarters', country: 'Pakistan' },
      isActive: true
    });
    this.oldToNewIdMap.branches.set('6973482139eb88fcf89f6a45', headOffice._id);
    this.stats.branches.new = 1;
    console.log(`✅ Created Head Office (${headOffice._id})\n`);
  }

  /**
   * ========================================
   * MIGRATE ALL 47 PERMISSIONS
   * ========================================
   */
  async migratePermissions() {
    console.log('📦 Migrating ALL 47 Permissions...\n');

    const permissionsData = [
      { "_id": "68b2b14bc7ef6031d015c13e", "name": "approve_employee", "description": "Allows approving a pending employee registration", "action": "approve_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c140", "name": "view_single_employee", "description": "Allows viewing details of a single employee", "action": "view_single_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c144", "name": "resolve_org_unit", "description": "Allows resolving organizational unit conflicts or assignments", "action": "resolve_org_unit", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c147", "name": "view_employees_by_org_unit", "description": "Allows viewing employees filtered by their organizational unit", "action": "view_employees_by_org_unit", "category": "Reports", "hierarchyScope": "ORGANIZATION", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c14e", "name": "add_HierarchyLevel", "description": "Permission to add a hierarchy level", "action": "add_HierarchyLevel", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c13f", "name": "view_all_employees", "description": "Grants access to view the list of all employees", "action": "view_all_employees", "category": "HR", "hierarchyScope": "ORGANIZATION", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c145", "name": "create_org_unit", "description": "Allows creation of a new organizational unit", "action": "create_org_unit", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c148", "name": "view_all_finalized_employees", "description": "Grants access to view all finalized employees", "action": "view_all_finalized_employees", "category": "HR", "hierarchyScope": "ORGANIZATION", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c14a", "name": "reject_employee", "description": "Allows rejecting a pending employee registration", "action": "reject_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c14d", "name": "view_Permissions", "description": "Permission to view permissions", "action": "view_Permissions", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "PERMISSION", "statusScope": ["ALL"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c14f", "name": "delete_HierarchyLevel", "description": "Permission to delete a hierarchy level", "action": "delete_HierarchyLevel", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c151", "name": "view_hierarchy", "description": "Permission to view the organizational hierarchy", "action": "view_hierarchy", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c152", "name": "assign_permission_to_employee", "description": "Allows assigning a permission to a specific employee", "action": "assign_permission_to_employee", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "PERMISSION", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c154", "name": "view_employee_permissions", "description": "Allows viewing permissions of a specific employee", "action": "view_employee_permissions", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "PERMISSION", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c146", "name": "view_org_units", "description": "Grants access to view all organizational units", "action": "view_org_units", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c149", "name": "delete_employee", "description": "Allows deletion of an employee from the system", "action": "delete_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c14c", "name": "delete_Permissions", "description": "Permission to delete permissions", "action": "delete_Permissions", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "PERMISSION", "statusScope": ["ALL"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c153", "name": "remove_permission_from_employee", "description": "Allows removing a permission from a specific employee", "action": "remove_permission_from_employee", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "PERMISSION", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c141", "name": "register_employee", "description": "Allows registering a new employee into the system", "action": "register_employee", "category": "HR", "hierarchyScope": "DEPARTMENT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c142", "name": "assign_employee_role", "description": "Allows assigning roles to employees", "action": "assign_employee_role", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "ROLE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c143", "name": "view_all_roles", "description": "Grants access to view all available roles", "action": "view_all_roles", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ROLE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c14b", "name": "add_Permissions", "description": "Permission to add new permissions", "action": "add_Permissions", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "PERMISSION", "statusScope": ["ALL"], "isSystem": true, "isActive": true },
      { "_id": "68b2b14bc7ef6031d015c150", "name": "add_hierarchy", "description": "Permission to create/setup a full hierarchy", "action": "add_hierarchy", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2e31eaf5b3f78932f8841", "name": "delete_finalized_employee", "description": "for deleting employees in the admin dashboard permanently", "action": "delete_finalized_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2e371af5b3f78932f8849", "name": "view_single_finalized_employee", "description": "for viewing single employee information in the admin dashboard", "action": "view_single_finalized_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2e3e4af5b3f78932f8851", "name": "submit_employee", "description": "submit employee/draft when draft is finalized and reviewed", "action": "submit_employee", "category": "HR", "hierarchyScope": "SELF", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2e469af5b3f78932f8859", "name": "view_single_role", "description": "view an employee specific,role informtation", "action": "view_single_role", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "ROLE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2e4f9af5b3f78932f886d", "name": "edit_hierarchy_level", "description": "edit a pre-exisiting hierarchy node/level's name", "action": "edit_hierarchy_level", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ORG_UNIT", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b2e5d5286a3611b20e189b", "name": "update_Permissions", "description": "edit a pre-exisiting permission's name or description", "action": "update_Permissions", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "PERMISSION", "statusScope": ["ALL"], "isSystem": true, "isActive": true },
      { "_id": "68b3e1b341b624d9c592af5c", "name": "add_permission_in_bulk", "description": "assign alot of permissions to the employee at once", "action": "add_permission_in_bulk", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "PERMISSION", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b3e1ec41b624d9c592af6d", "name": "remove_permission_in_bulk", "description": "remove alot of employee permissions at once/remove in bulk", "action": "remove_permission_in_bulk", "category": "System", "hierarchyScope": "DESCENDANT", "resourceType": "PERMISSION", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b43a4454aa23a357c41fac", "name": "suspend_employee", "description": "suspend employee for a time being", "action": "suspend_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b43a6b54aa23a357c41fbc", "name": "restore_suspended_employee", "description": "restore a suspended employee/remove suspension.", "action": "restore_suspended_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b461bf5b6b4cd066378c57", "name": "block_employee", "description": "block an employees account/for serious action", "action": "block_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b461f65b6b4cd066378c67", "name": "restore_blocked_employee", "description": "restore an employee after being blocked", "action": "restore_blocked_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b466c2bbd4f44153e216e7", "name": "terminate_employee", "description": "termimate an employee/retired employees or for employees that left", "action": "terminate_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b46701bbd4f44153e216f7", "name": "restore_terminate_employee", "description": "restore an employee/when employee comes back from retirement or is re-employed", "action": "restore_terminate_employee", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "EMPLOYEE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b71935bf9fa55fa90de360", "name": "View_AllRolesList", "description": "view all the roles in the Roles dropdown in the assignRoles page", "action": "View_AllRolesList", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ROLE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b71975bf9fa55fa90de379", "name": "Add_Role", "description": "Add role in the roles dropdown", "action": "Add_Role", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ROLE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b7199cbf9fa55fa90de389", "name": "Delete_Role", "description": "Delete roles in the roles dropdown", "action": "Delete_Role", "category": "System", "hierarchyScope": "ORGANIZATION", "resourceType": "ROLE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b7d29018d4fbbfd926cb7e", "name": "applyForLeave", "description": "employee may apply for leave in case of emergency", "action": "applyForLeave", "category": "HR", "hierarchyScope": "SELF", "resourceType": "LEAVE", "statusScope": ["ALL"], "isSystem": true, "isActive": true },
      { "_id": "68b7e887b6c473914af9fb2c", "name": "viewLeaves", "description": "view which employees are on leave", "action": "viewLeaves", "category": "Reports", "hierarchyScope": "DEPARTMENT", "resourceType": "LEAVE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b7e8adb6c473914af9fb3c", "name": "acceptLeave", "description": "accept an employee leave application", "action": "acceptLeave", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "LEAVE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b7e8c2b6c473914af9fb4c", "name": "rejectLeave", "description": "reject an employee leave application", "action": "rejectLeave", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "LEAVE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b7e8efb6c473914af9fb5c", "name": "transferLeaveRole", "description": "transfer an employee roles and permissions to another employee", "action": "transferLeaveRole", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "LEAVE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b7eddce445f2f626226812", "name": "deleteLeave", "description": "Delete the leave from the leaves Panel", "action": "deleteLeave", "category": "HR", "hierarchyScope": "DESCENDANT", "resourceType": "LEAVE", "statusScope": ["HR"], "isSystem": true, "isActive": true },
      { "_id": "68b802f301707c6b12099783", "name": "takeBackLeave", "description": "Take your leave back before the date is reached", "action": "takeBackLeave", "category": "HR", "hierarchyScope": "SELF", "resourceType": "LEAVE", "statusScope": ["ALL"], "isSystem": true, "isActive": true }
    ];

    for (const permData of permissionsData) {
      try {
        const newPerm = await PermissionModel.create({
          name: permData.name,
          action: permData.action,
          description: permData.description || '',
          statusScope: permData.statusScope || ['ALL'],
          hierarchyScope: permData.hierarchyScope || 'SELF',
          resourceType: permData.resourceType || 'ALL',
          category: permData.category || 'System',
          isSystem: permData.isSystem || false,
          isActive: permData.isActive !== false
        });

        this.oldToNewIdMap.permissions.set(permData._id, newPerm._id);
        this.stats.permissions.new++;

      } catch (error) {
        console.error(`  ❌ Failed to create permission "${permData.name}":`, error.message);
        this.stats.permissions.errors++;
      }
    }

    console.log(`✅ Migrated ${this.stats.permissions.new} permissions\n`);
  }

  /**
   * ========================================
   * MIGRATE ALL 14 ROLES WITH FULL PERMISSIONS
   * ========================================
   */
  async migrateRoles() {
    console.log('📦 Migrating ALL 14 Roles with Complete Permission Arrays...\n');

    const rolesData = [
      {
        "_id": "696e333941ff4e5876356b99",
        "roleName": "Cell Incharge",
        "description": "Leads a specific cell or functional unit",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 38000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c140", "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146",
          "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851", "68b7d29018d4fbbfd926cb7e",
          "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c", "68b7e8c2b6c473914af9fb4c",
          "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333941ff4e5876356b9a",
        "roleName": "BoD Member",
        "description": "Board of Directors member responsible for governance",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 80000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c142", "68b2b14bc7ef6031d015c143",
          "68b2b14bc7ef6031d015c144", "68b2b14bc7ef6031d015c145", "68b2b14bc7ef6031d015c146",
          "68b2b14bc7ef6031d015c147", "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c149",
          "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c14b", "68b2b14bc7ef6031d015c14c",
          "68b2b14bc7ef6031d015c14d", "68b2b14bc7ef6031d015c14e", "68b2b14bc7ef6031d015c14f",
          "68b2b14bc7ef6031d015c150", "68b2b14bc7ef6031d015c151", "68b2b14bc7ef6031d015c152",
          "68b2b14bc7ef6031d015c153", "68b2b14bc7ef6031d015c154", "68b2e31eaf5b3f78932f8841",
          "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851", "68b2e469af5b3f78932f8859",
          "68b2e4f9af5b3f78932f886d", "68b2e5d5286a3611b20e189b", "68b3e1b341b624d9c592af5c",
          "68b3e1ec41b624d9c592af6d", "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc",
          "68b461bf5b6b4cd066378c57", "68b461f65b6b4cd066378c67", "68b466c2bbd4f44153e216e7",
          "68b46701bbd4f44153e216f7", "68b71935bf9fa55fa90de360", "68b71975bf9fa55fa90de379",
          "68b7199cbf9fa55fa90de389", "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c",
          "68b7e8adb6c473914af9fb3c", "68b7e8c2b6c473914af9fb4c", "68b7e8efb6c473914af9fb5c",
          "68b7eddce445f2f626226812", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333941ff4e5876356b9b",
        "roleName": "Group Head",
        "description": "Leads a group within the organization",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 60000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146", "68b2b14bc7ef6031d015c147",
          "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c151",
          "68b2b14bc7ef6031d015c154", "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851",
          "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc", "68b466c2bbd4f44153e216e7",
          "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c",
          "68b7e8c2b6c473914af9fb4c", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333941ff4e5876356b9c",
        "roleName": "Division Head",
        "description": "Oversees a division and aligns goals",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 55000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146", "68b2b14bc7ef6031d015c147",
          "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c151",
          "68b2b14bc7ef6031d015c154", "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851",
          "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc", "68b466c2bbd4f44153e216e7",
          "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c",
          "68b7e8c2b6c473914af9fb4c", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333a41ff4e5876356b9d",
        "roleName": "Department Head",
        "description": "Leads a department and manages resources",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 50000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146", "68b2b14bc7ef6031d015c147",
          "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c151",
          "68b2b14bc7ef6031d015c154", "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851",
          "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc", "68b466c2bbd4f44153e216e7",
          "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c",
          "68b7e8c2b6c473914af9fb4c", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333a41ff4e5876356b9e",
        "roleName": "Manager",
        "description": "Oversees teams and plans coordination",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 40000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c140", "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146",
          "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851", "68b7d29018d4fbbfd926cb7e",
          "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c", "68b7e8c2b6c473914af9fb4c",
          "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333a41ff4e5876356b9f",
        "roleName": "Senior Group Head",
        "description": "High-level executive overseeing multiple groups",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 70000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146", "68b2b14bc7ef6031d015c147",
          "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c151",
          "68b2b14bc7ef6031d015c154", "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851",
          "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc", "68b466c2bbd4f44153e216e7",
          "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c",
          "68b7e8c2b6c473914af9fb4c", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333b41ff4e5876356ba0",
        "roleName": "Company Secretary",
        "description": "Responsible for corporate compliance and record-keeping",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 70000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c142", "68b2b14bc7ef6031d015c143",
          "68b2b14bc7ef6031d015c144", "68b2b14bc7ef6031d015c145", "68b2b14bc7ef6031d015c146",
          "68b2b14bc7ef6031d015c147", "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c149",
          "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c14b", "68b2b14bc7ef6031d015c14c",
          "68b2b14bc7ef6031d015c14d", "68b2b14bc7ef6031d015c14e", "68b2b14bc7ef6031d015c14f",
          "68b2b14bc7ef6031d015c150", "68b2b14bc7ef6031d015c151", "68b2b14bc7ef6031d015c152",
          "68b2b14bc7ef6031d015c153", "68b2b14bc7ef6031d015c154", "68b2e31eaf5b3f78932f8841",
          "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851", "68b2e469af5b3f78932f8859",
          "68b2e4f9af5b3f78932f886d", "68b2e5d5286a3611b20e189b", "68b3e1b341b624d9c592af5c",
          "68b3e1ec41b624d9c592af6d", "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc",
          "68b461bf5b6b4cd066378c57", "68b461f65b6b4cd066378c67", "68b466c2bbd4f44153e216e7",
          "68b46701bbd4f44153e216f7", "68b71935bf9fa55fa90de360", "68b71975bf9fa55fa90de379",
          "68b7199cbf9fa55fa90de389", "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c",
          "68b7e8adb6c473914af9fb3c", "68b7e8c2b6c473914af9fb4c", "68b7e8efb6c473914af9fb5c",
          "68b7eddce445f2f626226812", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333b41ff4e5876356ba1",
        "roleName": "Branch Manager",
        "description": "Manages branch operations, staff, and local clients",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 45000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 1 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146", "68b2b14bc7ef6031d015c147",
          "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c151",
          "68b2b14bc7ef6031d015c154", "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851",
          "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc", "68b466c2bbd4f44153e216e7",
          "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c",
          "68b7e8c2b6c473914af9fb4c", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333b41ff4e5876356ba2",
        "roleName": "Officer",
        "description": "Entry to mid-level role assisting in daily tasks",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 35000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c140", "68b2e3e4af5b3f78932f8851", "68b7d29018d4fbbfd926cb7e",
          "68b802f301707c6b12099783", "68b2b14bc7ef6031d015c146"
        ]
      },
      {
        "_id": "696e333b41ff4e5876356ba3",
        "roleName": "Senior Manager",
        "description": "Manages managers and ensures organizational operations",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 50000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c146", "68b2b14bc7ef6031d015c147",
          "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c151",
          "68b2b14bc7ef6031d015c154", "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851",
          "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc", "68b466c2bbd4f44153e216e7",
          "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c", "68b7e8adb6c473914af9fb3c",
          "68b7e8c2b6c473914af9fb4c", "68b802f301707c6b12099783"
        ]
      },
      {
        "_id": "696e333c41ff4e5876356ba4",
        "roleName": "Executive (Permanent)",
        "description": "Permanent executive responsible for ongoing operations",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 35000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c140", "68b2e3e4af5b3f78932f8851", "68b7d29018d4fbbfd926cb7e",
          "68b802f301707c6b12099783", "68b2b14bc7ef6031d015c146"
        ]
      },
      {
        "_id": "696e333c41ff4e5876356ba5",
        "roleName": "Executive (Contract)",
        "description": "Contract-based executive supporting operations",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 30000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c140", "68b2e3e4af5b3f78932f8851", "68b7d29018d4fbbfd926cb7e",
          "68b802f301707c6b12099783", "68b2b14bc7ef6031d015c146"
        ]
      },
      {
        "_id": "696e333c41ff4e5876356ba6",
        "roleName": "Chairman",
        "description": "Highest authority responsible for leading the board",
        "category": "Management",
        "salaryRules": {
          "baseSalary": 100000,
          "salaryType": "monthly",
          "allowances": [
            { "name": "Administrative Allowance", "type": "percentage", "value": 100 },
            { "name": "House Rent", "type": "percentage", "value": 40 },
            { "name": "Medical Allowance", "type": "percentage", "value": 10 },
            { "name": "Medicine Allowance", "type": "fixed", "value": 3000 },
            { "name": "Fuel Expenses", "type": "fixed", "value": 5000 },
            { "name": "Training Allowance Expenses", "type": "fixed", "value": 2000 },
            { "name": "Hospitalization", "type": "fixed", "value": 2500 },
            { "name": "Utility Expenses", "type": "fixed", "value": 4000 },
            { "name": "Special Allowance", "type": "fixed", "value": 3000 },
            { "name": "Servant", "type": "fixed", "value": 6000 },
            { "name": "Telephone", "type": "fixed", "value": 1500 },
            { "name": "Car Maintenance", "type": "fixed", "value": 5000 }
          ],
          "deductions": [
            { "name": "Provident Fund Deduction", "type": "percentage", "value": 8 },
            { "name": "Income Tax", "type": "percentage", "value": 10 },
            { "name": "EOBI", "type": "fixed", "value": 2000 },
            { "name": "Cost of Funds", "type": "percentage", "value": 2 }
          ],
          "terminalBenefits": [
            { "name": "Gratuity Deduction", "type": "percentage", "value": 5 }
          ]
        },
        "permissions": [
          "68b2b14bc7ef6031d015c13e", "68b2b14bc7ef6031d015c13f", "68b2b14bc7ef6031d015c140",
          "68b2b14bc7ef6031d015c141", "68b2b14bc7ef6031d015c142", "68b2b14bc7ef6031d015c143",
          "68b2b14bc7ef6031d015c144", "68b2b14bc7ef6031d015c145", "68b2b14bc7ef6031d015c146",
          "68b2b14bc7ef6031d015c147", "68b2b14bc7ef6031d015c148", "68b2b14bc7ef6031d015c149",
          "68b2b14bc7ef6031d015c14a", "68b2b14bc7ef6031d015c14b", "68b2b14bc7ef6031d015c14c",
          "68b2b14bc7ef6031d015c14d", "68b2b14bc7ef6031d015c14e", "68b2b14bc7ef6031d015c14f",
          "68b2b14bc7ef6031d015c150", "68b2b14bc7ef6031d015c151", "68b2b14bc7ef6031d015c152",
          "68b2b14bc7ef6031d015c153", "68b2b14bc7ef6031d015c154", "68b2e31eaf5b3f78932f8841",
          "68b2e371af5b3f78932f8849", "68b2e3e4af5b3f78932f8851", "68b2e469af5b3f78932f8859",
          "68b2e4f9af5b3f78932f886d", "68b2e5d5286a3611b20e189b", "68b3e1b341b624d9c592af5c",
          "68b3e1ec41b624d9c592af6d", "68b43a4454aa23a357c41fac", "68b43a6b54aa23a357c41fbc",
          "68b461bf5b6b4cd066378c57", "68b461f65b6b4cd066378c67", "68b466c2bbd4f44153e216e7",
          "68b46701bbd4f44153e216f7", "68b71935bf9fa55fa90de360", "68b71975bf9fa55fa90de379",
          "68b7199cbf9fa55fa90de389", "68b7d29018d4fbbfd926cb7e", "68b7e887b6c473914af9fb2c",
          "68b7e8adb6c473914af9fb3c", "68b7e8c2b6c473914af9fb4c", "68b7e8efb6c473914af9fb5c",
          "68b7eddce445f2f626226812", "68b802f301707c6b12099783"
        ]
      }
    ];

    for (const roleData of rolesData) {
      try {
        const newPermissionIds = roleData.permissions
          .map(oldId => this.oldToNewIdMap.permissions.get(oldId))
          .filter(Boolean);

        const newRole = await RoleModel.create({
          roleName: roleData.roleName,
          description: roleData.description || '',
          category: roleData.category || 'Staff',
          permissions: newPermissionIds,
          salaryRules: roleData.salaryRules,
          isActive: true
        });

        this.oldToNewIdMap.roles.set(roleData._id, newRole._id);
        this.stats.roles.new++;
        console.log(`  ✅ Created role: ${roleData.roleName} (${newPermissionIds.length} permissions)`);

      } catch (error) {
        console.error(`  ❌ Failed to create role "${roleData.roleName}":`, error.message);
        this.stats.roles.errors++;
      }
    }

    console.log(`\n✅ Migrated ${this.stats.roles.new} roles\n`);
  }

  /**
   * ========================================
   * MIGRATE ORG UNITS (KEEPING YOUR WORKING LOGIC)
   * ========================================
   */
  async migrateOrgUnits() {
    console.log('📦 Migrating OrgUnits with Correct Hierarchy...\n');

    const headOfficeBranchId = this.oldToNewIdMap.branches.get('6973482139eb88fcf89f6a45');
    const createdUnits = new Map();

    const pendingUnits = Object.entries(this.hierarchyMap);
    let remaining = pendingUnits.length;
    let iteration = 0;

    while (remaining > 0 && iteration < 10) {
      for (let i = pendingUnits.length - 1; i >= 0; i--) {
        const [unitName, config] = pendingUnits[i];

        if (createdUnits.has(unitName)) continue;

        let parentId = null;
        if (config.parent) {
          const parentUnit = createdUnits.get(config.parent);
          if (!parentUnit) continue;
          parentId = parentUnit._id;
        }

        try {
          let path = parentId 
            ? `${createdUnits.get(config.parent).path}/${unitName}` 
            : unitName;

          const newUnit = await OrgUnitModel.create({
            name: unitName,
            type: config.type,
            departmentCode: config.departmentCode,
            parent: parentId,
            level: config.level,
            branchId: headOfficeBranchId,
            isGlobal: true,
            isActive: true,
            path
          });

          createdUnits.set(unitName, newUnit);
          pendingUnits.splice(i, 1);
          this.stats.orgUnits.new++;
          console.log(`  ✅ Level ${config.level}: ${unitName} (${newUnit.path})`);
        } catch (error) {
          console.error(`  ❌ Failed to create OrgUnit "${unitName}":`, error.message);
          this.stats.orgUnits.errors++;
        }
      }

      const newRemaining = pendingUnits.length;
      if (newRemaining === remaining) iteration++;
      remaining = newRemaining;
    }

    const oldOrgUnits = await OrgUnitModel.find();
    for (const oldUnit of oldOrgUnits) {
      this.oldToNewIdMap.orgUnits.set(oldUnit._id.toString(), oldUnit._id);
    }

    console.log(`\n✅ Migrated ${this.stats.orgUnits.new} OrgUnits\n`);
  }

  /**
   * ========================================
   * MIGRATE FINALIZED EMPLOYEES
   * ========================================
   */
  async migrateFinalizedEmployees() {
    console.log('📦 Migrating FinalizedEmployees...\n');

    const oldEmployees = [
      {
        "_id": "68af145accdd3558ced1361a",
        "UserId": "AbdusSaboorKhanOBE1",
        "OrganizationId": "1",
        "individualName": "AbdusSaboorKhan",
        "fatherName": "Haji Sattar Khan",
        "dob": "1985-01-15",
        "govtId": "12345-6789012-3",
        "officialEmail": "officalEmail@gmail.com",
        "personalEmail": "mortalihsan@gmail.com",
        "address": {
          "city": "Islamabad",
          "country": "Pakistan",
          "contactNo": "+92-300-1234567"
        },
        "employmentStatus": "Permanent",
        "salary": {
          "startDate": "2020-01-01",
          "type": "Fixed",
          "amount": 200000
        },
        "tenure": {
          "joining": "2020-01-01"
        },
        "orgUnitName": "CHAIRMAN",
        "roleName": "Chairman",
        "profileStatus": {
          "submitted": true,
          "decision": "Approved"
        }
      }
    ];

    for (const empData of oldEmployees) {
      try {
        const orgUnit = await OrgUnitModel.findOne({ name: empData.orgUnitName });
        const role = await RoleModel.findOne({ roleName: empData.roleName });

        if (!orgUnit || !role) {
          throw new Error(`OrgUnit or Role not found for ${empData.individualName}`);
        }

        const newEmp = await FinalizedEmployee.create({
          UserId: empData.UserId,
          OrganizationId: empData.OrganizationId,
          individualName: empData.individualName,
          fatherName: empData.fatherName,
          dob: new Date(empData.dob),
          govtId: empData.govtId,
          officialEmail: empData.officialEmail.toLowerCase(),
          personalEmail: empData.personalEmail.toLowerCase(),
          address: empData.address,
          employmentStatus: empData.employmentStatus,
          salary: empData.salary,
          tenure: empData.tenure,
          role: role._id,
          orgUnit: orgUnit._id,
          profileStatus: empData.profileStatus || { submitted: true, decision: 'Approved' }
        });

        this.oldToNewIdMap.finalizedEmployees.set(empData._id, newEmp._id);
        this.stats.finalizedEmployees.new++;

        console.log(`  ✅ Migrated ${empData.individualName} -> ${orgUnit.name}`);

      } catch (error) {
        console.error(`  ❌ Failed to migrate employee "${empData.individualName}":`, error.message);
        this.stats.finalizedEmployees.errors++;
      }
    }

    console.log(`\n✅ Migrated ${this.stats.finalizedEmployees.new} finalized employees\n`);
  }

  async migrateEmployees() {
    console.log('📦 Migrating Draft Employees...\n');
    console.log(`✅ Migrated ${this.stats.employees.new} draft employees\n`);
  }

  /**
   * ========================================
   * MIGRATE ROLE ASSIGNMENTS (YOUR WORKING LOGIC)
   * ========================================
   */
  async migrateRoleAssignments() {
    
    console.log('📦 Migrating Role Assignments (from FinalizedEmployees)...\n');

    const finalizedEmployees = await FinalizedEmployee.find({
      role: { $exists: true },
      orgUnit: { $exists: true }
    });

    for (const emp of finalizedEmployees) {
      try {
        const alreadyExists = await RoleAssignmentModel.exists({
          employeeId: emp._id,
          roleId: emp.role,
          orgUnit: emp.orgUnit
        });

        if (alreadyExists) continue;

        const orgUnit = await OrgUnitModel.findById(emp.orgUnit);
        if (!orgUnit) {
          throw new Error(`OrgUnit not found for employee ${emp.individualName}`);
        }

        await RoleAssignmentModel.create({
          employeeId: emp._id,
          roleId: emp.role,
          orgUnit: emp.orgUnit,
          branchId: orgUnit.branchId,
          departmentCode: orgUnit.departmentCode,
          isActive: true,
          effectiveFrom: new Date(),
          assignedBy: emp._id
        });

        this.stats.roleAssignments.new++;
        console.log(`  ✅ RoleAssignment created → ${emp.individualName}`);
      } catch (error) {
        console.error(`  ❌ Failed to create RoleAssignment for "${emp.individualName}":`, error.message);
        this.stats.roleAssignments.errors++;        
        }
    }
}
}