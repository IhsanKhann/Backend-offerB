// utils/permissionAggregation.js
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import RoleModel from "../models/HRModals/Role.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import { PermissionModel } from "../models/HRModals/Permissions.model.js";

/**
 * ✅ FIXED: DYNAMIC PERMISSION AGGREGATION ENGINE
 * 
 * Core principle: Permissions flow UPWARD in the tree
 * - A manager inherits ALL permissions from subordinates
 * - Authority flows DOWNWARD (can act on lower levels)
 * - Permissions aggregate UPWARD (inherit from sub-tree)
 * 
 * NEW: Now filters permissions by statusScope BEFORE returning
 * Returns FULL permission objects (not just names) to enable middleware validation
 */

class PermissionAggregator {
  /**
   * ✅ FIXED: Get effective permissions with statusScope filtering
   * @param {String} employeeId - The employee ID
   * @returns {Object} - { direct, inherited, effective, orgUnit, level, departmentCode, isExecutive }
   */
  static async getEffectivePermissions(employeeId) {
    // 1️⃣ Get employee's active assignment
    const assignment = await RoleAssignmentModel.findOne({
      employeeId,
      isActive: true
    })
      .populate('roleId')
      .populate('orgUnit')
      .populate('permissionOverrides');

    if (!assignment) {
      return {
        direct: [],
        inherited: [],
        effective: [],
        orgUnit: null,
        level: 0,
        departmentCode: null,
        isExecutive: false
      };
    }

    // 2️⃣ Get direct permissions from role
    const directPermissions = await this._getDirectPermissions(assignment);

    // 3️⃣ Get inherited permissions from sub-tree
    const inheritedPermissions = await this._getInheritedPermissions(assignment.orgUnit);

    // 4️⃣ Combine and deduplicate
    const allPermissions = this._mergePermissions(directPermissions, inheritedPermissions);
    
    // ✅ NEW: Filter by statusScope before returning
    const effectivePermissions = this._filterByStatusScope(
      allPermissions, 
      assignment.departmentCode
    );

    return {
      direct: this._filterByStatusScope(directPermissions, assignment.departmentCode),
      inherited: this._filterByStatusScope(inheritedPermissions, assignment.departmentCode),
      effective: effectivePermissions,
      orgUnit: assignment.orgUnit,
      level: assignment.orgUnit?.level || 0,
      departmentCode: assignment.departmentCode,
      isExecutive: assignment.departmentCode === 'All'
    };
  }

  /**
   * ✅ NEW: Filter permissions by statusScope
   * Ensures users only see permissions applicable to their department
   * 
   * @param {Array} permissions - Array of permission objects
   * @param {String} userDepartmentCode - User's department (HR, Finance, BusinessOperation, All)
   * @returns {Array} - Filtered permissions
   */
  static _filterByStatusScope(permissions, userDepartmentCode) {
    if (!userDepartmentCode) return [];

    // Executive users (departmentCode: "All") get ALL permissions
    if (userDepartmentCode === 'All') {
      return permissions;
    }

    // Filter permissions where statusScope includes the user's department OR "ALL"
    return permissions.filter(perm => {
      if (!perm.statusScope || perm.statusScope.length === 0) {
        // If no statusScope defined, treat as ALL
        return true;
      }

      // Check if permission applies to this department
      return perm.statusScope.includes('ALL') || 
             perm.statusScope.includes(userDepartmentCode);
    });
  }

  /**
   * Get permissions directly assigned to this role
   */
  static async _getDirectPermissions(assignment) {
    const permissions = [];

    // From role declaration
    if (assignment.roleId?.permissions) {
      const rolePerms = await PermissionModel.find({
        _id: { $in: assignment.roleId.permissions },
        isActive: true
      });
      permissions.push(...rolePerms);
    }

    // From permission overrides
    if (assignment.permissionOverrides?.length) {
      permissions.push(...assignment.permissionOverrides);
    }

    return this._deduplicate(permissions);
  }

  /**
   * Get all permissions from descendant OrgUnits
   * This is where the "upward aggregation" happens
   */
  static async _getInheritedPermissions(orgUnit) {
    if (!orgUnit) return [];

    // 🌳 Find all descendants using path regex
    const pathRegex = new RegExp(`^${orgUnit.path}\\.`);
    const descendants = await OrgUnitModel.find({
      path: pathRegex,
      isActive: true
    });

    if (descendants.length === 0) return [];

    // Get all role assignments in descendant units
    const descendantIds = descendants.map(d => d._id);
    const descendantAssignments = await RoleAssignmentModel.find({
      orgUnit: { $in: descendantIds },
      isActive: true
    }).populate('roleId');

    // Collect all permissions from these assignments
    const permissionIds = new Set();
    
    for (const assignment of descendantAssignments) {
      if (assignment.roleId?.permissions) {
        assignment.roleId.permissions.forEach(p => 
          permissionIds.add(p.toString())
        );
      }
    }

    // Fetch actual permission objects
    const permissions = await PermissionModel.find({
      _id: { $in: Array.from(permissionIds) },
      isActive: true
    });

    return permissions;
  }

