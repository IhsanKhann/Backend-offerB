// middlewares/hierarchyGuard.js (BOOTSTRAP PARADOX FIX)

import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";
import PermissionAggregator from "../utilis/permissionAggregation.js";
import HierarchyService from "../services/hierarchyService.js";
import CONSTANTS from "../configs/constants.js";

/**
 * ✅ HIERARCHY GUARD WITH BOOTSTRAP PARADOX FIX
 * 
 * Solves the "chicken-and-egg" problem:
 * - Cannot assign a role because target has no role assignment
 * - Cannot create role assignment because hierarchy guard blocks it
 * 
 * NEW FEATURES:
 * - Provisioning bypass for initialization actions
 * - Informational bypass for viewing unassigned employees
 * - Executive authority for onboarding new employees
 * - Graceful degradation when target lacks assignment
 */

export class HierarchyGuard {
  
  /**
   * ========================================
   * INITIALIZATION ACTION REGISTRY
   * ========================================
   * Actions that are allowed to operate on employees
   * who don't have a role assignment yet
   */
  static INITIALIZATION_ACTIONS = [
    'register_employee',
    'assign_employee_role',
    'submit_employee',
    'edit_employee',  // May need to edit before role is assigned
    'approve_employee'  // Approving creates the finalized record
  ];

