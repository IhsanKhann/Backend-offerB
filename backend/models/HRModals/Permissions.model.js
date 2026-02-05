import mongoose from "mongoose";

const PermissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  action: {
    type: String,
    required: function() {
      return this.isNew && !this.name.startsWith("LEGACY_");
    },
    index: true,
  },
  statusScope: {
    type: [String],
    enum: ["HR", "Finance", "BusinessOperation", "ALL"],
    default: ["ALL"],
    validate: {
      validator: function(arr) {
        return !(arr.includes("ALL") && arr.length > 1);
      },
      message: '"ALL" cannot be combined with specific departments'
    }
  },
  hierarchyScope: {
    type: String,
    enum: ["SELF", "DESCENDANT", "DEPARTMENT", "ORGANIZATION"],
    default: "SELF",
  },
  resourceType: {
    type: String,
    enum: [
      // HR & Administration
      "EMPLOYEE",      // Registration, Drafts, Admin Dashboard
      "LEAVE",         // Leave Applications
      "ROLE",          // Assign Roles, Role Manager Advanced
      "PERMISSION",    // Permission Management, Employee Permissions
      "NOTIFICATION",  // Notification Manager
      "ORG_UNIT",      // Organization Hierarchy (Department/Branch structure)

      // Finance & Accounting
      "SALARY",        // Dashboard, Rules, History, Summary, Breakup
      "SELLER",        // Sellers Dashboard, Seller Actions
      "ACCOUNT_STMT",  // Account Statements, Payments, Paid Statements
      "LEDGER",        // General financial records/Business Tables

      // Business Operations
      "EXPENSE",       // Dashboard, Reports (Paid/Unpaid/Calculated)
      "COMMISSION",    // Dashboard, Reports, Transactions
      
      // Global
      "ALL"            // Wildcard for full system access
    ],
    default: "ALL",
  },
  description: {
    type: String,
    required: false,
  },
  isSystem: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  category: {
    type: String,
    enum: ["HR", "Finance", "Business", "System", "Reports"],
    default: "System",
  },
}, { 
  timestamps: true 
});

PermissionSchema.index({ action: 1, statusScope: 1 });
PermissionSchema.index({ action: 1, hierarchyScope: 1 });
PermissionSchema.index({ resourceType: 1 });
PermissionSchema.index({ isActive: 1 });
PermissionSchema.index({ category: 1 });

PermissionSchema.virtual('appliesToAllDepartments').get(function() {
  return this.statusScope.includes("ALL") || this.statusScope.length === 0;
});

PermissionSchema.virtual('isOrganizationWide').get(function() {
  return this.hierarchyScope === "ORGANIZATION";
});

PermissionSchema.methods.appliesToDepartment = function (departmentCode) {
  if (!departmentCode) return false;
  if (departmentCode === "ALL" || !this.statusScope || this.statusScope.length === 0 || this.statusScope.includes("ALL")) {
    return true;
  }
  return this.statusScope.includes(departmentCode);
};

PermissionSchema.methods.allowsHierarchyAction = function(userOrgUnit, targetOrgUnit, userDepartment, targetDepartment) {
  switch (this.hierarchyScope) {
    case "SELF":
      return userOrgUnit.toString() === targetOrgUnit.toString();
    case "DESCENDANT":
      return true; // Hierarchy validation handled by middleware
    case "DEPARTMENT":
      return userDepartment === targetDepartment;
    case "ORGANIZATION":
      return true;
    default:
      return false;
  }
};

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

PermissionSchema.statics.getForDepartment = function(departmentCode) {
  return this.find({
    isActive: true,
    $or: [ { statusScope: "ALL" }, { statusScope: departmentCode } ]
  });
};

