// services/hierarchyService.js

import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import CONSTANTS, { isExecutiveLevel, getPowerRankName } from "../configs/constants.js";

/**
 * ✅ HIERARCHY HELPER SERVICE
 * 
 * Provides utilities for:
 * - Path traversal in org tree
 * - Ancestor/descendant relationships
 * - Power rank calculation
 * - Hierarchy validation
 */

export class HierarchyService {
  
  /**
   * ========================================
   * TASK 1.1: PATH TO ROOT
   * ========================================
   * Fetch the complete path from a specific orgUnit to the root
   * 
   * @param {ObjectId|String} orgUnitId - The org unit ID
   * @returns {Array} - Array of OrgUnits from target to root
   * 
   * Example:
   * Input: "finance_division.accounting_dept.payroll_desk"
   * Output: [
   *   { name: "Payroll Desk", level: 5 },
   *   { name: "Accounting Dept", level: 4 },
   *   { name: "Finance Division", level: 3 },
   *   { name: "CEO", level: 2 },
   *   { name: "Board", level: 1 },
   *   { name: "Chairman", level: 0 }
   * ]
   */
  static async getPathToRoot(orgUnitId) {
    try {
      const orgUnit = await OrgUnitModel.findById(orgUnitId);
      
      if (!orgUnit) {
        throw new Error(`OrgUnit not found: ${orgUnitId}`);
      }
      
      const path = [orgUnit];
      let current = orgUnit;
      
      // Traverse upward until we hit the root
      while (current.parent) {
        current = await OrgUnitModel.findById(current.parent);
        
        if (!current) {
          console.warn(`⚠️ Broken hierarchy: parent not found`);
          break;
        }
        
        path.push(current);
      }
      
      return path;
      
    } catch (error) {
      console.error("❌ getPathToRoot error:", error);
      throw error;
    }
  }

  /**
   * ========================================
   * TASK 1.2: ANCESTOR CHECK
   * ========================================
   * Determine if Employee A is an ancestor of Employee B
   * 
   * @param {ObjectId} ancestorEmployeeId - Employee who might be the ancestor
   * @param {ObjectId} descendantEmployeeId - Employee who might be the descendant
   * @returns {Object} - { isAncestor: Boolean, relationship: String, distance: Number }
   * 
   * Logic:
   * - Get both employees' orgUnits
   * - Check if descendant's path starts with ancestor's path
   * - Calculate hierarchical distance
   */
  static async isAncestorOf(ancestorEmployeeId, descendantEmployeeId) {
    try {
      // Get both employees' assignments
      const [ancestorAssignment, descendantAssignment] = await Promise.all([
        RoleAssignmentModel.findOne({ 
          employeeId: ancestorEmployeeId, 
          isActive: true 
        }).populate('orgUnit'),
        
        RoleAssignmentModel.findOne({ 
          employeeId: descendantEmployeeId, 
          isActive: true 
        }).populate('orgUnit')
      ]);
      
      // Validate assignments exist
      if (!ancestorAssignment || !descendantAssignment) {
        return {
          isAncestor: false,
          relationship: 'NO_ASSIGNMENT',
          distance: null,
          reason: 'One or both employees have no active assignment'
        };
      }
      
      // Validate orgUnits populated
      if (!ancestorAssignment.orgUnit || !descendantAssignment.orgUnit) {
        return {
          isAncestor: false,
          relationship: 'NO_ORGUNIT',
          distance: null,
          reason: 'OrgUnit missing in assignment'
        };
      }
      
      const ancestorOrgUnit = ancestorAssignment.orgUnit;
      const descendantOrgUnit = descendantAssignment.orgUnit;
      
      // Check if same person
      if (ancestorOrgUnit._id.toString() === descendantOrgUnit._id.toString()) {
        return {
          isAncestor: false,
          relationship: 'SELF',
          distance: 0,
          reason: 'Same organizational position'
        };
      }
      
      // ✅ Path-based ancestry check
      const ancestorPath = ancestorOrgUnit.path;
      const descendantPath = descendantOrgUnit.path;
      
      const isAncestor = descendantPath.startsWith(ancestorPath + '.');
      
      if (isAncestor) {
        // Calculate distance
        const distance = descendantOrgUnit.level - ancestorOrgUnit.level;
        
        // Determine relationship type
        let relationship;
        if (distance === 1) {
          relationship = 'DIRECT_PARENT';
        } else if (distance === 2) {
          relationship = 'GRANDPARENT';
        } else {
          relationship = 'DISTANT_ANCESTOR';
        }
        
        return {
          isAncestor: true,
          relationship,
          distance,
          ancestorPath,
          descendantPath,
          ancestorLevel: ancestorOrgUnit.level,
          descendantLevel: descendantOrgUnit.level
        };
      } else {
        // Not in hierarchy - could be peer or different branch
        if (ancestorOrgUnit.level === descendantOrgUnit.level) {
          return {
            isAncestor: false,
            relationship: 'PEER',
            distance: 0,
            reason: 'Same hierarchical level, different branches'
          };
        } else if (ancestorOrgUnit.level > descendantOrgUnit.level) {
          return {
            isAncestor: false,
            relationship: 'SUBORDINATE',
            distance: ancestorOrgUnit.level - descendantOrgUnit.level,
            reason: 'Ancestor is actually at lower level'
          };
        } else {
          return {
            isAncestor: false,
            relationship: 'DIFFERENT_BRANCH',
            distance: null,
            reason: 'Not in same hierarchical branch'
          };
        }
      }
      
    } catch (error) {
      console.error("❌ isAncestorOf error:", error);
      throw error;
    }
  }

