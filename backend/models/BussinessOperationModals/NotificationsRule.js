import mongoose from "mongoose";

// Supports both global role targeting and department-filtered targeting
const NotificationRuleSchema = new mongoose.Schema(
  {
    // Event type this rule responds to
    eventType: {
      type: String,
      required: true,
    },

    // ✅ TARGETING STRATEGY
    targetingStrategy: {
      type: String,
      enum: ["global_roles", "department_roles", "specific_users", "department_all"],
      required: true,
      default: "department_roles",
    },

    // ✅ ROLE TARGETING (global role IDs)
    targetRoles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    }],

    // ✅ DEPARTMENT FILTER (optional)
    // If specified, only notify role holders in this department
    departmentFilter: {
      type: String,
      enum: ["HR", "Finance", "BusinessOperation", null],
      default: null,
    },

    // ✅ STATUS FILTER (optional)
    // If specified, only notify role holders at this hierarchy level
    statusFilter: {
      type: String,
      enum: ["Offices", "Groups", "Divisions", "Departments", "Branches", "Cells", "Desks", null],
      default: null,
    },

    // ✅ SPECIFIC USER TARGETING (for direct notification)
    targetUserIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
    }],

    // ✅ NOTIFICATION CONTENT
    template: {
      title: { type: String, required: true },
      message: { type: String, required: true },
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // ✅ METADATA
    enabled: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FinalizedEmployee",
    },
  },
  {
    timestamps: true,
  }
);

// ✅ INDEXES
NotificationRuleSchema.index({ eventType: 1, enabled: 1 });
NotificationRuleSchema.index({ targetingStrategy: 1 });
NotificationRuleSchema.index({ departmentFilter: 1 });

// ✅ VIRTUALS
NotificationRuleSchema.virtual('isGlobalRule').get(function() {
  return this.departmentFilter === null;
});

NotificationRuleSchema.virtual('isDepartmentSpecific').get(function() {
  return this.departmentFilter !== null;
});

const NotificationRuleModel = mongoose.model("NotificationRule", NotificationRuleSchema);
export default NotificationRuleModel;