PermissionSchema.statics.seedDefaults = async function() {
  const defaults = [
    { name: "VIEW_EMPLOYEES", action: "VIEW_EMPLOYEES", statusScope: ["HR"], hierarchyScope: "DESCENDANT", resourceType: "EMPLOYEE", category: "HR", isSystem: true },
    { name: "REGISTER_EMPLOYEE", action: "REGISTER_EMPLOYEE", statusScope: ["HR"], hierarchyScope: "DEPARTMENT", resourceType: "EMPLOYEE", category: "HR", isSystem: true },
    { name: "APPROVE_EMPLOYEE", action: "APPROVE_EMPLOYEE", statusScope: ["HR"], hierarchyScope: "DESCENDANT", resourceType: "EMPLOYEE", category: "HR", isSystem: true },
    { name: "SUSPEND_EMPLOYEE", action: "SUSPEND_EMPLOYEE", statusScope: ["HR"], hierarchyScope: "DESCENDANT", resourceType: "EMPLOYEE", category: "HR", isSystem: true },
    { name: "TERMINATE_EMPLOYEE", action: "TERMINATE_EMPLOYEE", statusScope: ["HR"], hierarchyScope: "DESCENDANT", resourceType: "EMPLOYEE", category: "HR", isSystem: true },
    { name: "APPROVE_LEAVE", action: "APPROVE_LEAVE", statusScope: ["HR"], hierarchyScope: "DESCENDANT", resourceType: "LEAVE", category: "HR", isSystem: true },
    { name: "VIEW_LEDGER", action: "VIEW_LEDGER", statusScope: ["Finance"], hierarchyScope: "DEPARTMENT", resourceType: "LEDGER", category: "Finance", isSystem: true },
    { name: "EDIT_SALARY", action: "EDIT_SALARY", statusScope: ["Finance"], hierarchyScope: "DESCENDANT", resourceType: "SALARY", category: "Finance", isSystem: true },
    { name: "APPROVE_EXPENSE", action: "APPROVE_EXPENSE", statusScope: ["Finance"], hierarchyScope: "DESCENDANT", resourceType: "EXPENSE", category: "Finance", isSystem: true },
    { name: "VIEW_SALARY_HISTORY", action: "VIEW_SALARY_HISTORY", statusScope: ["Finance"], hierarchyScope: "DEPARTMENT", resourceType: "SALARY", category: "Finance", isSystem: true },
    { name: "MANAGE_EXPENSES", action: "MANAGE_EXPENSES", statusScope: ["BusinessOperation"], hierarchyScope: "DEPARTMENT", resourceType: "EXPENSE", category: "Business", isSystem: true },
    { name: "VIEW_COMMISSION", action: "VIEW_COMMISSION", statusScope: ["BusinessOperation"], hierarchyScope: "DEPARTMENT", resourceType: "COMMISSION", category: "Business", isSystem: true },
    { name: "MANAGE_ROLES", action: "MANAGE_ROLES", statusScope: ["ALL"], hierarchyScope: "ORGANIZATION", resourceType: "ROLE", category: "System", isSystem: true },
    { name: "MANAGE_PERMISSIONS", action: "MANAGE_PERMISSIONS", statusScope: ["ALL"], hierarchyScope: "ORGANIZATION", resourceType: "PERMISSION", category: "System", isSystem: true },
    { name: "MANAGE_ORGUNIT", action: "MANAGE_ORGUNIT", statusScope: ["ALL"], hierarchyScope: "ORGANIZATION", resourceType: "ORGUNIT", category: "System", isSystem: true },
    { name: "VIEW_ALL_EMPLOYEES", action: "VIEW_ALL_EMPLOYEES", statusScope: ["ALL"], hierarchyScope: "ORGANIZATION", resourceType: "EMPLOYEE", category: "System", isSystem: true },
  ];

  for (const perm of defaults) {
    await this.findOneAndUpdate({ name: perm.name }, perm, { upsert: true, new: true });
  }
  console.log("✅ Default permissions seeded");
};

export const PermissionModel = mongoose.model("Permission", PermissionSchema);