  /**
   * ========================================
   * TASK 1.3: POWER RANK CALCULATION
   * ========================================
   * Calculate "power rank" based on tree depth and position
   * 
   * @param {ObjectId} employeeId - The employee
   * @returns {Object} - { rank: Number, rankName: String, level: Number, isExecutive: Boolean }
   * 
   * Power Rank Formula:
   * - Level 0 (Chairman) = SUPREME (rank 0)
   * - Level 1 (Board) = EXECUTIVE (rank 1)
   * - Level 2 (CEO) = SENIOR (rank 2)
   * - Level 3+ = Based on level
   * 
   * Additional factors:
   * - Department "All" = +executive privileges
   * - Number of subordinates = +influence score
   */
  static async calculatePowerRank(employeeId) {
    try {
      const assignment = await RoleAssignmentModel.findOne({
        employeeId,
        isActive: true
      })
        .populate('orgUnit')
        .populate('roleId');
      
      if (!assignment || !assignment.orgUnit) {
        return {
          rank: null,
          rankName: 'NO_ASSIGNMENT',
          level: null,
          isExecutive: false,
          subordinateCount: 0
        };
      }
      
      const orgUnit = assignment.orgUnit;
      const level = orgUnit.level;
      
      // Base rank = level (0-6)
      let rank = level;
      
      // ✅ Executive bonus
      const isExecutive = isExecutiveLevel(level) || 
                          assignment.departmentCode === CONSTANTS.DEPARTMENTS.ALL;
      
      // ✅ Calculate subordinate count (influence)
      const descendants = await orgUnit.getDescendants();
      const subordinateCount = await RoleAssignmentModel.countDocuments({
        orgUnit: { $in: [orgUnit._id, ...descendants.map(d => d._id)] },
        isActive: true
      });
      
      // ✅ Influence modifier (more subordinates = higher effective rank)
      let influenceModifier = 0;
      if (subordinateCount > 100) influenceModifier = -0.5;
      else if (subordinateCount > 50) influenceModifier = -0.3;
      else if (subordinateCount > 20) influenceModifier = -0.1;
      
      const effectiveRank = rank + influenceModifier;
      
      return {
        rank: Math.max(0, effectiveRank), // Never below 0
        rankName: getPowerRankName(level),
        level,
        isExecutive,
        subordinateCount,
        influenceModifier,
        orgUnitName: orgUnit.name,
        orgUnitPath: orgUnit.path,
        departmentCode: assignment.departmentCode,
        roleCategory: assignment.roleId?.category
      };
      
    } catch (error) {
      console.error("❌ calculatePowerRank error:", error);
      throw error;
    }
  }

