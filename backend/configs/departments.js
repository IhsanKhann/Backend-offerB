import CONSTANTS from './constants.js';

/**
 * ✅ DEPARTMENT METADATA CONFIGURATION
 * Centralized department information for the system
 */

export const DEPARTMENT_CONFIG = {
  [CONSTANTS.DEPARTMENTS.HR]: {
    code: 'HR',
    name: 'Human Resources',
    description: 'Employee lifecycle, recruitment, training',
    modules: ['employees', 'leave', 'recruitment', 'training', 'performance'],
    defaultOrgUnitPrefix: 'hr',
    color: '#3B82F6', // Blue
    icon: 'users',
    level: 1
  },

  [CONSTANTS.DEPARTMENTS.FINANCE]: {
    code: 'Finance',
    name: 'Finance & Accounting',
    description: 'Financial operations, payroll, ledger',
    modules: ['salary', 'ledger', 'expenses', 'accounts', 'budget'],
    defaultOrgUnitPrefix: 'finance',
    color: '#10B981', // Green
    icon: 'dollar-sign',
    level: 1
  },

  [CONSTANTS.DEPARTMENTS.BUSINESS_OPERATION]: {
    code: 'BusinessOperation',
    name: 'Business Operations',
    description: 'Sales, commissions, order management',
    modules: ['sales', 'commissions', 'orders', 'returns', 'customers'],
    defaultOrgUnitPrefix: 'business',
    color: '#8B5CF6', // Purple
    icon: 'briefcase',
    level: 1
  },

  [CONSTANTS.DEPARTMENTS.IT]: {
    code: 'IT',
    name: 'Information Technology',
    description: 'Systems, security, technical support',
    modules: ['systems', 'support', 'security', 'infrastructure'],
    defaultOrgUnitPrefix: 'it',
    color: '#F59E0B', // Amber
    icon: 'cpu',
    level: 2
  },

  [CONSTANTS.DEPARTMENTS.COMPLIANCE]: {
    code: 'Compliance',
    name: 'Compliance & Audit',
    description: 'Regulatory compliance, internal audit',
    modules: ['audit', 'regulatory', 'controls', 'risk'],
    defaultOrgUnitPrefix: 'compliance',
    color: '#EF4444', // Red
    icon: 'shield-check',
    level: 2
  },

  [CONSTANTS.DEPARTMENTS.ALL]: {
    code: 'All',
    name: 'Executive (All Departments)',
    description: 'Full organization access',
    modules: '*',
    defaultOrgUnitPrefix: 'executive',
    color: '#6366F1', // Indigo
    icon: 'crown',
    level: 0
  }
};

/**
 * Get department configuration
 */
export function getDepartmentConfig(code) {
  return DEPARTMENT_CONFIG[code] || null;
}

/**
 * Get all department codes
 */
export function getDepartmentCodes() {
  return Object.keys(DEPARTMENT_CONFIG);
}

/**
 * Check if department is valid
 */
export function isValidDepartment(code) {
  return code in DEPARTMENT_CONFIG;
}

/**
 * Get departments by level
 */
export function getDepartmentsByLevel(level) {
  return Object.values(DEPARTMENT_CONFIG)
    .filter(dept => dept.level === level)
    .map(dept => dept.code);
}

/**
 * Get department modules
 */
export function getDepartmentModules(code) {
  const config = DEPARTMENT_CONFIG[code];
  return config?.modules || [];
}

/**
 * Check if department has module access
 */
export function hasModuleAccess(departmentCode, moduleName) {
  const config = DEPARTMENT_CONFIG[departmentCode];
  
  if (!config) return false;
  if (config.modules === '*') return true; // Executive access
  
  return config.modules.includes(moduleName);
}

export function isExecutiveDepartment(code) {
  const config = DEPARTMENT_CONFIG[code];
  return config?.level === 0 || code === CONSTANTS.DEPARTMENTS.ALL;
}

export default DEPARTMENT_CONFIG;