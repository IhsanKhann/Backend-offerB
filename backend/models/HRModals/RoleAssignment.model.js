import mongoose from "mongoose";

// ✅ REFACTORED: Role Assignment Schema
// Represents contextual instances of roles with department and hierarchy
const RoleAssignmentSchema = new mongoose.Schema(
  {
    // Reference to employee
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      required: true,
    },

    // Reference to GLOBAL Role Declaration
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    // ✅ CONTEXTUAL DATA (only in assignments)
    
    // Department assignment (nullable for organization-wide roles)
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      default: null, // null = organization-wide (e.g., Chairman, CEO)
    },

    // Department code for quick filtering
    departmentCode: {
      type: String,
      enum: ["HR", "Finance", "BusinessOperation", null],
      default: null,
    },

    // Hierarchy status (nullable for non-hierarchical roles)
    status: {
      type: String,
      enum: ["Offices", "Groups", "Divisions", "Departments", "Branches", "Cells", "Desks", null],
      default: null,
    },

    // OrgUnit assignment (specific organizational position)
    orgUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      default: null,
    },

    // ✅ TIME VALIDITY
    effectiveFrom: {
      type: Date,
      default: Date.now,
      required: true,
    },

    effectiveUntil: {
      type: Date,
      default: null, // null means indefinite
    },

    // ✅ STATUS
    isActive: {
      type: Boolean,
      default: true,
    },

    // ✅ METADATA
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
    },

    assignedAt: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      default: "",
    },

    // ✅ OVERRIDES (optional)
    // Allow assignment-specific salary or permission overrides
    salaryOverride: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    permissionOverrides: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Permission",
    }],
  },
  {
    timestamps: true,
  }
);

// ✅ INDEXES
RoleAssignmentSchema.index({ employeeId: 1 });
RoleAssignmentSchema.index({ roleId: 1 });
RoleAssignmentSchema.index({ departmentId: 1 });
RoleAssignmentSchema.index({ departmentCode: 1 });
RoleAssignmentSchema.index({ status: 1 });
RoleAssignmentSchema.index({ orgUnit: 1 });
RoleAssignmentSchema.index({ employeeId: 1, isActive: 1 });
RoleAssignmentSchema.index({ roleId: 1, isActive: 1 });
RoleAssignmentSchema.index({ departmentCode: 1, isActive: 1 });
RoleAssignmentSchema.index({ roleId: 1, departmentCode: 1, isActive: 1 });
RoleAssignmentSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });

// ✅ Ensure only one active assignment per employee
RoleAssignmentSchema.index(
  { employeeId: 1, isActive: 1 },
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

// ✅ VIRTUALS
RoleAssignmentSchema.virtual('isExpired').get(function() {
  if (!this.effectiveUntil) return false;
  return new Date() > this.effectiveUntil;
});

RoleAssignmentSchema.virtual('isOrganizationWide').get(function() {
  return this.departmentId === null;
});

// ✅ METHODS
RoleAssignmentSchema.methods.deactivate = async function() {
  this.isActive = false;
  this.effectiveUntil = new Date();
  return this.save();
};

const RoleAssignmentModel = mongoose.model("RoleAssignment", RoleAssignmentSchema);
export default RoleAssignmentModel;