  /**
   * ========================================
   * ADDITIONAL UTILITY: GET SUBORDINATES
   * ========================================
   * Get all employees under a given employee in the hierarchy
   */
  static async getSubordinates(employeeId) {
    try {
      const assignment = await RoleAssignmentModel.findOne({
        employeeId,
        isActive: true
      }).populate('orgUnit');
      
      if (!assignment || !assignment.orgUnit) {
        return [];
      }
      
      // Get all descendant org units
      const descendants = await assignment.orgUnit.getDescendants();
      const orgUnitIds = [assignment.orgUnit._id, ...descendants.map(d => d._id)];
      
      // Get all employees in these units
      const subordinateAssignments = await RoleAssignmentModel.find({
        orgUnit: { $in: orgUnitIds },
        isActive: true,
        employeeId: { $ne: employeeId } // Exclude self
      })
        .populate('employeeId', 'individualName personalEmail UserId avatar')
        .populate('roleId', 'roleName category')
        .populate('orgUnit', 'name level type');
      
      return subordinateAssignments
        .filter(a => a.employeeId) // Remove any null employees
        .map(a => ({
          employee: a.employeeId,
          role: a.roleId,
          orgUnit: a.orgUnit,
          departmentCode: a.departmentCode,
          level: a.orgUnit.level
        }));
      
    } catch (error) {
      console.error("❌ getSubordinates error:", error);
      throw error;
    }
  }

  /**
   * ========================================
   * ADDITIONAL UTILITY: GET COMMON ANCESTOR
   * ========================================
   * Find the lowest common ancestor of two employees
   */
  static async getCommonAncestor(employeeId1, employeeId2) {
    try {
      const [path1, path2] = await Promise.all([
        this.getPathToRoot(
          (await RoleAssignmentModel.findOne({ 
            employeeId: employeeId1, 
            isActive: true 
          }).populate('orgUnit')).orgUnit._id
        ),
        this.getPathToRoot(
          (await RoleAssignmentModel.findOne({ 
            employeeId: employeeId2, 
            isActive: true 
          }).populate('orgUnit')).orgUnit._id
        )
      ]);
      
      // Find common ancestor by comparing paths from root
      path1.reverse(); // Root first
      path2.reverse();
      
      let commonAncestor = null;
      const minLength = Math.min(path1.length, path2.length);
      
      for (let i = 0; i < minLength; i++) {
        if (path1[i]._id.toString() === path2[i]._id.toString()) {
          commonAncestor = path1[i];
        } else {
          break;
        }
      }
      
      return commonAncestor;
      
    } catch (error) {
      console.error("❌ getCommonAncestor error:", error);
      throw error;
    }
  }

  /**
   * ========================================
   * ADDITIONAL UTILITY: VALIDATE HIERARCHY MOVE
   * ========================================
   * Check if an employee can be moved to a new orgUnit
   */
  static async validateHierarchyMove(employeeId, newOrgUnitId) {
    try {
      const newOrgUnit = await OrgUnitModel.findById(newOrgUnitId);
      
      if (!newOrgUnit) {
        return {
          valid: false,
          reason: 'Target org unit not found'
        };
      }
      
      // Check if employee has subordinates who would become ancestors
      const subordinates = await this.getSubordinates(employeeId);
      
      for (const sub of subordinates) {
        const subOrgUnit = sub.orgUnit;
        
        // Check if new position would be under any subordinate
        if (newOrgUnit.path.startsWith(subOrgUnit.path + '.')) {
          return {
            valid: false,
            reason: `Cannot move under subordinate: ${sub.employee.individualName}`,
            conflictingEmployee: sub.employee
          };
        }
      }
      
      return {
        valid: true,
        newLevel: newOrgUnit.level,
        newPath: newOrgUnit.path
      };
      
    } catch (error) {
      console.error("❌ validateHierarchyMove error:", error);
      throw error;
    }
  }
}

export default HierarchyService;