  /**
   * ========================================
   * CORE VALIDATION: CAN PERFORM ACTION
   * ========================================
   * 
   * Enhanced with null target handling:
   * 
   * Step 0: Check if target has assignment (NEW)
   * Step 1: Does actor have the permission?
   * Step 2: What type of action is it?
   * Step 3: Handle initialization scenarios
   * Step 4: For Administrative: Check hierarchy
   * Step 5: For Functional: Check department
   * Step 6: For Informational: Allow
   * 
   * @param {ObjectId} actorId - The user trying to perform action
   * @param {ObjectId} targetId - The user being acted upon
   * @param {String} actionPermission - Permission name
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
      // STEP 2: GET ASSIGNMENTS (WITH NULL HANDLING)
      // ============================================================
      const [actorAssignment, targetAssignment] = await Promise.all([
        RoleAssignmentModel.findOne({ employeeId: actorId, isActive: true })
          .populate('orgUnit')
          .populate('permissionOverrides'),
        RoleAssignmentModel.findOne({ employeeId: targetId, isActive: true })
          .populate('orgUnit')
      ]);
      
      // ✅ CRITICAL: Actor must ALWAYS have an assignment
      if (!actorAssignment) {
        return {
          allowed: false,
          reason: 'Actor has no active role assignment',
          step: 'ACTOR_CHECK',
          code: 'NO_ACTOR_ASSIGNMENT'
        };
      }

      if (!actorAssignment.orgUnit) {
        return {
          allowed: false,
          reason: 'Actor has assignment but missing orgUnit',
          step: 'ACTOR_CHECK',
          code: 'ACTOR_MISSING_ORGUNIT'
        };
      }
      
      // ============================================================
      // STEP 3: NULL TARGET HANDLING (BOOTSTRAP PARADOX FIX)
      // ============================================================
      if (!targetAssignment) {
        console.log(`⚠️  Target has NO role assignment - checking if this is allowed...`);
        
        // Get action type to determine handling
        const actionType = permissionObject.actionType || CONSTANTS.ACTION_TYPES.FUNCTIONAL;
        
        // ✅ CASE 1: INITIALIZATION ACTIONS
        // These actions are specifically designed to work with new/unassigned employees
        if (this.INITIALIZATION_ACTIONS.includes(actionPermission)) {
          console.log(`✅ "${actionPermission}" is an INITIALIZATION action`);
          
          // Apply actor authority check
          const authorityCheck = this._checkInitializationAuthority(
            actorAssignment,
            actionPermission
          );
          
          if (!authorityCheck.allowed) {
            return authorityCheck;
          }
          
          return {
            allowed: true,
            reason: `Initialization action allowed: ${authorityCheck.reason}`,
            step: 'INITIALIZATION_BYPASS',
            code: 'NEW_EMPLOYEE_PROVISIONING',
            actionType,
            bypassReason: 'Target has no role assignment yet'
          };
        }
        
        // ✅ CASE 2: INFORMATIONAL ACTIONS
        // Allow viewing/reading unassigned employees if actor has permission
        if (actionType === CONSTANTS.ACTION_TYPES.INFORMATIONAL) {
          console.log(`✅ "${actionPermission}" is INFORMATIONAL - allowing view of unassigned employee`);
          
          return {
            allowed: true,
            reason: 'Informational action allowed on unassigned employee',
            step: 'INFORMATIONAL_NULL_TARGET',
            code: 'VIEW_UNASSIGNED_EMPLOYEE',
            actionType
          };
        }
        
        // ✅ CASE 3: FUNCTIONAL ACTIONS WITH BYPASS FLAG
        if (actionType === CONSTANTS.ACTION_TYPES.FUNCTIONAL) {
          const hasBypass = await this._checkHierarchyBypass(
            actorAssignment,
            permissionObject
          );
          
          if (hasBypass) {
            console.log(`✅ Functional action with bypass_hierarchy flag`);
            
            return {
              allowed: true,
              reason: 'Functional action with bypass flag - allowed on unassigned employee',
              step: 'FUNCTIONAL_BYPASS',
              code: 'BYPASS_NULL_TARGET',
              actionType
            };
          }
        }
        
        // ❌ CASE 4: ALL OTHER ACTIONS
        // If we get here, the action requires a valid target assignment
        console.log(`❌ "${actionPermission}" requires target to have a role assignment`);
        
        return {
          allowed: false,
          reason: 'Target employee has no active role assignment and this action requires one',
          step: 'TARGET_ASSIGNMENT_CHECK',
          code: 'NO_TARGET_ASSIGNMENT',
          actionType,
          hint: 'Target must be assigned a role before this action can be performed'
        };
      }
      
      // ============================================================
      // STEP 4: VALIDATE TARGET ORGUNIT (IF ASSIGNMENT EXISTS)
      // ============================================================
      if (!targetAssignment.orgUnit) {
        return {
          allowed: false,
          reason: 'Target has assignment but missing orgUnit',
          step: 'TARGET_CHECK',
          code: 'TARGET_MISSING_ORGUNIT'
        };
      }
      
      // ============================================================
      // STEP 5: SELF-ACTION CHECK
      // ============================================================
      if (actorId.toString() === targetId.toString()) {
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
      // STEP 6: ACTION TYPE DETERMINATION
      // ============================================================
      const actionType = permissionObject.actionType || CONSTANTS.ACTION_TYPES.FUNCTIONAL;

      console.log(`\n🔍 Action Type Debug:`);
      console.log(`   Permission: ${actionPermission}`);
      console.log(`   ActionType from DB: ${permissionObject.actionType}`);
      console.log(`   Effective ActionType: ${actionType}`);
      console.log(`   Actor: ${actorAssignment.departmentCode} (L${actorAssignment.orgUnit.level})`);
      console.log(`   Target: ${targetAssignment.departmentCode} (L${targetAssignment.orgUnit.level})`);
      
      // ============================================================
      // STEP 7: ADMINISTRATIVE ACTION PATH
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
      // STEP 8: FUNCTIONAL ACTION PATH
      // ============================================================
      if (actionType === CONSTANTS.ACTION_TYPES.FUNCTIONAL) {
        console.log('⚙️  Functional action - checking bypass and department...');
        
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
        
        // ✅ Check department match
        if (actorAssignment.departmentCode === CONSTANTS.DEPARTMENTS.ALL) {
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
        
        return {
          allowed: true,
          reason: 'Functional action allowed - same department',
          step: 'COMPLETE',
          code: 'FUNCTIONAL_ALLOWED',
          actionType
        };
      }
      
      // ============================================================
      // STEP 9: INFORMATIONAL ACTION PATH
      // ============================================================
      if (actionType === CONSTANTS.ACTION_TYPES.INFORMATIONAL) {
        console.log('👁️  Informational action - read-only access');
        
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
      console.warn(`⚠️  Unknown action type: ${actionType}`);
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
   * NEW: CHECK INITIALIZATION AUTHORITY
   * ========================================
   * Validates if actor has authority to perform initialization
   * actions on unassigned employees
   * 
   * Rules:
   * 1. Executives (dept: "All") can initialize anyone
   * 2. HR users can initialize HR employees
   * 3. Department heads can initialize their department
   * 4. High-level users (level <= 3) have broader authority
   */
  static _checkInitializationAuthority(actorAssignment, actionPermission) {
    const actorDept = actorAssignment.departmentCode;
    const actorLevel = actorAssignment.orgUnit?.level;
    const roleCategory = actorAssignment.roleId?.category;
    
    // ✅ Rule 1: Executives can initialize anyone
    if (actorDept === CONSTANTS.DEPARTMENTS.ALL) {
      return {
        allowed: true,
        reason: 'Executive has authority to initialize any employee'
      };
    }
    
    // ✅ Rule 2: High-level users (Divisions, Board, CEO)
    if (actorLevel !== undefined && actorLevel <= 3) {
      return {
        allowed: true,
        reason: `High-level user (L${actorLevel}) authorized for employee initialization`
      };
    }
    
    // ✅ Rule 3: HR department has special initialization privileges
    if (actorDept === CONSTANTS.DEPARTMENTS.HR) {
      // HR can initialize employees as part of onboarding
      if (['register_employee', 'assign_employee_role', 'approve_employee'].includes(actionPermission)) {
        return {
          allowed: true,
          reason: 'HR department authorized for employee onboarding'
        };
      }
    }
    
    // ✅ Rule 4: Department managers (level 4) can initialize within their dept
    if (actorLevel === 4) {
      return {
        allowed: true,
        reason: 'Department manager authorized to initialize employees in their department'
      };
    }
    
    // ❌ Default: Not authorized for initialization
    return {
      allowed: false,
      reason: `Insufficient authority for initialization (Dept: ${actorDept}, Level: ${actorLevel})`,
      code: 'INSUFFICIENT_INITIALIZATION_AUTHORITY',
      hint: 'Only Executives, HR, or Department Managers can initialize new employees'
    };
  }

