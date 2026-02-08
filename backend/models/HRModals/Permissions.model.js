// models/HRModals/Permissions.model.js - FIXED VERSION

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
      "EMPLOYEE", "LEAVE", "ROLE", "PERMISSION", "NOTIFICATION", "ORG_UNIT",
      "SALARY", "SELLER", "ACCOUNT_STMT", "LEDGER",
      "EXPENSE", "COMMISSION",
      "ALL"
    ],
    default: "ALL",
  },
  
  // ✅ FIXED: Action Type - Controls hierarchy enforcement
  // Changed default from INFORMATIONAL to FUNCTIONAL for better security
  actionType: {
    type: String,
    enum: ["ADMINISTRATIVE", "FUNCTIONAL", "INFORMATIONAL"],
    default: "FUNCTIONAL", // ✅ SAFER DEFAULT - Requires department match
    index: true
  },
  
  // ✅ ENHANCED: Metadata for special flags
  metadata: {
    bypassHierarchy: { 
      type: Boolean, 
      default: false,
      description: "If true, bypasses hierarchy checks for FUNCTIONAL actions"
    },
    requiresDoubleApproval: { 
      type: Boolean, 
      default: false,
      description: "Requires approval from two different managers"
    },
    requiresAuditLog: { 
      type: Boolean, 
      default: false,
      description: "Automatically set to true for ADMINISTRATIVE actions"
    },
    sensitiveAction: { 
      type: Boolean, 
      default: false,
      description: "Marks action as sensitive (suspend, terminate, delete)"
    }
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

// Indexes
PermissionSchema.index({ action: 1, statusScope: 1 });
PermissionSchema.index({ action: 1, hierarchyScope: 1 });
PermissionSchema.index({ action: 1, actionType: 1 }); // For quick actionType lookups
PermissionSchema.index({ resourceType: 1 });
PermissionSchema.index({ isActive: 1 });
PermissionSchema.index({ category: 1 });

// ✅ NEW: Compound index for permission aggregation
PermissionSchema.index({ statusScope: 1, actionType: 1, isActive: 1 });

// Virtuals
PermissionSchema.virtual('appliesToAllDepartments').get(function() {
  return this.statusScope.includes("ALL") || this.statusScope.length === 0;
});

PermissionSchema.virtual('isOrganizationWide').get(function() {
  return this.hierarchyScope === "ORGANIZATION";
});

// ✅ NEW: Virtual to check if action is read-only
PermissionSchema.virtual('isReadOnly').get(function() {
  return this.actionType === "INFORMATIONAL";
});

// ✅ NEW: Virtual to check if action requires hierarchy
PermissionSchema.virtual('requiresHierarchy').get(function() {
  return this.actionType === "ADMINISTRATIVE";
});

// ✅ NEW: Virtual to check if action is department-scoped
PermissionSchema.virtual('isDepartmentScoped').get(function() {
  return this.actionType === "FUNCTIONAL" && !this.metadata?.bypassHierarchy;
});

// Methods
PermissionSchema.methods.appliesToDepartment = function (departmentCode) {
  if (!departmentCode) return false;
  if (departmentCode === "ALL" || 
      !this.statusScope || 
      this.statusScope.length === 0 || 
      this.statusScope.includes("ALL")) {
    return true;
  }
  return this.statusScope.includes(departmentCode);
};

PermissionSchema.methods.allowsHierarchyAction = function(
  userOrgUnit, 
  targetOrgUnit, 
  userDepartment, 
  targetDepartment
) {
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

// ✅ NEW: Method to get full permission context
PermissionSchema.methods.getContext = function() {
  return {
    id: this._id,
    name: this.name,
    action: this.action,
    actionType: this.actionType,
    requiresHierarchy: this.requiresHierarchy,
    isReadOnly: this.isReadOnly,
    isDepartmentScoped: this.isDepartmentScoped,
    departments: this.appliesToAllDepartments ? "All" : this.statusScope.join(", "),
    scope: this.hierarchyScope,
    resource: this.resourceType,
    description: this.description,
    category: this.category,
    metadata: this.metadata
  };
};

PermissionSchema.methods.toDisplay = function() {
  return this.getContext();
};

// Statics
PermissionSchema.statics.getForDepartment = function(departmentCode) {
  return this.find({
    isActive: true,
    $or: [ { statusScope: "ALL" }, { statusScope: departmentCode } ]
  });
};

// ✅ NEW: Get permissions by action type
PermissionSchema.statics.getByActionType = function(actionType) {
  return this.find({
    isActive: true,
    actionType: actionType
  });
};

// ✅ NEW: Get all administrative permissions
PermissionSchema.statics.getAdministrativePermissions = function() {
  return this.find({
    isActive: true,
    actionType: "ADMINISTRATIVE"
  });
};

// ✅ NEW: Get all informational permissions
PermissionSchema.statics.getInformationalPermissions = function() {
  return this.find({
    isActive: true,
    actionType: "INFORMATIONAL"
  });
};

// ✅ NEW: Get sensitive permissions
PermissionSchema.statics.getSensitivePermissions = function() {
  return this.find({
    isActive: true,
    'metadata.sensitiveAction': true
  });
};

// ✅ PRE-SAVE HOOK: Auto-set metadata based on actionType
PermissionSchema.pre('save', function(next) {
  // Auto-set requiresAuditLog for ADMINISTRATIVE actions
  if (this.actionType === 'ADMINISTRATIVE') {
    if (!this.metadata) this.metadata = {};
    this.metadata.requiresAuditLog = true;
  }
  
  // Auto-set sensitiveAction for certain patterns
  if (this.actionType === 'ADMINISTRATIVE') {
    const sensitivePatterns = ['delete', 'terminate', 'suspend', 'block', 'reject'];
    const actionLower = (this.action || this.name || '').toLowerCase();
    
    if (sensitivePatterns.some(pattern => actionLower.includes(pattern))) {
      if (!this.metadata) this.metadata = {};
      this.metadata.sensitiveAction = true;
    }
  }
  
  next();
});

export const PermissionModel = mongoose.model("Permission", PermissionSchema);