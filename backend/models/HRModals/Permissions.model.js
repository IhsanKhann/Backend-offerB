import mongoose from "mongoose";

/**
 * ✅ REFACTORED: Permission Schema with Scoped Authorization
 * 
 * BREAKING CHANGES:
 * - Added `action` field (replaces `name` for new permissions)
 * - Added `statusScope` (department scoping)
 * - Added `hierarchyScope` (organizational authority)
 * 
 * MIGRATION:
 * - Existing `name` field preserved for backward compatibility
 * - New permissions should use `action` + scopes
 * - Old permissions can be migrated gradually
 */

const PermissionSchema = new mongoose.Schema({
  // ========================================
  // LEGACY FIELD (Backward Compatibility)
  // ========================================
  name: {
    type: String,
    required: true,
    unique: true,
    // Examples: "VIEW_EMPLOYEES", "EDIT_SALARY"
  },

  // ========================================
  // NEW FIELDS (Scoped Authorization)
  // ========================================
  
  /**
   * Action: What operation is being performed
   * Examples: VIEW_LEDGER, APPROVE_LEAVE, SUSPEND_EMPLOYEE
   */
  action: {
    type: String,
    required: function() {
      // Required for new permissions, optional for legacy
      return this.isNew && !this.name.startsWith("LEGACY_");
    },
    index: true,
  },

  /**
   * Status Scope: Which departments can use this permission
   * 
   * Rules:
   * - ["ALL"]: Available to all departments
   * - ["HR"]: Only HR department
   * - ["HR", "Finance"]: HR and Finance only
   * - [] or null: Same as ["ALL"]
   * - []
   */
  statusScope: {
    type: [String],
    enum: ["HR", "Finance", "BusinessOperation", "ALL"],
    default: ["ALL"],
    validate: {
      validator: function(arr) {
        // If "ALL" is present, it must be the only value
        if (arr.includes("ALL") && arr.length > 1) {
          return false;
        }
        return true;
      },
      message: '"ALL" cannot be combined with specific departments'
    }
  },

  /**
   * Hierarchy Scope: Organizational reach of this permission
   * 
   * SELF: Can only act on own data
   * DESCENDANT: Can act on subordinates in hierarchy
   * DEPARTMENT: Can act on anyone in same department (status)
   * ORGANIZATION: Can act on anyone in organization
   */
  hierarchyScope: {
    type: String,
    enum: ["SELF", "DESCENDANT", "DEPARTMENT", "ORGANIZATION"],
    default: "SELF",
  },

  /**
   * Resource Type: What entity this permission applies to
   * Used for fine-grained access control
   */
  resourceType: {
    type: String,
    enum: [
      "EMPLOYEE", 
      "SALARY", 
      "LEDGER", 
      "EXPENSE", 
      "COMMISSION",
      "LEAVE",
      "ROLE",
      "PERMISSION",
      "ORGUNIT",
      "NOTIFICATION",
      "ALL"
    ],
    default: "ALL",
  },

  // ========================================
  // METADATA
  // ========================================
  
  description: {
    type: String,
    required: false,
  },

  /**
   * Is this a system-critical permission?
   * System permissions cannot be deleted
   */
  isSystem: {
    type: Boolean,
    default: false,
  },

  /**
   * Is this permission active?
   * Inactive permissions are ignored during checks
   */
  isActive: {
    type: Boolean,
    default: true,
  },

  /**
   * Category for UI grouping
   */
  category: {
    type: String,
    enum: ["HR", "Finance", "Business", "System", "Reports"],
    default: "System",
  },

}, { 
  timestamps: true 
});

// ========================================
// INDEXES
// ========================================

PermissionSchema.index({ action: 1, statusScope: 1 });
PermissionSchema.index({ action: 1, hierarchyScope: 1 });
PermissionSchema.index({ resourceType: 1 });
PermissionSchema.index({ isActive: 1 });
PermissionSchema.index({ category: 1 });

