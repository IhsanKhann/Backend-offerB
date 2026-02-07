// middlewares/hierarchyGuard.js (UPDATED WITH POWER GAP LOGIC)

import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import PermissionAggregator from "../utilis/permissionAggregation.js";
import HierarchyService from "../services/hierarchyService.js";
import CONSTANTS from "../configs/constants.js";

/**
 * ✅ HIERARCHY GUARD WITH POWER GAP VALIDATION
 * 
 * Implements the core "Power Gap" rule:
 * - Administrative actions require hierarchical superiority
 * - Functional actions only require department match
 * - Supports bypass_hierarchy flag for special permissions
 */

export class HierarchyGuard {
  
  /**
   * ========================================
   * TASK 3: CAN PERFORM ACTION (CORE VALIDATION)
   * ========================================
   * 
   * The complete power gap validation logic:
   * 
   * Step 1: Does actor have the permission?
   * Step 2: What type of action is it? (Administrative vs Functional)
   * Step 3: For Administrative: Check hierarchy
   * Step 4: For Functional: Check bypass flag or department match
   * 
   * @param {ObjectId} actorId - The user trying to perform action
   * @param {ObjectId} targetId - The user being acted upon
   * @param {String} actionPermission - Permission name (e.g., 'DELETE_EMPLOYEE')
   * @returns {Object} - { allowed: Boolean, reason: String, ... }
   */
  static async canPerformAction(actorId, targetId, actionPermission) {
    try {
      // ============================================================
      // STEP 1: PERMISSION CHECK
      // ============================================================
      const permissionObject = await PermissionAggregator.getPermissionObject(
        actorId,
        actionPermission
      );
      
      if (!permissionObject) {
        return {
          allowed: false,
          reason: `Actor does not have permission: ${actionPermission}`,
          step: 'PERMISSION_CHECK',
          code: 'NO_PERMISSION'
        };
      }
      
      // ============================================================
      // STEP 2: GET ASSIGNMENTS
      // ============================================================
      const [actorAssignment, targetAssignment] = await Promise.all([
        RoleAssignmentModel.findOne({ employeeId: actorId, isActive: true })
          .populate('orgUnit')
          .populate('permissionOverrides'),
        RoleAssignmentModel.findOne({ employeeId: targetId, isActive: true })
          .populate('orgUnit')
      ]);
      
      if (!actorAssignment || !targetAssignment) {
        return {
          allowed: false,
          reason: 'Actor or target has no active assignment',
          step: 'ASSIGNMENT_CHECK',
          code: 'NO_ASSIGNMENT'
        };
      }
      
      if (!actorAssignment.orgUnit || !targetAssignment.orgUnit) {
        return {
          allowed: false,
          reason: 'OrgUnit missing in assignment',
          step: 'ASSIGNMENT_CHECK',
          code: 'NO_ORGUNIT'
        };
      }
      
      // ============================================================
      // STEP 3: SELF-ACTION CHECK
      // ============================================================
      if (actorId.toString() === targetId.toString()) {
        // Check if permission allows self-action
        if (permissionObject.hierarchyScope === CONSTANTS.HIERARCHY_SCOPES.SELF) {
          return {
            allowed: true,
            reason: 'Self-action allowed by permission scope',
            step: 'SELF_ACTION',
            code: 'SELF_ACTION_ALLOWED'
          };
        } else {
          return {
            allowed: false,
            reason: 'Cannot perform this action on yourself',
            step: 'SELF_ACTION',
            code: 'SELF_ACTION_DENIED'
          };
        }
      }
      
      // ============================================================
      // STEP 4: ACTION TYPE DETERMINATION
      // ============================================================
      const actionType = permissionObject.actionType || CONSTANTS.ACTION_TYPES.FUNCTIONAL;
      
      console.log(`🔍 Action Type: ${actionType} for ${actionPermission}`);
      
      // ============================================================
      // STEP 5: ADMINISTRATIVE ACTION PATH
      // ============================================================
      if (actionType === CONSTANTS.ACTION_TYPES.ADMINISTRATIVE) {
        console.log('📋 Administrative action - checking hierarchy...');
        
        // ✅ Check 1: Level hierarchy
        const levelCheck = this._checkHierarchyLevel(
          actorAssignment.orgUnit,
          targetAssignment.orgUnit
        );
        
        if (!levelCheck.allowed) {
          return {
            ...levelCheck,
            step: 'LEVEL_CHECK',
            code: 'HIERARCHY_LEVEL_VIOLATION'
          };
        }
        
        // ✅ Check 2: Department scope
        const deptCheck = this._checkDepartmentScope(
          actorAssignment.departmentCode,
          targetAssignment.departmentCode
        );
        
        if (!deptCheck.allowed) {
          return {
            ...deptCheck,
            step: 'DEPARTMENT_CHECK',
            code: 'DEPARTMENT_VIOLATION'
          };
        }
        
        // ✅ Check 3: Organizational subtree
        const subtreeCheck = this._checkSubtree(
          actorAssignment.orgUnit,
          targetAssignment.orgUnit
        );
        
        if (!subtreeCheck.allowed) {
          return {
            ...subtreeCheck,
            step: 'SUBTREE_CHECK',
            code: 'SUBTREE_VIOLATION'
          };
        }
        
        // All checks passed for administrative action
        return {
          allowed: true,
          reason: 'Administrative action allowed - hierarchical authority confirmed',
          step: 'COMPLETE',
          code: 'ADMINISTRATIVE_ALLOWED',
          actionType,
          actorLevel: actorAssignment.orgUnit.level,
          targetLevel: targetAssignment.orgUnit.level
        };
      }
      
      // ============================================================
      // STEP 6: FUNCTIONAL ACTION PATH
      // ============================================================
      if (actionType === CONSTANTS.ACTION_TYPES.FUNCTIONAL) {
        console.log('⚙️ Functional action - checking bypass and department...');
        
        // ✅ Check for bypass_hierarchy flag
        const hasBypass = await this._checkHierarchyBypass(
          actorAssignment,
          permissionObject
        );
        
        if (hasBypass) {
          console.log('✅ Hierarchy bypass flag found');
          return {
            allowed: true,
            reason: 'Functional action allowed - bypass_hierarchy flag present',
            step: 'BYPASS_CHECK',
            code: 'HIERARCHY_BYPASSED',
            actionType
          };
        }
        
        // ✅ Check department match (functional actions need same dept)
        if (actorAssignment.departmentCode === CONSTANTS.DEPARTMENTS.ALL) {
          // Executive can perform functional actions across departments
          return {
            allowed: true,
            reason: 'Functional action allowed - executive access',
            step: 'DEPARTMENT_CHECK',
            code: 'EXECUTIVE_ACCESS',
            actionType
          };
        }
        
        if (actorAssignment.departmentCode !== targetAssignment.departmentCode) {
          return {
            allowed: false,
            reason: 'Functional action requires same department',
            step: 'DEPARTMENT_CHECK',
            code: 'FUNCTIONAL_DEPARTMENT_MISMATCH',
            actorDept: actorAssignment.departmentCode,
            targetDept: targetAssignment.departmentCode
          };
        }
        
        // Department matches - allow functional action
        return {
          allowed: true,
          reason: 'Functional action allowed - same department',
          step: 'COMPLETE',
          code: 'FUNCTIONAL_ALLOWED',
          actionType
        };
      }
      
      // ============================================================
      // STEP 7: INFORMATIONAL ACTION PATH
      // ============================================================
      if (actionType === CONSTANTS.ACTION_TYPES.INFORMATIONAL) {
        console.log('👁️ Informational action - read-only access');
        
        // For informational actions, just having the permission is enough
        // Department filtering happens in the query layer
        return {
          allowed: true,
          reason: 'Informational action allowed - read-only access',
          step: 'COMPLETE',
          code: 'INFORMATIONAL_ALLOWED',
          actionType
        };
      }
      
      // ============================================================
      // FALLBACK: UNKNOWN ACTION TYPE
      // ============================================================
      console.warn(`⚠️ Unknown action type: ${actionType}`);
      return {
        allowed: false,
        reason: `Unknown action type: ${actionType}`,
        step: 'ACTION_TYPE_CHECK',
        code: 'UNKNOWN_ACTION_TYPE'
      };
      
    } catch (error) {
      console.error('❌ canPerformAction error:', error);
      return {
        allowed: false,
        reason: 'Error during permission validation',
        step: 'ERROR',
        code: 'VALIDATION_ERROR',
        error: error.message
      };
    }
  }

