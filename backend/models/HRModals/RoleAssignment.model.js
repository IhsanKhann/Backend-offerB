import mongoose from "mongoose";

// Role Assignment Schema (for employee-specific assignments)
const RoleAssignmentSchema = new mongoose.Schema(
  {
    // Reference to employee
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
      required: true,
    },

    // Reference to Role Declaration
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    // OrgUnit assignment (specific to this assignment)
    orgUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OrgUnit",
      required: true,
    },

    // Auto-derived from role declaration
    code: {
      type: String,
      enum: ["HR", "Finance", "BusinessOperation"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Offices", "Groups", "Divisions", "Departments", "Branches", "Cells"],
      required: true,
    },

    // Assignment dates
    assignedAt: {
      type: Date,
      default: Date.now,
    },

    effectiveFrom: {
      type: Date,
      default: Date.now,
    },

    effectiveUntil: {
      type: Date,
      default: null, // null means indefinite
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Assignment metadata
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
RoleAssignmentSchema.index({ employeeId: 1 });
RoleAssignmentSchema.index({ roleId: 1 });
RoleAssignmentSchema.index({ orgUnit: 1 });
RoleAssignmentSchema.index({ code: 1 });
RoleAssignmentSchema.index({ status: 1 });
RoleAssignmentSchema.index({ employeeId: 1, isActive: 1 });
RoleAssignmentSchema.index({ code: 1, status: 1 });

// Ensure only one active assignment per employee
RoleAssignmentSchema.index(
  { employeeId: 1, isActive: 1 },
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
);

const RoleAssignmentModel = mongoose.model("RoleAssignment", RoleAssignmentSchema);
export default RoleAssignmentModel;