// ========================================
// VIRTUALS
// ========================================

/**
 * Check if permission applies to a specific department
 */
PermissionSchema.virtual('appliesToAllDepartments').get(function() {
  return this.statusScope.includes("ALL") || this.statusScope.length === 0;
});

/**
 * Check if permission grants organization-wide access
 */
PermissionSchema.virtual('isOrganizationWide').get(function() {
  return this.hierarchyScope === "ORGANIZATION";
});

// ========================================
// METHODS
// ========================================

/**
 * Check if this permission applies to a given department
 */
PermissionSchema.methods.appliesToDepartment = function(departmentCode) {
  if (!departmentCode) return false;
  return this.statusScope.includes("ALL") || 
         this.statusScope.includes(departmentCode);
};

/**
 * Check if this permission allows acting on a target in hierarchy
 */
PermissionSchema.methods.allowsHierarchyAction = function(
  userOrgUnit, 
  targetOrgUnit, 
  userDepartment, 
  targetDepartment
) {
  switch (this.hierarchyScope) {
    case "SELF":
      // Can only act on self
      return userOrgUnit.toString() === targetOrgUnit.toString();
    
    case "DESCENDANT":
      // Can act on self or descendants
      // (requires hierarchy check in middleware)
      return true; // Middleware will validate actual hierarchy
    
    case "DEPARTMENT":
      // Can act on anyone in same department
      return userDepartment === targetDepartment;
    
    case "ORGANIZATION":
      // Can act on anyone
      return true;
    
    default:
      return false;
  }
};

/**
 * Format permission for display
 */
PermissionSchema.methods.toDisplay = function() {
  return {
    id: this._id,
    name: this.name,
    action: this.action,
    departments: this.appliesToAllDepartments ? "All" : this.statusScope.join(", "),
    scope: this.hierarchyScope,
    resource: this.resourceType,
    description: this.description,
    category: this.category,
  };
};

// ========================================
// STATICS
// ========================================

/**
 * Get all permissions for a specific department
 */
PermissionSchema.statics.getForDepartment = function(departmentCode) {
  return this.find({
    isActive: true,
    $or: [
      { statusScope: "ALL" },
      { statusScope: departmentCode }
    ]
  });
};

/**
 * Seed default permissions (called during setup)
 */