  /**
   * ========================================
   * HELPER: Check hierarchy bypass flag
   * ========================================
   * Look for special bypass flag in permission overrides
   */
  static async _checkHierarchyBypass(actorAssignment, permissionObject) {
    try {
      // Check if permission has bypass metadata
      if (permissionObject.metadata?.bypassHierarchy === true) {
        return true;
      }
      
      // Check if user has a permission override with bypass
      if (actorAssignment.permissionOverrides) {
        const overrides = await actorAssignment.permissionOverrides;
        
        for (const override of overrides) {
          if (override._id.toString() === permissionObject._id.toString()) {
            if (override.metadata?.bypassHierarchy === true) {
              return true;
            }
          }
        }
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ _checkHierarchyBypass error:', error);
      return false;
    }
  }

  /**
   * Level-based hierarchy check
   * Rule: actor.level < target.level
   */
  static _checkHierarchyLevel(actorOrgUnit, targetOrgUnit) {
    if (actorOrgUnit.level >= targetOrgUnit.level) {
      return {
        allowed: false,
        reason: `Cannot act on same or higher level (Actor: L${actorOrgUnit.level}, Target: L${targetOrgUnit.level})`,
        actorLevel: actorOrgUnit.level,
        targetLevel: targetOrgUnit.level
      };
    }
    
    return { allowed: true };
  }

  /**
   * Department scope check
   * Executive (departmentCode: "All") can act across departments
   */
  static _checkDepartmentScope(actorDept, targetDept) {
    // Executive access bypasses department restrictions
    if (actorDept === CONSTANTS.DEPARTMENTS.ALL) {
      return { allowed: true };
    }
    
    // Same department check
    if (actorDept !== targetDept) {
      return {
        allowed: false,
        reason: `Cross-department action not allowed (Actor: ${actorDept}, Target: ${targetDept})`
      };
    }
    
    return { allowed: true };
  }

  /**
   * Subtree check: Target must be descendant of actor
   * Uses path-based hierarchy validation
   */
  static _checkSubtree(actorOrgUnit, targetOrgUnit) {
    // Target path must start with actor's path
    if (!targetOrgUnit.path.startsWith(actorOrgUnit.path + '.') &&
        targetOrgUnit.path !== actorOrgUnit.path) {
      return {
        allowed: false,
        reason: 'Target is not in actor\'s organizational subtree',
        actorPath: actorOrgUnit.path,
        targetPath: targetOrgUnit.path
      };
    }
    
    return { allowed: true };
  }

  /**
   * ========================================
   * EXPRESS MIDDLEWARE WRAPPER
   * ========================================
   */
  static middleware(options = {}) {
    return async (req, res, next) => {
      try {
        const actorId = req.user?._id;
        const targetId = req.params.employeeId || req.params.targetId || req.body.targetEmployeeId;
        
        if (!actorId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }
        
        if (!targetId) {
          return res.status(400).json({
            success: false,
            message: 'Target employee ID required'
          });
        }
        
        // Don't check if acting on self (unless explicitly disabled)
        if (actorId.toString() === targetId.toString() && !options.blockSelfAction) {
          return next();
        }
        
        // Get permission from previous middleware (authorize)
        const permissionAction = req.permissionCheck?.action;
        
        if (!permissionAction) {
          return res.status(500).json({
            success: false,
            message: 'Permission check middleware must run before hierarchy guard'
          });
        }
        
        // Check authority
        const check = await HierarchyGuard.canPerformAction(actorId, targetId, permissionAction);
        
        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient authority',
            reason: check.reason,
            code: check.code,
            details: {
              step: check.step,
              actorLevel: check.actorLevel,
              targetLevel: check.targetLevel
            }
          });
        }
        
        // Attach check result to request
        req.hierarchyCheck = check;
        next();
        
      } catch (error) {
        console.error('Hierarchy Guard Error:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to verify authority',
          error: error.message
        });
      }
    };
  }
}

/**
 * Export middleware creator
 */
export const checkHierarchy = (options) => HierarchyGuard.middleware(options);

export default HierarchyGuard;