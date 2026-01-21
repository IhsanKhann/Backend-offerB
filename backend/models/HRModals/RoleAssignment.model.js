import mongoose from "mongoose";

const RoleAssignmentSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      required: true,
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    departmentCode: {
      type: String,
      enum: ["HR", "Finance", "BusinessOperation", "All"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Offices", "Groups", "Divisions", "Departments", "Branches", "Cells", "Desks", "All"],
      required: true,
    },

    orgUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      default: null,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
      required: true,
    },

    effectiveUntil: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

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

RoleAssignmentSchema.index({ employeeId: 1 });
RoleAssignmentSchema.index({ roleId: 1 });
RoleAssignmentSchema.index({ departmentCode: 1 });
RoleAssignmentSchema.index({ status: 1 });
RoleAssignmentSchema.index({ orgUnit: 1 });
RoleAssignmentSchema.index({ employeeId: 1, isActive: 1 });
RoleAssignmentSchema.index({ roleId: 1, isActive: 1 });
RoleAssignmentSchema.index({ departmentCode: 1, isActive: 1 });
RoleAssignmentSchema.index({ roleId: 1, departmentCode: 1, isActive: 1 });
RoleAssignmentSchema.index({ effectiveFrom: 1, effectiveUntil: 1 });

RoleAssignmentSchema.index(
  { employeeId: 1, isActive: 1 },
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

RoleAssignmentSchema.virtual('isExpired').get(function() {
  if (!this.effectiveUntil) return false;
  return new Date() > this.effectiveUntil;
});

RoleAssignmentSchema.virtual('isExecutiveAccess').get(function() {
  return this.departmentCode === "All" || this.status === "All";
});

RoleAssignmentSchema.virtual('isDepartmentWide').get(function() {
  return this.status === "All" && this.departmentCode !== "All";
});

RoleAssignmentSchema.methods.deactivate = async function() {
  this.isActive = false;
  this.effectiveUntil = new Date();
  return this.save();
};

const RoleAssignmentModel = mongoose.model("RoleAssignment", RoleAssignmentSchema);
export default RoleAssignmentModel;