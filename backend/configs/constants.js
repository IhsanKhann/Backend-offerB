// config/constants.js

/**
 * ✅ CENTRAL CONFIGURATION FOR RBAC SYSTEM
 * All enums and constants in one place for easy maintenance
 */

export const CONSTANTS = {
  // ==================== DEPARTMENTS ====================
  DEPARTMENTS: {
    HR: 'HR',
    FINANCE: 'Finance',
    BUSINESS_OPERATION: 'BusinessOperation',
    IT: 'IT',
    COMPLIANCE: 'Compliance',
    ALL: 'All'
  },

  // ==================== ORG UNIT TYPES ====================
  ORG_UNIT_TYPES: {
    ORG_ROOT: 'ORG_ROOT',       // Level 0 - Chairman
    BOARD: 'BOARD',             // Level 1 - Board of Directors
    EXECUTIVE: 'EXECUTIVE',     // Level 2 - CEO
    DIVISION: 'DIVISION',       // Level 3 - Finance Division, HR Division
    DEPARTMENT: 'DEPARTMENT',   // Level 4 - Accounting Dept, Recruitment Dept
    DESK: 'DESK',               // Level 5 - Payroll Desk, Training Desk
    CELL: 'CELL'                // Level 6 - Individual contributor cells
  },

  // ==================== HIERARCHY SCOPES ====================
  HIERARCHY_SCOPES: {
    SELF: 'SELF',                     // Can only act on own data
    DESCENDANT: 'DESCENDANT',         // Can act on subordinates
    DEPARTMENT: 'DEPARTMENT',         // Can act within same department
    ORGANIZATION: 'ORGANIZATION'      // Can act organization-wide
  },

  // ==================== ACTION TYPES ====================
  ACTION_TYPES: {
    ADMINISTRATIVE: 'ADMINISTRATIVE',  // Requires hierarchy: approve, suspend, terminate
    FUNCTIONAL: 'FUNCTIONAL',          // Department-scoped: generate report, process
    INFORMATIONAL: 'INFORMATIONAL'     // Read-only: view dashboard, view list
  },

  // ==================== RESOURCE TYPES ====================
  RESOURCE_TYPES: {
    EMPLOYEE: 'EMPLOYEE',
    LEAVE: 'LEAVE',
    ROLE: 'ROLE',
    PERMISSION: 'PERMISSION',
    ORG_UNIT: 'ORG_UNIT',
    SALARY: 'SALARY',
    LEDGER: 'LEDGER',
    EXPENSE: 'EXPENSE',
    COMMISSION: 'COMMISSION',
    ALL: 'ALL'
  },

  // ==================== EXECUTIVE LEVELS ====================
  // Users at or below these levels are considered "Executives"
  EXECUTIVE_LEVELS: [0, 1, 2], // Chairman, Board, CEO

  // ==================== POWER RANK THRESHOLDS ====================
  POWER_RANKS: {
    SUPREME: 0,      // Chairman
    EXECUTIVE: 1,    // Board
    SENIOR: 2,       // CEO
    MANAGEMENT: 3,   // Division Heads
    SUPERVISORY: 4,  // Department Managers
    OPERATIONAL: 5,  // Desk Supervisors
    INDIVIDUAL: 6    // Cell workers
  },

  // ==================== AUDIT EVENT TYPES ====================
  AUDIT_EVENTS: {
    PERMISSION_CHECK: 'PERMISSION_CHECK',
    PERMISSION_GRANTED: 'PERMISSION_GRANTED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    HIERARCHY_VIOLATION: 'HIERARCHY_VIOLATION',
    DEPARTMENT_VIOLATION: 'DEPARTMENT_VIOLATION',
    EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
    EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
    ROLE_ASSIGNED: 'ROLE_ASSIGNED',
    PERMISSION_MODIFIED: 'PERMISSION_MODIFIED'
  },

  // ==================== CACHE TTL ====================
  CACHE_TTL: {
    PERMISSIONS: 300,      // 5 minutes
    HIERARCHY: 600,        // 10 minutes
    ORG_STRUCTURE: 1800    // 30 minutes
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if department code is valid
 */
export function isValidDepartment(code) {
  return Object.values(CONSTANTS.DEPARTMENTS).includes(code);
}

/**
 * Check if user is at executive level
 */
export function isExecutiveLevel(level) {
  return CONSTANTS.EXECUTIVE_LEVELS.includes(level);
}

/**
 * Get all department codes
 */
export function getAllDepartments() {
  return Object.values(CONSTANTS.DEPARTMENTS);
}

/**
 * Check if department is executive (ALL)
 */
export function isExecutiveDepartment(code) {
  return code === CONSTANTS.DEPARTMENTS.ALL;
}

/**
 * Get power rank description
 */
export function getPowerRankName(level) {
  const ranks = Object.entries(CONSTANTS.POWER_RANKS);
  const rank = ranks.find(([_, value]) => value === level);
  return rank ? rank[0] : 'UNKNOWN';
}

export default CONSTANTS;