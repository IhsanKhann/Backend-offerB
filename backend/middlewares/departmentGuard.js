// middlewares/departmentGuard.js

import RoleAssignmentModel from "../models/HRModals/RoleAssignment.model.js";
import CONSTANTS, { isExecutiveDepartment } from "../configs/departments.js";
import { isValidDepartment } from "../configs/departments.js";
console.log("Loading department guard: The departments: ", CONSTANTS.DEPARTMENTS);
console.log(isValidDepartment("HR"));
console.log("Invalid Department: ", isValidDepartment("INVALID_DEPT"));

/**
 * ✅ DEPARTMENT ISOLATION MIDDLEWARE
 * 
 * Enforces department-level data isolation:
 * - HR users can only access HR data
 * - Finance users can only access Finance data
 * - Executive users (dept: "All") bypass all restrictions
 * 
 * This middleware intercepts requests and:
 * 1. Extracts user's roleAssignment
 * 2. Checks if user is Executive
 * 3. If not, validates department scope for the request
 */

export class DepartmentGuard {
  
  /**
   * ========================================
   * MAIN MIDDLEWARE FUNCTION
   * ========================================
   * Apply department-based filtering to requests
   * 
   * @param {Object} options - Configuration options
   * @param {String} options.requiredDepartment - Specific department required (optional)
   * @param {Boolean} options.allowCrossDepartment - Allow cross-dept for this route (default: false)
   * @param {String} options.targetParam - Where to find target department (default: 'departmentCode')
   */
  static middleware(options = {}) {
    const {
      requiredDepartment = null,
      allowCrossDepartment = false,
      targetParam = 'departmentCode'
    } = options;
    
    return async (req, res, next) => {
      try {
        const userId = req.user?._id;
        
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'Authentication required'
          });
        }
        
        // Get user's role assignment
        const userAssignment = await RoleAssignmentModel.findOne({
          employeeId: userId,
          isActive: true
        }).populate('orgUnit');
        
        if (!userAssignment) {
          return res.status(403).json({
            success: false,
            message: 'No active role assignment found',
            code: 'NO_ASSIGNMENT'
          });
        }
        
        const userDepartment = userAssignment.departmentCode;
        
        // ✅ EXECUTIVE BYPASS
        if (isExecutiveDepartment(userDepartment)) {
          console.log(`✅ Executive bypass: ${req.user.individualName} (dept: All)`);
          
          req.departmentContext = {
            userDepartment: userDepartment,
            isExecutive: true,
            bypassActive: true
          };
          
          return next();
        }
        
        // ✅ VALIDATE USER DEPARTMENT
        if (!isValidDepartment(userDepartment)) {
          return res.status(500).json({
            success: false,
            message: 'Invalid department in user assignment',
            code: 'INVALID_DEPARTMENT'
          });
        }
        
        // ✅ CHECK REQUIRED DEPARTMENT
        if (requiredDepartment) {
          if (userDepartment !== requiredDepartment) {
            return res.status(403).json({
              success: false,
              message: `This action requires ${requiredDepartment} department access`,
              code: 'DEPARTMENT_MISMATCH',
              details: {
                userDepartment,
                requiredDepartment
              }
            });
          }
        }
        
        // ✅ CHECK CROSS-DEPARTMENT RESTRICTIONS
        if (!allowCrossDepartment) {
          // Extract target department from request
          const targetDepartment = 
            req.params[targetParam] ||
            req.query[targetParam] ||
            req.body[targetParam];
          
          if (targetDepartment) {
            // If target department specified and different from user's
            if (targetDepartment !== userDepartment && 
                targetDepartment !== CONSTANTS.DEPARTMENTS.ALL) {
              
              console.warn(
                `🚫 Cross-department attempt: ${req.user.individualName} ` +
                `(${userDepartment}) tried to access ${targetDepartment}`
              );
              
              return res.status(403).json({
                success: false,
                message: 'Cross-department access denied',
                code: 'CROSS_DEPARTMENT_DENIED',
                details: {
                  userDepartment,
                  targetDepartment
                }
              });
            }
          }
        }
        
        // ✅ ATTACH DEPARTMENT CONTEXT TO REQUEST
        req.departmentContext = {
          userDepartment,
          isExecutive: false,
          bypassActive: false,
          allowCrossDepartment
        };
        
        // ✅ HELPER: Add department filter to query
        req.addDepartmentFilter = (query) => {
          if (!req.departmentContext.isExecutive) {
            query.departmentCode = userDepartment;
          }
          return query;
        };
        
        console.log(
          `✅ Department guard passed: ${req.user.individualName} ` +
          `(dept: ${userDepartment})`
        );
        
        next();
        
      } catch (error) {
        console.error('❌ Department Guard error:', error);
        return res.status(500).json({
          success: false,
          message: 'Failed to verify department access',
          error: error.message
        });
      }
    };
  }

  /**
   * ========================================
   * UTILITY: Filter query by department
   * ========================================
   * Apply department filter to Mongoose query
   */
  static async applyDepartmentFilter(userId, baseQuery = {}) {
    try {
      const assignment = await RoleAssignmentModel.findOne({
        employeeId: userId,
        isActive: true
      });
      
      if (!assignment) {
        throw new Error('No active assignment');
      }
      
      // Executive bypass
      if (isExecutiveDepartment(assignment.departmentCode)) {
        return baseQuery; // No filter needed
      }
      
      // Add department filter
      return {
        ...baseQuery,
        departmentCode: assignment.departmentCode
      };
      
    } catch (error) {
      console.error('❌ applyDepartmentFilter error:', error);
      throw error;
    }
  }

  /**
   * ========================================
   * UTILITY: Check department access
   * ========================================
   * Quick check if user can access a department
   */
  static async canAccessDepartment(userId, targetDepartment) {
    try {
      const assignment = await RoleAssignmentModel.findOne({
        employeeId: userId,
        isActive: true
      });
      
      if (!assignment) {
        return false;
      }
      
      // Executive can access all
      if (isExecutiveDepartment(assignment.departmentCode)) {
        return true;
      }
      
      // Same department
      return assignment.departmentCode === targetDepartment;
      
    } catch (error) {
      console.error('❌ canAccessDepartment error:', error);
      return false;
    }
  }
}

/**
 * ========================================
 * EXPORT MIDDLEWARE CREATORS
 * ========================================
 */

// Require specific department
export const requireDepartment = (dept) => {
  return DepartmentGuard.middleware({ requiredDepartment: dept });
};

// Allow cross-department for this route
export const allowCrossDepartment = () => {
  return DepartmentGuard.middleware({ allowCrossDepartment: true });
};

// Standard department guard
export const checkDepartment = (options) => {
  return DepartmentGuard.middleware(options);
};

export default DepartmentGuard; 