  /**
   * ========================================
   * HELPER: Check hierarchy bypass flag
   * ========================================
   */
  static async _checkHierarchyBypass(actorAssignment, permissionObject) {
    try {
      if (permissionObject.metadata?.bypassHierarchy === true) {
        return true;
      }
      
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
   */
  static _checkDepartmentScope(actorDept, targetDept) {
    if (actorDept === CONSTANTS.DEPARTMENTS.ALL) {
      return { allowed: true };
    }
    
    if (actorDept !== targetDept) {
      return {
        allowed: false,
        reason: `Cross-department action not allowed (Actor: ${actorDept}, Target: ${targetDept})`
      };
    }
    
    return { allowed: true };
  }

  /**
   * Subtree check
   */
  static _checkSubtree(actorOrgUnit, targetOrgUnit) {
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
        
        if (!actorId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }
        
        // ✅ Extract target ID from multiple sources
        const targetId = 
          req.params.employeeId || 
          req.params.targetId || 
          req.params.finalizedEmployeeId ||
          req.body.targetEmployeeId ||
          req.body.employeeId;
        
        // ✅ If no target ID, skip hierarchy check
        if (!targetId) {
          console.log('ℹ️  No target ID found - skipping hierarchy check (list/view-all route)');
          return next();
        }
        
        // ✅ Self-action check
        if (actorId.toString() === targetId.toString() && !options.blockSelfAction) {
          console.log('ℹ️  Self-action detected - skipping hierarchy check');
          return next();
        }
        
        // ✅ Ensure permission check ran first
        if (!req.permissionCheck || !req.permissionCheck.action) {
          console.error('❌ HierarchyGuard: No permission check data found');
          console.error('   This middleware must run AFTER authorize()');
          
          return res.status(500).json({
            success: false,
            message: 'Configuration error: Permission check must run before hierarchy guard',
            code: 'MIDDLEWARE_ORDER_ERROR'
          });
        }
        
        const permissionAction = req.permissionCheck.action;
        
        console.log(`\n🔍 HierarchyGuard Check:`);
        console.log(`   Actor: ${req.user.individualName} (${actorId})`);
        console.log(`   Target: ${targetId}`);
        console.log(`   Permission: ${permissionAction}`);
        
        // ✅ Perform hierarchy validation
        const check = await HierarchyGuard.canPerformAction(actorId, targetId, permissionAction);
        
        if (!check.allowed) {
          console.log(`   ❌ Hierarchy check failed: ${check.reason}\n`);
          
          return res.status(403).json({
            success: false,
            message: 'Insufficient authority',
            reason: check.reason,
            code: check.code,
            details: {
              step: check.step,
              actorLevel: check.actorLevel,
              targetLevel: check.targetLevel,
              actionType: check.actionType,
              hint: check.hint
            }
          });
        }
        
        console.log(`   ✅ Hierarchy check passed: ${check.reason}`);
        if (check.bypassReason) {
          console.log(`   📝 Bypass reason: ${check.bypassReason}\n`);
        }
        
        // ✅ Attach check result to request
        req.hierarchyCheck = check;
        next();
        
      } catch (error) {
        console.error('❌ Hierarchy Guard Error:', error);
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