PermissionSchema.statics.seedDefaults = async function() {
  const defaults = [
    // ========================================
    // HR PERMISSIONS
    // ========================================
    {
      name: "VIEW_EMPLOYEES",
      action: "VIEW_EMPLOYEES",
      statusScope: ["HR"],
      hierarchyScope: "DESCENDANT",
      resourceType: "EMPLOYEE",
      description: "View employees in hierarchy",
      category: "HR",
      isSystem: true,
    },
    {
      name: "REGISTER_EMPLOYEE",
      action: "REGISTER_EMPLOYEE",
      statusScope: ["HR"],
      hierarchyScope: "DEPARTMENT",
      resourceType: "EMPLOYEE",
      description: "Register new employees",
      category: "HR",
      isSystem: true,
    },
    {
      name: "APPROVE_EMPLOYEE",
      action: "APPROVE_EMPLOYEE",
      statusScope: ["HR"],
      hierarchyScope: "DESCENDANT",
      resourceType: "EMPLOYEE",
      description: "Approve employee registrations",
      category: "HR",
      isSystem: true,
    },
    {
      name: "SUSPEND_EMPLOYEE",
      action: "SUSPEND_EMPLOYEE",
      statusScope: ["HR"],
      hierarchyScope: "DESCENDANT",
      resourceType: "EMPLOYEE",
      description: "Suspend employees",
      category: "HR",
      isSystem: true,
    },
    {
      name: "TERMINATE_EMPLOYEE",
      action: "TERMINATE_EMPLOYEE",
      statusScope: ["HR"],
      hierarchyScope: "DESCENDANT",
      resourceType: "EMPLOYEE",
      description: "Terminate employees",
      category: "HR",
      isSystem: true,
    },
    {
      name: "APPROVE_LEAVE",
      action: "APPROVE_LEAVE",
      statusScope: ["HR"],
      hierarchyScope: "DESCENDANT",
      resourceType: "LEAVE",
      description: "Approve leave applications",
      category: "HR",
      isSystem: true,
    },

    // ========================================
    // FINANCE PERMISSIONS
    // ========================================
    {
      name: "VIEW_LEDGER",
      action: "VIEW_LEDGER",
      statusScope: ["Finance"],
      hierarchyScope: "DEPARTMENT",
      resourceType: "LEDGER",
      description: "View financial ledgers",
      category: "Finance",
      isSystem: true,
    },
    {
      name: "EDIT_SALARY",
      action: "EDIT_SALARY",
      statusScope: ["Finance"],
      hierarchyScope: "DESCENDANT",
      resourceType: "SALARY",
      description: "Edit employee salaries",
      category: "Finance",
      isSystem: true,
    },
    {
      name: "APPROVE_EXPENSE",
      action: "APPROVE_EXPENSE",
      statusScope: ["Finance"],
      hierarchyScope: "DESCENDANT",
      resourceType: "EXPENSE",
      description: "Approve expense reports",
      category: "Finance",
      isSystem: true,
    },
    {
      name: "VIEW_SALARY_HISTORY",
      action: "VIEW_SALARY_HISTORY",
      statusScope: ["Finance"],
      hierarchyScope: "DEPARTMENT",
      resourceType: "SALARY",
      description: "View salary history",
      category: "Finance",
      isSystem: true,
    },

    // ========================================
    // BUSINESS OPERATIONS PERMISSIONS
    // ========================================
    {
      name: "MANAGE_EXPENSES",
      action: "MANAGE_EXPENSES",
      statusScope: ["BusinessOperation"],
      hierarchyScope: "DEPARTMENT",
      resourceType: "EXPENSE",
      description: "Manage business expenses",
      category: "Business",
      isSystem: true,
    },
    {
      name: "VIEW_COMMISSION",
      action: "VIEW_COMMISSION",
      statusScope: ["BusinessOperation"],
      hierarchyScope: "DEPARTMENT",
      resourceType: "COMMISSION",
      description: "View commission reports",
      category: "Business",
      isSystem: true,
    },

    // ========================================
    // ORGANIZATION-WIDE PERMISSIONS
    // ========================================
    {
      name: "MANAGE_ROLES",
      action: "MANAGE_ROLES",
      statusScope: ["ALL"],
      hierarchyScope: "ORGANIZATION",
      resourceType: "ROLE",
      description: "Manage system roles",
      category: "System",
      isSystem: true,
    },
    {
      name: "MANAGE_PERMISSIONS",
      action: "MANAGE_PERMISSIONS",
      statusScope: ["ALL"],
      hierarchyScope: "ORGANIZATION",
      resourceType: "PERMISSION",
      description: "Manage system permissions",
      category: "System",
      isSystem: true,
    },
    {
      name: "MANAGE_ORGUNIT",
      action: "MANAGE_ORGUNIT",
      statusScope: ["ALL"],
      hierarchyScope: "ORGANIZATION",
      resourceType: "ORGUNIT",
      description: "Manage organizational units",
      category: "System",
      isSystem: true,
    },
    {
      name: "VIEW_ALL_EMPLOYEES",
      action: "VIEW_ALL_EMPLOYEES",
      statusScope: ["ALL"],
      hierarchyScope: "ORGANIZATION",
      resourceType: "EMPLOYEE",
      description: "View all employees (Chairman/Board)",
      category: "System",
      isSystem: true,
    },
  ];

  for (const perm of defaults) {
    await this.findOneAndUpdate(
      { name: perm.name },
      perm,
      { upsert: true, new: true }
    );
  }

  console.log("✅ Default permissions seeded");
};

export const PermissionModel = mongoose.model("Permission", PermissionSchema);