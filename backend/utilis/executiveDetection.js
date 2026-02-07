// utils/executiveDetection.js

import CONSTANTS, { isExecutiveLevel } from '../config/constants.js';

/**
 * ✅ EXECUTIVE DETECTION UTILITY
 * Centralized logic for determining executive status
 */

export class ExecutiveDetection {
  
  /**
   * Check if user is an executive
   */
  static isExecutive(roleAssignment) {
    if (!roleAssignment) return false;

    // Method 1: Department code
    if (roleAssignment.departmentCode === CONSTANTS.DEPARTMENTS.ALL) {
      return true;
    }

    // Method 2: Org level
    if (roleAssignment.orgUnit?.level !== undefined) {
      if (isExecutiveLevel(roleAssignment.orgUnit.level)) {
        return true;
      }
    }

    // Method 3: Role category
    if (roleAssignment.roleId?.category === 'Executive') {
      return true;
    }

    return false;
  }

  /**
   * Check if user bypasses department restrictions
   */
  static bypassesDepartmentRestrictions(roleAssignment) {
    return this.isExecutive(roleAssignment);
  }

  /**
   * Get executive level (0-2 for Chairman/Board/CEO, null otherwise)
   */
  static getExecutiveLevel(roleAssignment) {
    if (!this.isExecutive(roleAssignment)) {
      return null;
    }

    return roleAssignment.orgUnit?.level || null;
  }

  /**
   * Check if user has cross-department authority
   */
  static hasCrossDepartmentAuthority(roleAssignment) {
    return this.bypassesDepartmentRestrictions(roleAssignment);
  }
}

export default ExecutiveDetection;