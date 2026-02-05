// middlewares/hierarchyGuard.js
import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import FinalizedEmployee from "../models/HRModals/FinalizedEmployees.model.js";
import { OrgUnitModel } from "../models/HRModals/OrgUnit.js";

/**
 * ✅ HIERARCHY AUTHORITY GUARD
 * 
 * Principles:
 * 1. Authority flows DOWNWARD (can only act on lower levels)
 * 2. Permissions flow UPWARD (inherit from subordinates)
 * 3. Peer-level actions are BLOCKED (same level cannot act on same level)
 * 4. Executive access (departmentCode: "All") bypasses department restrictions
 * 
 * Rule: User.level < Target.level (can only act on subordinates)
 */

export class HierarchyGuard {
  
  /**
   * Check if user can perform action on target
   */
  static async canActOn(userId, targetId, action) {
  // Get both users' assignments
  const [userAssignment, targetAssignment] = await Promise.all([
    
    RoleAssignmentModel.findOne({ employeeId: userId, isActive: true })
      .populate('orgUnit'),
    RoleAssignmentModel.findOne({ employeeId: targetId, isActive: true })
      .populate('orgUnit')
  ]);

  // 1️⃣ Check if assignment exists
  if (!userAssignment || !targetAssignment) {
    return {
      allowed: false,
      reason: 'User or target has no active role assignment'
    };
  }

  // 2️⃣ CRITICAL FIX: Check if orgUnit was actually found during population
  if (!userAssignment.orgUnit || !targetAssignment.orgUnit) {
    return {
      allowed: false,
      reason: `Organizational Unit missing for ${!userAssignment.orgUnit ? 'Acting User' : 'Target User'}. Contact Admin.`
    };
  }

  // Now it's safe to check levels
  const levelCheck = this._checkHierarchyLevel(
    userAssignment.orgUnit,
    targetAssignment.orgUnit
  );

    if (!levelCheck.allowed) {
      return levelCheck;
    }

    // 2️⃣ Check department scope
    const deptCheck = this._checkDepartmentScope(
      userAssignment.departmentCode,
      targetAssignment.departmentCode
    );

    if (!deptCheck.allowed) {
      return deptCheck;
    }

    // 3️⃣ Check if in user's subtree
    const subtreeCheck = this._checkSubtree(
      userAssignment.orgUnit,
      targetAssignment.orgUnit
    );

    if (!subtreeCheck.allowed) {
      return subtreeCheck;
    }

    return {
      allowed: true,
      reason: 'User has authority over target'
    };
  }

  /**
   * Level-based hierarchy check
   * Rule: User.level < Target.level
   */
  static _checkHierarchyLevel(userOrgUnit, targetOrgUnit) {
    if (userOrgUnit.level >= targetOrgUnit.level) {
      return {
        allowed: false,
        reason: `Cannot act on same or higher level (User: ${userOrgUnit.level}, Target: ${targetOrgUnit.level})`,
        userLevel: userOrgUnit.level,
        targetLevel: targetOrgUnit.level
      };
    }

    return { allowed: true };
  }

  /**
   * Department scope check
   * Executive (departmentCode: "All") can act across departments
   */
  static _checkDepartmentScope(userDept, targetDept) {
    // Executive access bypasses department restrictions
    if (userDept === 'All') {
      return { allowed: true };
    }

    // Same department check
    if (userDept !== targetDept) {
      return {
        allowed: false,
        reason: `Cross-department action not allowed (User: ${userDept}, Target: ${targetDept})`
      };
    }

    return { allowed: true };
  }

  /**
   * Subtree check: Target must be descendant of user
   * Uses path-based hierarchy validation
   */
  static _checkSubtree(userOrgUnit, targetOrgUnit) {
    // Target path must start with user's path
    if (!targetOrgUnit.path.startsWith(userOrgUnit.path + '.') &&
        targetOrgUnit.path !== userOrgUnit.path) {
      return {
        allowed: false,
        reason: 'Target is not in user\'s organizational subtree',
        userPath: userOrgUnit.path,
        targetPath: targetOrgUnit.path
      };
    }

    return { allowed: true };
  }

  /**
   * Get authority range for a user
   * Returns all OrgUnits where user has authority
   */
  static async getAuthorityRange(userId) {
    const assignment = await RoleAssignmentModel.findOne({
      employeeId: userId,
      isActive: true
    }).populate('orgUnit');

    if (!assignment) {
      return [];
    }

    // Find all descendants using path regex
    const pathRegex = new RegExp(`^${assignment.orgUnit.path}\\.`);
    const descendants = await OrgUnitModel.find({
      path: pathRegex,
      isActive: true
    });

    // Include self if same-level actions are allowed
    const range = [...descendants];
    
    return range.map(unit => ({
      _id: unit._id,
      name: unit.name,
      path: unit.path,
      level: unit.level,
      type: unit.type
    }));
  }

  /**
   * Middleware function for Express routes
   */
  static middleware(options = {}) {
    return async (req, res, next) => {
      try {
        const userId = req.user?._id;
        const targetId = req.params.employeeId || req.params.targetId || req.body.targetEmployeeId;

        if (!userId) {
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
        if (userId.toString() === targetId.toString() && !options.blockSelfAction) {
          return next();
        }

        // Check authority
        const check = await HierarchyGuard.canActOn(userId, targetId, req.method);

        if (!check.allowed) {
          return res.status(403).json({
            success: false,
            message: 'Insufficient authority',
            reason: check.reason,
            details: {
              userLevel: check.userLevel,
              targetLevel: check.targetLevel
            }
          });
        }

        // Attach check result to request for logging
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

/**
 * Export utility functions
 */
export const canUserActOnTarget = (userId, targetId) => 
  HierarchyGuard.canActOn(userId, targetId);

export const getAuthorityRange = (userId) => 
  HierarchyGuard.getAuthorityRange(userId);

export default HierarchyGuard;