  /**
   * Merge and deduplicate permissions
   */
  static _mergePermissions(direct, inherited) {
    const all = [...direct, ...inherited];
    return this._deduplicate(all);
  }

  /**
   * Remove duplicate permissions
   */
  static _deduplicate(permissions) {
    const seen = new Map();
    
    permissions.forEach(perm => {
      const id = perm._id.toString();
      if (!seen.has(id)) {
        seen.set(id, perm);
      }
    });

    return Array.from(seen.values());
  }

  /**
   * ✅ ENHANCED: Check if user has a specific permission
   * Now checks against full permission objects, not just action names
   * 
   * @param {String} employeeId - Employee ID
   * @param {String} permissionAction - Permission action to check
   * @param {String} resourceType - Optional resource type validation
   * @returns {Boolean} - True if permission exists
   */
  static async hasPermission(employeeId, permissionAction, resourceType = null) {
    const { effective } = await this.getEffectivePermissions(employeeId);
    
    return effective.some(p => {
      const actionMatch = p.action === permissionAction || p.name === permissionAction;
      
      if (resourceType) {
        // If resourceType specified, must match or be "ALL"
        const resourceMatch = p.resourceType === resourceType || p.resourceType === 'ALL';
        return actionMatch && resourceMatch;
      }
      
      return actionMatch;
    });
  }

  /**
   * ✅ NEW: Get specific permission object
   * Returns the full permission object for validation in middleware
   * 
   * @param {String} employeeId - Employee ID
   * @param {String} permissionAction - Permission action to find
   * @returns {Object|null} - Permission object or null
   */
  static async getPermissionObject(employeeId, permissionAction) {
    const { effective } = await this.getEffectivePermissions(employeeId);
    
    return effective.find(p => 
      p.action === permissionAction || p.name === permissionAction
    ) || null;
  }

  /**
   * Check if user has ANY of the specified permissions
   */
  static async hasAnyPermission(employeeId, permissionActions) {
    const { effective } = await this.getEffectivePermissions(employeeId);
    return permissionActions.some(action =>
      effective.some(p => p.action === action || p.name === action)
    );
  }

  /**
   * Check if user has ALL specified permissions
   */
  static async hasAllPermissions(employeeId, permissionActions) {
    const { effective } = await this.getEffectivePermissions(employeeId);
    return permissionActions.every(action =>
      effective.some(p => p.action === action || p.name === action)
    );
  }

  /**
   * ✅ ENHANCED: Get permission breakdown for UI display
   * Now includes scope information for frontend filtering
   */
  static async getPermissionBreakdown(employeeId) {
    const { 
      direct, 
      inherited, 
      orgUnit, 
      level, 
      departmentCode, 
      isExecutive 
    } = await this.getEffectivePermissions(employeeId);

    return {
      summary: {
        directCount: direct.length,
        inheritedCount: inherited.length,
        totalEffective: direct.length + inherited.length - this._getDuplicateCount(direct, inherited),
        level,
        orgUnitName: orgUnit?.name,
        departmentCode,
        isExecutive
      },
      direct: direct.map(p => ({
        id: p._id,
        name: p.name,
        action: p.action,
        description: p.description,
        statusScope: p.statusScope,
        hierarchyScope: p.hierarchyScope,
        resourceType: p.resourceType,
        category: p.category,
        source: 'direct'
      })),
      inherited: inherited.map(p => ({
        id: p._id,
        name: p.name,
        action: p.action,
        description: p.description,
        statusScope: p.statusScope,
        hierarchyScope: p.hierarchyScope,
        resourceType: p.resourceType,
        category: p.category,
        source: 'inherited'
      })),
      // ✅ NEW: Include scope metadata for frontend
      scopeMetadata: {
        availableDepartments: this._getAvailableDepartments(direct, inherited),
        availableResources: this._getAvailableResources(direct, inherited),
        hierarchyScopes: this._getHierarchyScopes(direct, inherited)
      }
    };
  }

  /**
   * ✅ NEW: Get unique departments from permissions
   */
  static _getAvailableDepartments(direct, inherited) {
    const all = [...direct, ...inherited];
    const depts = new Set();
    
    all.forEach(p => {
      if (p.statusScope) {
        p.statusScope.forEach(scope => depts.add(scope));
      }
    });
    
    return Array.from(depts);
  }

  /**
   * ✅ NEW: Get unique resource types from permissions
   */
  static _getAvailableResources(direct, inherited) {
    const all = [...direct, ...inherited];
    const resources = new Set();
    
    all.forEach(p => {
      if (p.resourceType) {
        resources.add(p.resourceType);
      }
    });
    
    return Array.from(resources);
  }

  /**
   * ✅ NEW: Get unique hierarchy scopes from permissions
   */
  static _getHierarchyScopes(direct, inherited) {
    const all = [...direct, ...inherited];
    const scopes = new Set();
    
    all.forEach(p => {
      if (p.hierarchyScope) {
        scopes.add(p.hierarchyScope);
      }
    });
    
    return Array.from(scopes);
  }

  static _getDuplicateCount(arr1, arr2) {
    const ids1 = new Set(arr1.map(p => p._id.toString()));
    return arr2.filter(p => ids1.has(p._id.toString())).length;
  }
}

export default PermissionAggregator;